-- P1 finance controls: staff may transcribe trip activity online with an
-- accountable reason, while driver/offline activity remains on its existing
-- command surface. A settlement closure is the financial boundary for both
-- expenses and fuel, and trip advances are operating funds to be rendered.

-- Staff must use the audited representation commands below. Drivers retain
-- their dedicated insert policy for offline synchronization.
drop policy if exists expenses_staff_append on public.expenses;
drop policy if exists fuel_entries_staff_append on public.fuel_entries;
drop policy if exists expenses_staff_update on public.expenses;
drop policy if exists fuel_staff_update on public.fuel_entries;
revoke update on table public.expenses, public.fuel_entries from authenticated;

-- Fuel was not covered by the expense-only closure guard. Mirror its lock
-- discipline so a concurrent closure serializes before any fuel mutation.
create or replace function private.prevent_closed_fuel_entry_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_status public.settlement_status;
  source_company_id uuid;
  source_trip_id uuid;
begin
  if tg_op = 'INSERT' then
    source_company_id := new.company_id;
    source_trip_id := new.trip_id;
  else
    source_company_id := old.company_id;
    source_trip_id := old.trip_id;
  end if;

  if source_trip_id is not null then
    select s.status into locked_status
    from public.settlements s
    where s.company_id = source_company_id
      and s.trip_id = source_trip_id
    for key share;

    if found and locked_status = 'closed' then
      raise exception using
        errcode = '55000',
        message = 'Fuel entry for a closed settlement is immutable';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (new.company_id, new.trip_id) is distinct from (old.company_id, old.trip_id)
     and new.trip_id is not null then
    locked_status := null;
    select s.status into locked_status
    from public.settlements s
    where s.company_id = new.company_id
      and s.trip_id = new.trip_id
    for key share;

    if found and locked_status = 'closed' then
      raise exception using
        errcode = '55000',
        message = 'Fuel entry cannot be moved into a closed settlement';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists fuel_entries_closed_guard on public.fuel_entries;

create trigger fuel_entries_closed_guard
before insert or update or delete on public.fuel_entries
for each row execute function private.prevent_closed_fuel_entry_mutation();

revoke all on function private.prevent_closed_fuel_entry_mutation()
  from public, anon, authenticated, service_role;

-- Keep the driver/offline commands driver-only. Staff activity needs a reason
-- and must use the explicit representation commands below instead.
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
  current_driver_id uuid := private.current_driver_id();
  normalized_currency char(3) := upper($7::text)::char(3);
