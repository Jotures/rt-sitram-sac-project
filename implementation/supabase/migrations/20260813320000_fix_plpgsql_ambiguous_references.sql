-- Resolve PL/pgSQL variable/column ambiguity without changing the public RPC
-- contract.  Session-derived identifiers use explicit names and every table
-- column referenced in a predicate is qualified.

create or replace function public.transition_trip_operational(
  p_trip_id uuid,
  p_target public.trip_operational_status,
  p_expected_version integer,
  p_reason text default null
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
  allowed boolean := false;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if old_trip.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Trip version conflict';
  end if;
  if private.current_app_role() = 'driver'
     and (old_trip.driver_id is distinct from private.current_driver_id()
          or p_target not in ('loading','unloading')) then
    raise exception using errcode = '42501', message = 'Driver cannot perform this transition';
  end if;
  allowed := (old_trip.operational_status = 'draft' and p_target = 'approved' and private.is_staff())
    or (old_trip.operational_status = 'scheduled' and p_target = 'loading')
    or (old_trip.operational_status = 'in_transit' and p_target = 'unloading')
    or (old_trip.operational_status not in ('completed','cancelled') and p_target = 'cancelled' and private.is_staff());
  if not allowed then
    raise exception using errcode = '23514', message = 'Invalid operational transition';
  end if;
  if p_target = 'cancelled' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Cancellation reason is required';
  end if;

  update public.trips t
  set operational_status = p_target,
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;

  if p_target = 'loading' then
    update public.vehicles v
    set current_status = 'in_trip'
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
  elsif p_target = 'cancelled' then
    update public.vehicles v
    set current_status = 'available'
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
  end if;

  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, reason, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text,
    p_target::text, p_reason, auth.uid()
  );
  perform private.write_audit(
    current_company_id,
    case when p_target = 'cancelled' then 'TRIP_CANCELLED' else 'TRIP_STATUS_CHANGED' end,
    'trip',
    p_trip_id,
    to_jsonb(old_trip),
    to_jsonb(new_trip),
    p_reason
  );
  return new_trip;
end;
$$;

create or replace function public.issue_trip_advance(
  trip_id uuid,
  driver_id uuid,
  amount numeric,
  concept text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  new_advance_id uuid := gen_random_uuid();
  trip_row public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $3 <= 0 then
    raise exception using errcode = '23514', message = 'Advance amount must be positive';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from $2 then
    raise exception using errcode = '23514', message = 'Advance driver must be assigned to the trip';
  end if;
  if trip_row.operational_status in ('draft','approved','cancelled','completed') then
    raise exception using errcode = '23514', message = 'Trip cannot receive an advance in its current state';
  end if;
  insert into public.advances (
    id, company_id, trip_id, driver_id, delivered_at, amount, currency,
    delivery_method, concept, created_by
  ) values (
    new_advance_id, current_company_id, $1, $2, now(), $3, trip_row.currency,
    'unspecified', nullif(trim($4), ''), auth.uid()
  );
  perform private.write_audit(
    current_company_id,
    'TRIP_ADVANCE_ISSUED',
    'advance',
    new_advance_id,
    null,
    (select to_jsonb(a) from public.advances a where a.id = new_advance_id)
  );
  return new_advance_id;
end;
$$;

create or replace function public.issue_trip_advance(
  p_trip_id uuid,
  p_driver_id uuid,
  p_delivered_at timestamptz,
  p_amount numeric,
  p_delivery_method text,
  p_concept text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  new_advance_id uuid := gen_random_uuid();
  trip_row public.trips;
  existing_advance_id uuid;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $4 <= 0 or $7 is null then
    raise exception using errcode = '23514', message = 'Positive amount and idempotency ID are required';
  end if;
  if length(trim($5)) = 0 then
    raise exception using errcode = '23514', message = 'Delivery method is required';
  end if;
  select a.id into existing_advance_id
  from public.advances a
  where a.company_id = current_company_id and a.idempotency_key = $7;
  if found then
    return existing_advance_id;
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from $2 then
    raise exception using errcode = '23514', message = 'Advance driver must be assigned to the trip';
  end if;
  if trip_row.operational_status in ('draft','approved','cancelled','completed') then
    raise exception using errcode = '23514', message = 'Trip cannot receive an advance in its current state';
  end if;
  insert into public.advances (
    id, company_id, trip_id, driver_id, delivered_at, amount, currency,
    delivery_method, concept, created_by, idempotency_key
  ) values (
    new_advance_id, current_company_id, $1, $2, $3, $4, trip_row.currency,
    trim($5), nullif(trim($6), ''), auth.uid(), $7
  );
  perform private.write_audit(
    current_company_id,
    'TRIP_ADVANCE_ISSUED',
    'advance',
    new_advance_id,
    null,
    (select to_jsonb(a) from public.advances a where a.id = new_advance_id)
  );
  return new_advance_id;
end;
$$;

create or replace function public.complete_work_order(
  work_order_id uuid,
  final_mileage numeric,
  labour_cost numeric,
  parts_cost numeric
)
returns public.work_orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.work_orders;
  new_row public.work_orders;
  vehicle_mileage numeric;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 < 0 or $3 < 0 or $4 < 0 then
    raise exception using errcode = '23514', message = 'Mileage and costs cannot be negative';
  end if;
  select * into old_row
  from public.work_orders w
  where w.id = $1 and w.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;
  if old_row.status = 'finished' then
    return old_row;
  end if;
  if old_row.status = 'cancelled' then
    raise exception using errcode = '23514', message = 'Cancelled work order cannot be completed';
  end if;
  select v.current_odometer_km into vehicle_mileage
  from public.vehicles v
  where v.id = old_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $2 < vehicle_mileage then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.work_orders w
  set status = 'finished',
      finished_at = coalesce(w.finished_at, now()),
      odometer_km = $2,
      labor_cost = $3,
      parts_cost = $4
  where w.id = $1 and w.company_id = current_company_id
  returning * into new_row;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $2),
      current_status = 'available'
  where v.id = old_row.vehicle_id and v.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'WORK_ORDER_COMPLETED', 'work_order', $1,
    to_jsonb(old_row), to_jsonb(new_row)
  );
  return new_row;
