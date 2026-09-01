-- Idempotency keys identify one actor and one canonical request payload. A key
-- collision never returns the pre-existing row to a different request.

create or replace function public.record_odometer_entry(
  p_id uuid, p_trip_id uuid, p_reading_km numeric, p_reading_at timestamptz,
  p_reading_type text, p_source_device_id text, p_idempotency_key uuid
)
returns public.odometer_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.odometer_entries;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $7 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(company_id::text || ':odometer:' || $7::text, 0)
  );
  select * into result
  from public.odometer_entries o
  where o.company_id = company_id and o.idempotency_key = $7;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.reading_km is distinct from $3::numeric(14,2)
      or result.reading_at is distinct from $4
      or result.reading_type is distinct from $5
      or result.source is distinct from 'driver_app'
      or result.recorded_by is distinct from actor_id
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
  where t.id = $2 and t.company_id = company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;

  if $3 < (
    select v.current_odometer_km from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = company_id
  ) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.odometer_entries (
    id, company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    $1, company_id, trip_row.vehicle_id, $2, $3, $4, $5,
    'driver_app', actor_id, $6, $7
  ) returning * into result;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $3)
  where v.id = trip_row.vehicle_id and v.company_id = company_id;
  return result;
end;
$$;

create or replace function public.record_expense(
  p_id uuid, p_trip_id uuid, p_category_id uuid, p_supplier_id uuid,
  p_incurred_at timestamptz, p_amount numeric, p_currency char(3),
  p_receipt_type text, p_receipt_number text, p_receipt_file_id uuid,
  p_description text, p_source_device_id text, p_idempotency_key uuid
)
returns public.expenses
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
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
    hashtextextended(company_id::text || ':expense:' || $13::text, 0)
  );
  select * into result
  from public.expenses e
  where e.company_id = company_id and e.idempotency_key = $13;
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
      or result.created_by is distinct from actor_id
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
  where t.id = $2 and t.company_id = company_id;
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
    $1, company_id, 'trip', $2, trip_row.vehicle_id, effective_driver_id,
    $3, $4, $5, $6, normalized_currency, $8,
    $9, $10, $11, 'driver_app', 'pending_review',
    actor_id, $12, $13
  ) returning * into result;
  return result;
end;
$$;

create or replace function public.record_fuel_entry(
  p_id uuid, p_trip_id uuid, p_supplier_id uuid, p_fueled_at timestamptz,
  p_location text, p_odometer_km numeric, p_quantity numeric, p_volume_unit text,
  p_unit_price numeric, p_total_amount numeric, p_currency char(3),
  p_payment_method text, p_receipt_type text, p_receipt_number text,
  p_receipt_file_id uuid, p_source_device_id text, p_idempotency_key uuid
)
returns public.fuel_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
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
    hashtextextended(company_id::text || ':fuel:' || $17::text, 0)
  );
  select * into result
  from public.fuel_entries f
  where f.company_id = company_id and f.idempotency_key = $17;
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
      or result.created_by is distinct from actor_id
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
  where t.id = $2 and t.company_id = company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;
  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = company_id
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
    $1, company_id, $2, trip_row.vehicle_id, effective_driver_id, $3, $4,
    $5, $6, $7, $8, $9, $10,
    normalized_currency, $12, $13, $14, $15,
    'pending_review', actor_id, $16, $17
  ) returning * into result;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'driver_app', actor_id, $16, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = company_id;
  return result;
end;
$$;

create or replace function public.report_incident(
  p_id uuid, p_trip_id uuid, p_occurred_at timestamptz, p_location text,
  p_incident_type text, p_severity public.incident_severity, p_description text,
  p_action_taken text, p_estimated_cost numeric, p_file_id uuid,
  p_source_device_id text, p_idempotency_key uuid
)
returns public.incidents
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.incidents;
  effective_driver_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $12 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(company_id::text || ':incident:' || $12::text, 0)
  );
  select * into result
  from public.incidents i
  where i.company_id = company_id and i.idempotency_key = $12;
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
      or result.created_by is distinct from actor_id
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
  where t.id = $2 and t.company_id = company_id;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;

  insert into public.incidents (
    id, company_id, trip_id, vehicle_id, driver_id, occurred_at, location,
    incident_type, severity, description, action_taken, status, estimated_cost,
    file_id, created_by, source_device_id, idempotency_key
  ) values (
    $1, company_id, $2, trip_row.vehicle_id, effective_driver_id, $3, $4,
    $5, $6, $7, $8, 'open', $9,
    $10, actor_id, $11, $12
  ) returning * into result;
  return result;
end;
$$;

revoke all on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) from public, anon;
revoke all on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) from public, anon;
revoke all on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) from public, anon;
revoke all on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) from public, anon;

grant execute on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) to authenticated, service_role;
grant execute on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) to authenticated, service_role;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) to authenticated, service_role;