begin
  perform private.assert_role(array['driver']::public.app_role[]);
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
      or result.source_device_id is distinct from $12 then
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

  insert into public.expenses (
    id, company_id, assignment_type, trip_id, vehicle_id, driver_id,
    category_id, supplier_id, incurred_at, amount, currency, receipt_type,
    receipt_number, receipt_file_id, description, source, validation_status,
    created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, 'trip', $2, trip_row.vehicle_id,
    current_driver_id, $3, $4, $5, $6, normalized_currency, $8,
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
  current_driver_id uuid := private.current_driver_id();
  current_vehicle_odometer numeric(14,2);
  normalized_currency char(3) := upper($11::text)::char(3);
begin
  perform private.assert_role(array['driver']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if $6 is null or $6 = 'NaN'::numeric or $6 < 0 then
    raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative';
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
      or result.source_device_id is distinct from $16 then
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
  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $6 < current_vehicle_odometer
    and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, current_driver_id,
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

create function public.record_staff_trip_expense(
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
  p_reason text,
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
  normalized_reason text := nullif(trim($12), '');
  normalized_currency char(3) := upper(trim($7::text))::char(3);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $1 is null or $13 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A staff representation reason is required';
  end if;
  if $5 is null then
    raise exception using errcode = '23514', message = 'Expense occurrence time is required';
  end if;
  if $6 is null or $6 = 'NaN'::numeric or $6 <= 0 then
    raise exception using errcode = '23514', message = 'Expense amount must be finite and positive';
  end if;
  if coalesce(trim($7::text), '') !~ '^[A-Za-z]{3}$' then
    raise exception using errcode = '23514', message = 'Expense currency must be a three-letter code';
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
      or result.source is distinct from 'staff_representative'
      or result.created_by is distinct from current_actor_id
      or not exists (
        select 1
        from public.audit_events a
        where a.company_id = current_company_id
          and a.entity_type = 'expense'
          and a.entity_id = result.id
          and a.action = 'STAFF_TRIP_EXPENSE_RECORDED'
          and a.actor_id is not distinct from current_actor_id
          and a.reason is not distinct from normalized_reason
      ) then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;

  -- The closure and reopening commands take this same trip lock before their
  -- settlement lock. That keeps a late registration and a financial close in
  -- one deterministic order.
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.operational_status not in ('scheduled','loading','in_transit','unloading','completed') then
    raise exception using errcode = '23514', message = 'Staff expense registration is allowed only from scheduling through completion';
  end if;
  if trip_row.driver_id is null then
    raise exception using errcode = '23514', message = 'Trip has no assigned driver';
  end if;
  if trip_row.operational_status = 'completed'
     and (trip_row.operational_finished_at is null or $5 > trip_row.operational_finished_at) then
    raise exception using errcode = '22007', message = 'Expense occurrence time cannot be after trip completion';
  end if;

  insert into public.expenses (
    id, company_id, assignment_type, trip_id, vehicle_id, driver_id,
    category_id, supplier_id, incurred_at, amount, currency, receipt_type,
    receipt_number, receipt_file_id, description, source, validation_status,
    created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, 'trip', $2, trip_row.vehicle_id, trip_row.driver_id,
    $3, $4, $5, $6, normalized_currency, $8, $9, $10, $11,
    'staff_representative', 'pending_review', current_actor_id, null, $13
  ) returning * into result;

  perform private.write_audit(
    current_company_id,
    'STAFF_TRIP_EXPENSE_RECORDED',
    'expense',
    result.id,
    null,
    jsonb_build_object(
      'expense', to_jsonb(result),
      'represented_driver_id', trip_row.driver_id
    ),
    normalized_reason
  );
  return result;
end;
$$;

create function public.record_staff_trip_fuel_entry(
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
  p_reason text,
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
  current_vehicle_odometer numeric(14,2);
  normalized_reason text := nullif(trim($16), '');
  normalized_currency char(3) := upper(trim($11::text))::char(3);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A staff representation reason is required';
  end if;
  if $4 is null then
    raise exception using errcode = '23514', message = 'Fuel occurrence time is required';
  end if;
  if $6 is null or $6 = 'NaN'::numeric or $6 < 0 then
    raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative';
  end if;
  if $7 is null or $7 = 'NaN'::numeric or $7 <= 0 then
    raise exception using errcode = '23514', message = 'Fuel quantity must be finite and positive';
  end if;
  if $9 is null or $9 = 'NaN'::numeric or $9 < 0 then
    raise exception using errcode = '23514', message = 'Fuel unit price must be finite and non-negative';
  end if;
  if $10 is null or $10 = 'NaN'::numeric or $10 <= 0 then
    raise exception using errcode = '23514', message = 'Fuel total amount must be finite and positive';
  end if;
  if $8 not in ('gallon','liter') then
    raise exception using errcode = '23514', message = 'Fuel volume unit is invalid';
  end if;
  if coalesce(trim($11::text), '') !~ '^[A-Za-z]{3}$' then
    raise exception using errcode = '23514', message = 'Fuel currency must be a three-letter code';
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
      or not exists (
        select 1
        from public.audit_events a
        where a.company_id = current_company_id
          and a.entity_type = 'fuel_entry'
          and a.entity_id = result.id
          and a.action = 'STAFF_TRIP_FUEL_RECORDED'
          and a.actor_id is not distinct from current_actor_id
          and a.reason is not distinct from normalized_reason
      ) then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;

  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.operational_status not in ('scheduled','loading','in_transit','unloading','completed') then
    raise exception using errcode = '23514', message = 'Staff fuel registration is allowed only from scheduling through completion';
  end if;
  if trip_row.vehicle_id is null or trip_row.driver_id is null then
    raise exception using errcode = '23514', message = 'Trip needs an assigned vehicle and driver';
  end if;
  if trip_row.operational_status = 'completed'
     and (trip_row.operational_finished_at is null or $4 > trip_row.operational_finished_at) then
    raise exception using errcode = '22007', message = 'Fuel occurrence time cannot be after trip completion';
  end if;

  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  -- A staff registration against a completed trip can represent omitted,
  -- historical evidence. It must not regress the vehicle master, but a lower
  -- historical reading remains valid evidence for the trip.
  if $6 < current_vehicle_odometer
     and trip_row.operational_status <> 'completed'
     and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, trip_row.driver_id,
    $3, $4, $5, $6, $7, $8, $9, $10, normalized_currency, $12, $13,
    $14, $15, 'pending_review', current_actor_id, null, $17
  ) returning * into result;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'staff_representative', current_actor_id, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;

  perform private.write_audit(
    current_company_id,
    'STAFF_TRIP_FUEL_RECORDED',
    'fuel_entry',
    result.id,
    null,
    jsonb_build_object(
      'fuel_entry', to_jsonb(result),
      'represented_driver_id', trip_row.driver_id
    ),
    normalized_reason
  );
  return result;
end;
$$;

-- Closure and reopening lock the trip first, matching the staff commands.
-- This prevents a late representation registration from racing a close into
-- an impossible post-close insert, without creating a lock-order cycle.
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
  target_trip_id uuid;
  old_settlement public.settlements;
  new_settlement public.settlements;
  trip_row public.trips;
  old_advance public.advances;
  new_advance public.advances;
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
  calculated_balance numeric(14,2);
  clean_method text := nullif(trim($2), '');
  clean_reference text := nullif(trim($3), '');
  clean_note text := nullif(trim($4), '');
  calculated_direction text;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);

  select s.trip_id into target_trip_id
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = target_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement trip not found';
  end if;
  select * into old_settlement
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id
  for update;
  if not found or old_settlement.trip_id is distinct from target_trip_id then
    raise exception using errcode = '40001', message = 'Settlement scope changed concurrently; retry the closure';
  end if;
  if old_settlement.status = 'closed' then
    return old_settlement;
  end if;
  if old_settlement.status not in ('pending','under_review','observed','approved') then
    raise exception using errcode = '23514', message = 'Settlement cannot be closed in its current state';
  end if;
  if trip_row.operational_status <> 'completed' or trip_row.operational_finished_at is null then
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

  for old_advance in
    select a.*
    from public.advances a
    where a.company_id = current_company_id
      and a.trip_id = old_settlement.trip_id
      and a.status not in ('cancelled','settled')
    for update
  loop
    update public.advances a
    set status = 'settled'
    where a.company_id = current_company_id and a.id = old_advance.id
    returning * into new_advance;
    perform private.write_audit(
      current_company_id,
      'OPERATING_FUND_SETTLED',
      'advance',
      old_advance.id,
      to_jsonb(old_advance),
      to_jsonb(new_advance),
      format('Settlement %s closed', old_settlement.id)
    );
  end loop;

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

create or replace function public.reopen_settlement(settlement_id uuid, reason text)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  target_trip_id uuid;
  trip_row public.trips;
  old_row public.settlements;
  new_row public.settlements;
  normalized_reason text := nullif(trim($2), '');
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A reason is required';
  end if;

  select s.trip_id into target_trip_id
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = target_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement trip not found';
  end if;
  select * into old_row
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id
  for update;
  if not found or old_row.trip_id is distinct from target_trip_id then
    raise exception using errcode = '40001', message = 'Settlement scope changed concurrently; retry the reopening';
  end if;
  if old_row.status <> 'closed' then
    raise exception using errcode = '23514', message = 'Only a closed settlement can be reopened';
  end if;

  update public.settlements s
  set status = 'under_review',
      approved_at = null,
      approved_by = null,
      closed_at = null,
      resolution_method = null,
      resolution_reference = null,
      resolution_note = null,
      resolution_direction = null,
      resolved_amount = null,
      resolved_by = null,
      resolved_at = null,
      version = s.version + 1,
      updated_at = now()
  where s.id = $1 and s.company_id = current_company_id
  returning * into new_row;

  update public.trips t
  set administrative_status = 'settlement_review',
      version = t.version + 1,
      updated_at = now()
  where t.id = old_row.trip_id and t.company_id = current_company_id;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, occurred_at,
    reason, actor_id
  ) values (
    current_company_id, old_row.trip_id, 'administrative',
    trip_row.administrative_status::text, 'settlement_review', now(),
    normalized_reason, auth.uid()
  );
  perform private.write_audit(
    current_company_id,
    'SETTLEMENT_REOPENED',
    'settlement',
    $1,
    to_jsonb(old_row),
    to_jsonb(new_row),
    normalized_reason
  );
  return new_row;
end;
$$;

-- Make the approved operating-fund meaning explicit on the enduring table.
comment on table public.advances is
  'Trip-scoped operating funds that must be rendered through the trip settlement; they are not payroll advances or personal loans.';

-- Existing closed settlements must express the same status invariant after the
-- migration. Cancelled disbursements are deliberately preserved as cancelled.
update public.advances a
set status = 'settled'
from public.settlements s
where s.company_id = a.company_id
  and s.trip_id = a.trip_id
  and s.status = 'closed'
  and a.status not in ('cancelled','settled');

revoke all on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)
  from public, anon, service_role;
revoke all on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  from public, anon, service_role;
revoke all on function public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.close_settlement(uuid,text,text,text)
  from public, anon, service_role;
revoke all on function public.reopen_settlement(uuid,text)
  from public, anon, service_role;

grant execute on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)
  to authenticated;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  to authenticated;
grant execute on function public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)
  to authenticated;
grant execute on function public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  to authenticated;
grant execute on function public.close_settlement(uuid,text,text,text)
  to authenticated;
grant execute on function public.reopen_settlement(uuid,text)
  to authenticated;