end;
$$;

create or replace function public.create_trip_invoice(
  trip_id uuid,
  client_id uuid,
  series text,
  number text,
  issued_at timestamptz,
  due_at timestamptz,
  total numeric
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  new_invoice_id uuid := gen_random_uuid();
  trip_row public.trips;
  invoice_row public.invoices;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $7 <= 0 then
    raise exception using errcode = '23514', message = 'Invoice total must be positive';
  end if;
  if $6 < $5 then
    raise exception using errcode = '23514', message = 'Invoice due date cannot precede issue date';
  end if;
  if length(trim($3)) = 0 or length(trim($4)) = 0 then
    raise exception using errcode = '23514', message = 'Invoice series and number are required';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.client_id <> $2 then
    raise exception using errcode = '23514', message = 'Invoice client must match trip client';
  end if;
  if trip_row.operational_status <> 'completed' then
    raise exception using errcode = '23514', message = 'Only a completed trip can be invoiced';
  end if;
  select * into invoice_row
  from public.invoices i
  where i.company_id = current_company_id
    and i.trip_id = $1
    and i.status <> 'cancelled';
  if found then
    if invoice_row.client_id = $2
       and invoice_row.series = trim($3)
       and invoice_row.number = trim($4)
       and invoice_row.issued_on = $5::date
       and invoice_row.due_on = $6::date
       and invoice_row.total = $7 then
      return invoice_row.id;
    end if;
    raise exception using errcode = '23505', message = 'Trip already has a different active invoice';
  end if;
  insert into public.invoices (
    id, company_id, client_id, trip_id, series, number, issued_on, due_on,
    currency, subtotal, tax, total, status, created_by
  ) values (
    new_invoice_id, current_company_id, $2, $1, trim($3), trim($4),
    $5::date, $6::date, trip_row.currency, $7, 0, $7, 'issued', auth.uid()
  ) returning * into invoice_row;
  update public.trips t
  set financial_status = 'billed', version = t.version + 1
  where t.id = $1 and t.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'TRIP_INVOICE_CREATED', 'invoice', new_invoice_id,
    null, to_jsonb(invoice_row)
  );
  return new_invoice_id;
end;
$$;

create or replace function public.create_trip_invoice(
  p_trip_id uuid,
  p_client_id uuid,
  p_series text,
  p_number text,
  p_issued_on date,
  p_due_on date,
  p_subtotal numeric,
  p_tax numeric
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  new_invoice_id uuid := gen_random_uuid();
  trip_row public.trips;
  invoice_row public.invoices;
  invoice_total numeric := $7 + $8;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $7 < 0 or $8 < 0 or invoice_total <= 0 then
    raise exception using errcode = '23514', message = 'Invoice amounts are invalid';
  end if;
  if $6 is not null and $6 < $5 then
    raise exception using errcode = '23514', message = 'Invoice due date cannot precede issue date';
  end if;
  if length(trim($3)) = 0 or length(trim($4)) = 0 then
    raise exception using errcode = '23514', message = 'Invoice series and number are required';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.client_id <> $2 then
    raise exception using errcode = '23514', message = 'Invoice client must match trip client';
  end if;
  if trip_row.operational_status <> 'completed' then
    raise exception using errcode = '23514', message = 'Only a completed trip can be invoiced';
  end if;
  select * into invoice_row
  from public.invoices i
  where i.company_id = current_company_id
    and i.trip_id = $1
    and i.status <> 'cancelled';
  if found then
    if invoice_row.client_id = $2
       and invoice_row.series = trim($3)
       and invoice_row.number = trim($4)
       and invoice_row.issued_on = $5
       and invoice_row.due_on is not distinct from $6
       and invoice_row.subtotal = $7
       and invoice_row.tax = $8 then
      return invoice_row.id;
    end if;
    raise exception using errcode = '23505', message = 'Trip already has a different active invoice';
  end if;
  insert into public.invoices (
    id, company_id, client_id, trip_id, series, number, issued_on, due_on,
    currency, subtotal, tax, total, status, created_by
  ) values (
    new_invoice_id, current_company_id, $2, $1, trim($3), trim($4),
    $5, $6, trip_row.currency, $7, $8, invoice_total, 'issued', auth.uid()
  ) returning * into invoice_row;
  update public.trips t
  set financial_status = 'billed', version = t.version + 1
  where t.id = $1 and t.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'TRIP_INVOICE_CREATED', 'invoice', new_invoice_id,
    null, to_jsonb(invoice_row)
  );
  return new_invoice_id;
end;
$$;

create or replace function public.resolve_alert(alert_id uuid, note text)
returns public.alerts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.alerts;
  new_row public.alerts;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce($2, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Resolution note is required';
  end if;
  select * into old_row
  from public.alerts a
  where a.id = $1 and a.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Alert not found';
  end if;
  if old_row.status = 'resolved' then
    return old_row;
  end if;
  if old_row.status = 'dismissed' then
    raise exception using errcode = '23514', message = 'Dismissed alert cannot be resolved';
  end if;
  update public.alerts a
  set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
  where a.id = $1 and a.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(
    current_company_id, 'ALERT_RESOLVED', 'alert', $1,
    to_jsonb(old_row), to_jsonb(new_row), trim($2)
  );
  return new_row;
end;
$$;

create or replace function public.attach_trip_file(
  p_entity_type text,
  p_entity_id uuid,
  p_file_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_role public.app_role := private.current_app_role();
  target_trip_id uuid;
  target_actor_id uuid;
  current_file_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if not exists (
    select 1
    from public.files f
    where f.id = $3
      and f.company_id = current_company_id
      and (private.is_staff() or f.uploaded_by = auth.uid())
  ) then
    raise exception using errcode = '42501', message = 'File is outside the authenticated upload scope';
  end if;

  if $1 = 'expense' then
    select e.trip_id, e.created_by, e.receipt_file_id
    into target_trip_id, target_actor_id, current_file_id
    from public.expenses e
    where e.id = $2 and e.company_id = current_company_id
    for update;
  elsif $1 = 'fuel_entry' then
    select f.trip_id, f.created_by, f.receipt_file_id
    into target_trip_id, target_actor_id, current_file_id
    from public.fuel_entries f
    where f.id = $2 and f.company_id = current_company_id
    for update;
  elsif $1 = 'incident' then
    select i.trip_id, i.created_by, i.file_id
    into target_trip_id, target_actor_id, current_file_id
    from public.incidents i
    where i.id = $2 and i.company_id = current_company_id
    for update;
  else
    raise exception using errcode = '22023', message = 'Unsupported attachment entity type';
  end if;
  if not found or target_trip_id is null then
    raise exception using errcode = 'P0002', message = 'Trip entity not found';
  end if;
  if current_actor_role = 'driver'
     and (target_actor_id <> auth.uid() or not private.can_access_trip(target_trip_id)) then
    raise exception using errcode = '42501', message = 'Trip entity is outside the authenticated driver scope';
  end if;
  if current_file_id = $3 then
    return $3;
  end if;
  if current_file_id is not null then
    raise exception using errcode = '23505', message = 'Entity already has a different attachment';
  end if;

  if $1 = 'expense' then
    update public.expenses e
    set receipt_file_id = $3
    where e.id = $2 and e.company_id = current_company_id;
  elsif $1 = 'fuel_entry' then
    update public.fuel_entries f
    set receipt_file_id = $3
    where f.id = $2 and f.company_id = current_company_id;
  else
    update public.incidents i
    set file_id = $3
    where i.id = $2 and i.company_id = current_company_id;
  end if;
  perform private.write_audit(
    current_company_id, 'TRIP_FILE_ATTACHED', $1, $2,
    null, jsonb_build_object('file_id', $3)
  );
  return $3;
end;
$$;

create or replace function public.schedule_trip(
  p_trip_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_expected_version integer
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'approved' then
    raise exception using errcode = '40001', message = 'Trip changed or is not plannable';
  end if;
  if not exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and v.company_id = current_company_id
      and v.active
      and v.current_status in ('available','scheduled')
  ) then
    raise exception using errcode = '23514', message = 'Vehicle is not available';
  end if;
  if not exists (
    select 1
    from public.drivers d
    where d.id = p_driver_id
      and d.company_id = current_company_id
      and d.active
      and d.current_status in ('available','assigned')
  ) then
    raise exception using errcode = '23514', message = 'Driver is not available';
  end if;
  if exists (
    select 1
    from public.documents d
    where d.company_id = current_company_id
      and d.blocks_operation
      and ((d.entity_type = 'vehicle' and d.vehicle_id = p_vehicle_id)
        or (d.entity_type = 'driver' and d.driver_id = p_driver_id))
      and (d.file_id is null or d.status in ('expired','cancelled') or d.expires_on < current_date)
  ) then
    raise exception using errcode = '23514', message = 'Critical vehicle or driver document blocks scheduling';
  end if;
  if exists (
    select 1
    from public.work_orders w
    where w.company_id = current_company_id
      and w.vehicle_id = p_vehicle_id
      and w.blocks_operation
      and w.status not in ('finished','cancelled')
  ) then
    raise exception using errcode = '23514', message = 'Blocking maintenance work order prevents scheduling';
  end if;
  if exists (
    select 1
    from public.trips t
    where t.company_id = current_company_id
      and t.id <> p_trip_id
      and (t.vehicle_id = p_vehicle_id or t.driver_id = p_driver_id)
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
  ) then
    raise exception using errcode = '23505', message = 'Vehicle or driver already has an active trip';
  end if;

  update public.trips t
  set vehicle_id = p_vehicle_id,
      driver_id = p_driver_id,
      operational_status = 'scheduled',
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'scheduled'
  where v.id = p_vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'assigned'
  where d.id = p_driver_id and d.company_id = current_company_id;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text,
    'scheduled', auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'TRIP_SCHEDULED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$$;

create or replace function public.start_trip(
  p_trip_id uuid,
  p_odometer_km numeric,
  p_expected_version integer,
  p_idempotency_key uuid
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version
     or old_trip.operational_status <> 'loading'
     or old_trip.vehicle_id is null
     or old_trip.driver_id is null then
    raise exception using errcode = '40001', message = 'Trip changed or is not ready to start';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'in_transit',
      started_at = coalesce(t.started_at, now()),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'in_trip',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'in_trip'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_start', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text,
    new_trip.operational_status::text, auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'TRIP_STARTED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$$;

create or replace function public.complete_trip(
  p_trip_id uuid,
  p_odometer_km numeric,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_cargo_delivered boolean
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  if p_cargo_delivered is distinct from true then
    raise exception using errcode = '23514', message = 'Cargo delivery must be confirmed';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'unloading' then
    raise exception using errcode = '40001', message = 'Trip changed or cannot be completed';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'completed',
      administrative_status = 'settlement_pending',
      operational_finished_at = now(),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'available',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'available'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_finish', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values
    (current_company_id, p_trip_id, 'operational', old_trip.operational_status::text, 'completed', auth.uid()),
    (current_company_id, p_trip_id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', auth.uid());
  insert into public.settlements (company_id, trip_id, driver_id)
  values (current_company_id, p_trip_id, old_trip.driver_id)
  on conflict (company_id, trip_id) do nothing;
  perform private.write_audit(
    current_company_id, 'TRIP_COMPLETED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$$;

create or replace function public.close_settlement(
  p_settlement_id uuid,
  p_expected_version integer
)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.settlements;
  new_row public.settlements;
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_row
  from public.settlements s
  where s.id = p_settlement_id and s.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  if old_row.version <> p_expected_version
     or old_row.status not in ('pending','under_review','approved') then
    raise exception using errcode = '40001', message = 'Settlement changed or cannot be closed';
  end if;
  if exists (
    select 1
    from public.settlement_expenses se
    join public.expenses e
      on e.company_id = se.company_id and e.id = se.expense_id
    where se.company_id = current_company_id
      and se.settlement_id = p_settlement_id
      and e.validation_status <> 'validated'
  ) then
    raise exception using errcode = '23514', message = 'Every included expense must be validated';
  end if;
  select coalesce(sum(a.amount), 0)
  into advances_total
  from public.advances a
  where a.company_id = current_company_id
    and a.trip_id = old_row.trip_id
    and a.status <> 'cancelled';
  select coalesce(sum(coalesce(e.approved_amount, e.amount)), 0)
  into expenses_total
  from public.settlement_expenses se
  join public.expenses e
    on e.company_id = se.company_id and e.id = se.expense_id
  where se.company_id = current_company_id
    and se.settlement_id = p_settlement_id;

  update public.settlements s
  set total_advances = advances_total,
      total_expenses = expenses_total,
      balance = advances_total - expenses_total,
      status = 'closed',
      approved_at = coalesce(s.approved_at, now()),
      closed_at = now(),
      approved_by = auth.uid(),
      version = s.version + 1
  where s.id = p_settlement_id and s.company_id = current_company_id
  returning * into new_row;
  update public.trips t
  set administrative_status = 'settlement_closed', version = t.version + 1
  where t.id = old_row.trip_id and t.company_id = current_company_id;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, old_row.trip_id, 'administrative', 'settlement_pending',
    'settlement_closed', auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'SETTLEMENT_CLOSED', 'settlement', p_settlement_id,
    to_jsonb(old_row), to_jsonb(new_row)
  );
  return new_row;
end;
$$;

create or replace function public.register_payment(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_paid_at timestamptz,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_idempotency_key uuid
)
returns public.payments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  invoice_row public.invoices;
  payment_row public.payments;
  paid_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_payment_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Payment and idempotency IDs are required';
  end if;
  select * into payment_row
  from public.payments p
  where p.company_id = current_company_id and p.idempotency_key = p_idempotency_key;
  if found then
    return payment_row;
  end if;
  if p_amount <= 0 then
    raise exception using errcode = '23514', message = 'Payment amount must be positive';
  end if;
  select * into invoice_row
  from public.invoices i
  where i.id = p_invoice_id and i.company_id = current_company_id
  for update;
  if not found or invoice_row.status in ('draft','cancelled') then
    raise exception using errcode = '23514', message = 'Invoice cannot receive payments';
  end if;
  select coalesce(sum(p.amount), 0)
  into paid_total
  from public.payments p
  where p.company_id = current_company_id
    and p.invoice_id = p_invoice_id
    and p.cancelled_at is null;
  if paid_total + p_amount > invoice_row.total then
    raise exception using errcode = '23514', message = 'Payment exceeds invoice balance';
  end if;

  insert into public.payments (
    id, company_id, invoice_id, client_id, paid_at, amount, currency,
    payment_method, reference, created_by, idempotency_key
  ) values (
    p_payment_id, current_company_id, p_invoice_id, invoice_row.client_id,
    p_paid_at, p_amount, invoice_row.currency, p_payment_method, p_reference,
    auth.uid(), p_idempotency_key
  ) returning * into payment_row;
  paid_total := paid_total + p_amount;
  update public.invoices i
  set status = case
    when paid_total = i.total then 'paid'::public.invoice_status
    else 'partial'::public.invoice_status
  end
  where i.id = p_invoice_id and i.company_id = current_company_id;
  update public.trips t
  set financial_status = case
        when paid_total = invoice_row.total then 'paid'::public.trip_financial_status
        else 'partially_paid'::public.trip_financial_status
      end,
      version = t.version + 1
  where t.id = invoice_row.trip_id and t.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'PAYMENT_CREATED', 'payment', p_payment_id,
    null, to_jsonb(payment_row)
  );
  return payment_row;
end;
$$;

create or replace function public.review_expense(
  expense_id uuid,
  validation_status public.validation_status,
  approved_amount numeric,
  note text default null
)
returns public.expenses
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.expenses;
  new_row public.expenses;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 not in ('validated','observed','rejected') then
    raise exception using errcode = '23514', message = 'Unsupported expense review decision';
  end if;
  if $2 = 'validated' and (
    $3 is null
    or $3 < 0
    or $3 > (
      select e.amount
      from public.expenses e
      where e.id = $1 and e.company_id = current_company_id
    )
  ) then
    raise exception using errcode = '23514', message = 'Approved amount must be within the submitted expense amount';
  end if;
  if $2 <> 'validated' and $3 is not null then
    raise exception using errcode = '23514', message = 'Only a validated expense can have an approved amount';
  end if;
  select * into old_row
  from public.expenses e
  where e.id = $1 and e.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Expense not found';
  end if;
  update public.expenses e
  set validation_status = $2,
      approved_amount = $3,
      updated_at = now()
  where e.id = $1 and e.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(
    current_company_id, 'EXPENSE_REVIEWED', 'expense', $1,
    to_jsonb(old_row), to_jsonb(new_row), nullif(trim($4), '')
  );
  return new_row;
end;
$$;

create or replace function public.link_driver_profile(driver_id uuid, profile_id uuid)
returns public.drivers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.drivers;
  new_row public.drivers;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if not exists (
    select 1
    from public.profiles p
    where p.id = $2
      and p.company_id = current_company_id
      and p.active
      and p.role = 'driver'
  ) then
    raise exception using errcode = '23514', message = 'An active driver profile from this company is required';
  end if;
  if exists (
    select 1
    from public.drivers d
    where d.company_id = current_company_id
      and d.profile_id = $2
      and d.id <> $1
  ) then
    raise exception using errcode = '23505', message = 'Profile is already linked to another driver';
  end if;
  select * into old_row
  from public.drivers d
  where d.id = $1 and d.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Driver not found';
  end if;
  if old_row.profile_id = $2 then
    return old_row;
  end if;
  if old_row.profile_id is not null then
    raise exception using errcode = '23505', message = 'Driver is already linked to another profile';
  end if;
  update public.drivers d
  set profile_id = $2, updated_at = now()
  where d.id = $1 and d.company_id = current_company_id
  returning * into new_row;
  perform private.write_audit(
    current_company_id, 'DRIVER_PROFILE_LINKED', 'driver', $1,
    to_jsonb(old_row), to_jsonb(new_row)
  );
  return new_row;
end;
$$;

create or replace function public.close_settlement(
  settlement_id uuid,
  resolution_method text,
  resolution_reference text,
  resolution_note text
)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  old_settlement public.settlements;
  new_settlement public.settlements;
  trip_row public.trips;
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
  calculated_balance numeric(14,2);
  clean_method text := nullif(trim($2), '');
  clean_reference text := nullif(trim($3), '');
  clean_note text := nullif(trim($4), '');
  calculated_direction text;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_settlement
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  if old_settlement.status = 'closed' then
    return old_settlement;
  end if;
  if old_settlement.status not in ('pending','under_review','observed','approved') then
    raise exception using errcode = '23514', message = 'Settlement cannot be closed in its current state';
  end if;

  select * into trip_row
  from public.trips t
  where t.id = old_settlement.trip_id and t.company_id = current_company_id
  for update;
  if not found
     or trip_row.operational_status <> 'completed'
     or trip_row.operational_finished_at is null then
    raise exception using errcode = '23514', message = 'Only a completed trip can have its settlement closed';
  end if;
  if exists (
    select 1
    from public.expenses e
    where e.company_id = current_company_id
      and e.trip_id = old_settlement.trip_id
      and e.validation_status in ('pending_review','observed')
  ) then
    raise exception using errcode = '23514', message = 'Pending or observed trip expenses must be resolved before closing the settlement';
  end if;

  delete from public.settlement_expenses se
  using public.expenses e
  where se.company_id = current_company_id
    and se.settlement_id = old_settlement.id
    and e.company_id = se.company_id
    and e.id = se.expense_id
    and e.validation_status <> 'validated';

  insert into public.settlement_expenses (
    company_id, settlement_id, expense_id, included_by
  )
  select current_company_id, old_settlement.id, e.id, current_actor_id
  from public.expenses e
  where e.company_id = current_company_id
    and e.trip_id = old_settlement.trip_id
    and e.validation_status = 'validated'
  on conflict on constraint settlement_expenses_pkey do nothing;

  select coalesce(sum(a.amount), 0)::numeric(14,2)
  into advances_total
  from public.advances a
  where a.company_id = current_company_id
    and a.trip_id = old_settlement.trip_id
    and a.status <> 'cancelled';
  select coalesce(sum(coalesce(e.approved_amount, e.amount)), 0)::numeric(14,2)
  into expenses_total
  from public.settlement_expenses se
  join public.expenses e
    on e.company_id = se.company_id and e.id = se.expense_id
  where se.company_id = current_company_id
    and se.settlement_id = old_settlement.id
    and e.validation_status = 'validated';

  calculated_balance := (advances_total - expenses_total)::numeric(14,2);
  if calculated_balance = 0 then
    calculated_direction := 'BALANCED';
    clean_method := 'AUTO_BALANCED';
    clean_reference := null;
  else
    if clean_method is null or clean_reference is null then
      raise exception using errcode = '23514', message = 'A method and reference are required to resolve a non-zero settlement balance';
    end if;
    calculated_direction := case
      when calculated_balance > 0 then 'DRIVER_RETURNS'
      else 'COMPANY_REIMBURSES'
    end;
  end if;

  update public.settlements s
  set total_advances = advances_total,
      total_expenses = expenses_total,
      balance = calculated_balance,
      status = 'closed',
      approved_at = now(),
      closed_at = now(),
      approved_by = current_actor_id,
      resolution_method = clean_method,
      resolution_reference = clean_reference,
      resolution_note = clean_note,
      resolution_direction = calculated_direction,
      resolved_amount = abs(calculated_balance),
      resolved_by = current_actor_id,
      resolved_at = now(),
      version = s.version + 1,
      updated_at = now()
  where s.id = old_settlement.id and s.company_id = current_company_id
  returning * into new_settlement;
  update public.trips t
  set administrative_status = 'settlement_closed',
      version = t.version + 1,
      updated_at = now()
  where t.id = old_settlement.trip_id and t.company_id = current_company_id;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status,
    occurred_at, actor_id
  ) values (
    current_company_id, old_settlement.trip_id, 'administrative',
    trip_row.administrative_status::text, 'settlement_closed', now(),
    current_actor_id
  );
  perform private.write_audit(
    current_company_id,
    'SETTLEMENT_CLOSED',
    'settlement',
    old_settlement.id,
    to_jsonb(old_settlement),
    to_jsonb(new_settlement),
    clean_note
  );
  return new_settlement;
end;
$$;

create or replace function public.record_odometer_entry(
  p_id uuid,
  p_trip_id uuid,
  p_reading_km numeric,
  p_reading_at timestamptz,
  p_reading_type text,
  p_source_device_id text,
  p_idempotency_key uuid
)
returns public.odometer_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.odometer_entries;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $7 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':odometer:' || $7::text, 0)
  );
  select * into result
  from public.odometer_entries o
  where o.company_id = current_company_id and o.idempotency_key = $7;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.reading_km is distinct from $3::numeric(14,2)
      or result.reading_at is distinct from $4
      or result.reading_type is distinct from $5
      or result.source is distinct from 'driver_app'
      or result.recorded_by is distinct from current_actor_id
      or result.source_device_id is distinct from $6
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  if $3 < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  ) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.odometer_entries (
    id, company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, trip_row.vehicle_id, $2, $3, $4, $5,
    'driver_app', current_actor_id, $6, $7
  ) returning * into result;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $3)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  return result;
end;
$$;

create or replace function public.apply_driver_trip_transition(
  p_request_id uuid,
  p_trip_id uuid,
  p_action text,
  p_odometer_km numeric,
  p_cargo_delivered boolean,
  p_occurred_at timestamptz,
  p_source_device_id text
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  current_driver_id uuid := private.current_driver_id();
  trip_row public.trips;
  old_trip public.trips;
  existing_request public.trip_transition_requests;
  arrival_at timestamptz;
  current_vehicle_odometer numeric(14,2);
  normalized_device_id text := nullif(trim($7), '');
begin
  perform private.assert_role(array['driver']::public.app_role[]);
  if $1 is null or $2 is null or $6 is null then
    raise exception using errcode = '23514', message = 'Transition ID, trip, and occurrence time are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-transition:' || $1::text, 0)
  );

  select * into existing_request
  from public.trip_transition_requests r
  where r.id = $1 and r.company_id = current_company_id;
  if found then
    if existing_request.actor_id is distinct from current_actor_id
      or existing_request.trip_id is distinct from $2
      or existing_request.requested_action is distinct from $3
      or existing_request.odometer_km is distinct from $4::numeric(14,2)
      or existing_request.cargo_delivered is distinct from coalesce($5, false)
      or existing_request.occurred_at is distinct from $6
      or existing_request.source_device_id is distinct from normalized_device_id
    then
      raise exception using errcode = '23505', message = 'Transition ID was already used';
    end if;
    select * into trip_row
    from public.trips t
    where t.id = existing_request.trip_id and t.company_id = current_company_id;
    return trip_row;
  end if;

  if $6 > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from current_driver_id then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  old_trip := trip_row;

  if $3 = 'start' then
    if $4 is null or coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Start requires mileage only';
    end if;
    if trip_row.operational_status not in ('scheduled','loading')
       or trip_row.vehicle_id is null
       or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;

    update public.trips t
    set operational_status = 'in_transit',
        started_at = $6,
        version = t.version + case
          when trip_row.operational_status = 'scheduled' then 2
          else 1
        end,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'in_trip',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;

    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values
        (current_company_id, old_trip.id, 'operational', 'scheduled', 'loading', $6, 'Offline driver request', current_actor_id),
        (current_company_id, old_trip.id, 'operational', 'loading', 'in_transit', $6, 'Offline driver request', current_actor_id);
    else
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values (
        current_company_id, old_trip.id, 'operational', 'loading', 'in_transit',
        $6, 'Offline driver request', current_actor_id
      );
    end if;
    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_start', 'command', current_actor_id, normalized_device_id, $1
    );
    perform private.write_audit(
      current_company_id, 'TRIP_STARTED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );

  elsif $3 = 'arrive' then
    if $4 is not null or coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Arrival does not accept closure fields';
    end if;
    if trip_row.operational_status <> 'in_transit' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not in transit';
    end if;
    if $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Arrival must occur after trip start';
    end if;
    update public.trips t
    set operational_status = 'unloading',
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values (
      current_company_id, old_trip.id, 'operational', 'in_transit', 'unloading',
      $6, 'Offline driver request', current_actor_id
    );
    perform private.write_audit(
      current_company_id, 'TRIP_ARRIVED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );

  elsif $3 = 'complete' then
    if $4 is null or $5 is distinct from true then
      raise exception using errcode = '23514', message = 'Completion requires final mileage and delivered cargo';
    end if;
    if trip_row.operational_status <> 'unloading' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to complete';
    end if;
    select max(e.occurred_at) into arrival_at
    from public.trip_status_events e
    where e.company_id = current_company_id
      and e.trip_id = trip_row.id
      and e.dimension = 'operational'
      and e.new_status = 'unloading';
    if arrival_at is null or $6 <= arrival_at or $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1
      from public.odometer_entries o
      where o.company_id = current_company_id
        and o.trip_id = trip_row.id
        and o.reading_at > $6
      union all
      select 1
      from public.expenses e
      where e.company_id = current_company_id
        and e.trip_id = trip_row.id
        and e.incurred_at > $6
      union all
      select 1
      from public.fuel_entries f
      where f.company_id = current_company_id
        and f.trip_id = trip_row.id
        and f.fueled_at > $6
      union all
      select 1
      from public.incidents i
      where i.company_id = current_company_id
        and i.trip_id = trip_row.id
        and i.occurred_at > $6
    ) then
      raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity';
    end if;

    update public.trips t
    set operational_status = 'completed',
        administrative_status = 'settlement_pending',
        operational_finished_at = $6,
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'available',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_finish', 'command', current_actor_id, normalized_device_id, $1
    );
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values
      (current_company_id, old_trip.id, 'operational', 'unloading', 'completed', $6, 'Offline driver request', current_actor_id),
      (current_company_id, old_trip.id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', $6, 'Offline driver request', current_actor_id);
    insert into public.settlements (company_id, trip_id, driver_id, started_at)
    values (current_company_id, old_trip.id, old_trip.driver_id, $6)
    on conflict (company_id, trip_id) do nothing;
    perform private.write_audit(
      current_company_id, 'TRIP_COMPLETED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );
  else
    raise exception using errcode = '22023', message = 'Unsupported transition action';
  end if;

  insert into public.trip_transition_requests (
    id, company_id, trip_id, requested_action, odometer_km,
    cargo_delivered, occurred_at, source_device_id, actor_id, applied_at
  ) values (
    $1, current_company_id, $2, $3, $4, coalesce($5, false), $6,
    normalized_device_id, current_actor_id, now()
  );
  return trip_row;
end;
$$;

-- CREATE OR REPLACE preserves ACLs, but restate the intended API boundary so
-- this migration is self-checking when applied after a drifted environment.
revoke all on function public.transition_trip_operational(uuid,public.trip_operational_status,integer,text) from public, anon;
revoke all on function public.schedule_trip(uuid,uuid,uuid,integer) from public, anon;
revoke all on function public.start_trip(uuid,numeric,integer,uuid) from public, anon;
revoke all on function public.complete_trip(uuid,numeric,integer,uuid,boolean) from public, anon;
revoke all on function public.register_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) from public, anon;
revoke all on function public.issue_trip_advance(uuid,uuid,numeric,text) from public, anon;
revoke all on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid) from public, anon;
revoke all on function public.complete_work_order(uuid,numeric,numeric,numeric) from public, anon;
revoke all on function public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric) from public, anon;
revoke all on function public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric) from public, anon;
revoke all on function public.resolve_alert(uuid,text) from public, anon;
revoke all on function public.attach_trip_file(text,uuid,uuid) from public, anon;
revoke all on function public.review_expense(uuid,public.validation_status,numeric,text) from public, anon;
revoke all on function public.link_driver_profile(uuid,uuid) from public, anon;
revoke all on function public.close_settlement(uuid,text,text,text) from public, anon;
revoke all on function public.close_settlement(uuid,integer) from public, anon, authenticated, service_role;
revoke all on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) from public, anon;
revoke all on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) from public, anon;
revoke all on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) from public, anon;
revoke all on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) from public, anon;
revoke all on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) from public, anon;

grant execute on function public.transition_trip_operational(uuid,public.trip_operational_status,integer,text) to authenticated, service_role;
grant execute on function public.schedule_trip(uuid,uuid,uuid,integer) to authenticated, service_role;
grant execute on function public.start_trip(uuid,numeric,integer,uuid) to authenticated, service_role;
grant execute on function public.complete_trip(uuid,numeric,integer,uuid,boolean) to authenticated, service_role;
grant execute on function public.register_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated, service_role;
grant execute on function public.issue_trip_advance(uuid,uuid,numeric,text) to authenticated, service_role;
grant execute on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated, service_role;
grant execute on function public.complete_work_order(uuid,numeric,numeric,numeric) to authenticated, service_role;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric) to authenticated, service_role;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric) to authenticated, service_role;
grant execute on function public.resolve_alert(uuid,text) to authenticated, service_role;
grant execute on function public.attach_trip_file(text,uuid,uuid) to authenticated, service_role;
grant execute on function public.review_expense(uuid,public.validation_status,numeric,text) to authenticated, service_role;
grant execute on function public.link_driver_profile(uuid,uuid) to authenticated, service_role;
grant execute on function public.close_settlement(uuid,text,text,text) to authenticated, service_role;
grant execute on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) to authenticated, service_role;
grant execute on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) to authenticated, service_role;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) to authenticated, service_role;

create or replace function public.record_expense(
  p_id uuid,
  p_trip_id uuid,
  p_category_id uuid,
  p_supplier_id uuid,
  p_incurred_at timestamptz,
  p_amount numeric,
  p_currency char(3),
  p_receipt_type text,
  p_receipt_number text,
  p_receipt_file_id uuid,
  p_description text,
  p_source_device_id text,
  p_idempotency_key uuid
)
returns public.expenses
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.expenses;
  effective_driver_id uuid;
  normalized_currency char(3) := upper($7::text)::char(3);
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $13 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':expense:' || $13::text, 0)
  );
  select * into result
  from public.expenses e
  where e.company_id = current_company_id and e.idempotency_key = $13;
  if found then
    if result.id is distinct from $1
      or result.assignment_type is distinct from 'trip'::public.assignment_type
      or result.trip_id is distinct from $2
      or result.category_id is distinct from $3
      or result.supplier_id is distinct from $4
      or result.incurred_at is distinct from $5
      or result.amount is distinct from $6::numeric(14,2)
      or result.currency is distinct from normalized_currency
      or result.receipt_type is distinct from $8
      or result.receipt_number is distinct from $9
      or result.receipt_file_id is distinct from $10
      or result.description is distinct from $11
      or result.source is distinct from 'driver_app'
      or result.created_by is distinct from current_actor_id
      or result.source_device_id is distinct from $12
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;
  insert into public.expenses (
    id, company_id, assignment_type, trip_id, vehicle_id, driver_id,
    category_id, supplier_id, incurred_at, amount, currency, receipt_type,
    receipt_number, receipt_file_id, description, source, validation_status,
    created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, 'trip', $2, trip_row.vehicle_id,
    effective_driver_id, $3, $4, $5, $6, normalized_currency, $8,
    $9, $10, $11, 'driver_app', 'pending_review', current_actor_id, $12, $13
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.record_fuel_entry(
  p_id uuid,
  p_trip_id uuid,
  p_supplier_id uuid,
  p_fueled_at timestamptz,
  p_location text,
  p_odometer_km numeric,
  p_quantity numeric,
  p_volume_unit text,
  p_unit_price numeric,
  p_total_amount numeric,
  p_currency char(3),
  p_payment_method text,
  p_receipt_type text,
  p_receipt_number text,
  p_receipt_file_id uuid,
  p_source_device_id text,
  p_idempotency_key uuid
)
returns public.fuel_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.fuel_entries;
  effective_driver_id uuid;
  current_vehicle_odometer numeric(14,2);
  normalized_currency char(3) := upper($11::text)::char(3);
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':fuel:' || $17::text, 0)
  );
  select * into result
  from public.fuel_entries f
  where f.company_id = current_company_id and f.idempotency_key = $17;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.supplier_id is distinct from $3
      or result.fueled_at is distinct from $4
      or result.location is distinct from $5
      or result.odometer_km is distinct from $6::numeric(14,2)
      or result.quantity is distinct from $7::numeric(14,3)
      or result.volume_unit is distinct from $8
      or result.unit_price is distinct from $9::numeric(14,4)
      or result.total_amount is distinct from $10::numeric(14,2)
      or result.currency is distinct from normalized_currency
      or result.payment_method is distinct from $12
      or result.receipt_type is distinct from $13
      or result.receipt_number is distinct from $14
      or result.receipt_file_id is distinct from $15
      or result.created_by is distinct from current_actor_id
      or result.source_device_id is distinct from $16
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;
  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $6 < current_vehicle_odometer then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, effective_driver_id,
    $3, $4, $5, $6, $7, $8, $9, $10, normalized_currency, $12, $13,
    $14, $15, 'pending_review', current_actor_id, $16, $17
  ) returning * into result;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    current_company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'driver_app', current_actor_id, $16, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  return result;
end;
$$;

create or replace function public.report_incident(
  p_id uuid,
  p_trip_id uuid,
  p_occurred_at timestamptz,
  p_location text,
  p_incident_type text,
  p_severity public.incident_severity,
  p_description text,
  p_action_taken text,
  p_estimated_cost numeric,
  p_file_id uuid,
  p_source_device_id text,
  p_idempotency_key uuid
)
returns public.incidents
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.incidents;
  effective_driver_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $12 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':incident:' || $12::text, 0)
  );
  select * into result
  from public.incidents i
  where i.company_id = current_company_id and i.idempotency_key = $12;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.occurred_at is distinct from $3
      or result.location is distinct from $4
      or result.incident_type is distinct from $5
      or result.severity is distinct from $6
      or result.description is distinct from $7
      or result.action_taken is distinct from $8
      or result.estimated_cost is distinct from $9::numeric(14,2)
      or result.file_id is distinct from $10
      or result.created_by is distinct from current_actor_id
      or result.source_device_id is distinct from $11
    then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;
  insert into public.incidents (
    id, company_id, trip_id, vehicle_id, driver_id, occurred_at, location,
    incident_type, severity, description, action_taken, status, estimated_cost,
    file_id, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, effective_driver_id,
    $3, $4, $5, $6, $7, $8, 'open', $9, $10, current_actor_id, $11, $12
  ) returning * into result;
  return result;
end;
$$;
