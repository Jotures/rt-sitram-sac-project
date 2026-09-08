-- Fast Cusco-Cusco operations. This migration is additive and keeps trip-scoped
-- historical rows valid while allowing a complete departure to exist before
-- the first commercial service is known.

alter table public.operational_cycles
  add column if not exists capture_channel text not null default 'office';

alter table public.operational_cycles
  add constraint operational_cycles_capture_channel_check
  check (capture_channel in ('office', 'driver_app'));

alter table public.advances
  alter column trip_id drop not null;

alter table public.advances
  add column if not exists cycle_id uuid;

alter table public.advances
  add constraint advances_cycle_fk
  foreign key (company_id, cycle_id)
  references public.operational_cycles (company_id, id)
  on delete restrict;

alter table public.advances
  drop constraint if exists advances_scope_check;

alter table public.advances
  add constraint advances_scope_check
  check (trip_id is not null or cycle_id is not null);

alter table public.expenses
  add column if not exists cycle_id uuid;

alter table public.expenses
  add constraint expenses_cycle_fk
  foreign key (company_id, cycle_id)
  references public.operational_cycles (company_id, id)
  on delete restrict;

alter table public.expenses
  drop constraint if exists expenses_assignment;

alter table public.expenses
  add constraint expenses_assignment check (
    (assignment_type = 'trip' and (trip_id is not null or cycle_id is not null))
    or (assignment_type = 'vehicle' and vehicle_id is not null)
    or assignment_type = 'general'
  );

alter table public.fuel_entries
  add column if not exists cycle_id uuid;

alter table public.fuel_entries
  add column if not exists payment_source text not null default 'company';

alter table public.fuel_entries
  alter column odometer_km drop not null;

alter table public.fuel_entries
  drop constraint if exists fuel_payment_source_check;

alter table public.fuel_entries
  add constraint fuel_payment_source_check
  check (payment_source in ('company', 'driver_fund'));

alter table public.fuel_entries
  add constraint fuel_cycle_fk
  foreign key (company_id, cycle_id)
  references public.operational_cycles (company_id, id)
  on delete restrict;

alter table public.settlements
  alter column trip_id drop not null;

alter table public.settlements
  add column if not exists cycle_id uuid;

alter table public.settlements
  add constraint settlements_cycle_fk
  foreign key (company_id, cycle_id)
  references public.operational_cycles (company_id, id)
  on delete restrict;

alter table public.settlements
  drop constraint if exists settlements_scope_check;

alter table public.settlements
  add constraint settlements_scope_check
  check (trip_id is not null or cycle_id is not null);

create unique index if not exists settlements_company_cycle_unique
  on public.settlements (company_id, cycle_id)
  where cycle_id is not null;

create unique index if not exists operational_cycles_active_vehicle_unique
  on public.operational_cycles (company_id, vehicle_id)
  where vehicle_id is not null and status = 'active';

create unique index if not exists operational_cycles_active_driver_unique
  on public.operational_cycles (company_id, primary_driver_id)
  where primary_driver_id is not null and status = 'active';

create index if not exists advances_cycle_idx on public.advances (company_id, cycle_id, delivered_at);
create index if not exists expenses_cycle_idx on public.expenses (company_id, cycle_id, incurred_at);
create index if not exists fuel_entries_cycle_idx on public.fuel_entries (company_id, cycle_id, fueled_at);
create index if not exists settlements_cycle_status_idx on public.settlements (company_id, cycle_id, status);

-- A cycle settlement must protect the same rows as a trip settlement. The
-- existing trigger only inspected trip_id, so extend it to the new scope.
create or replace function private.prevent_closed_expense_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_status public.settlement_status;
  source_company_id uuid;
  source_trip_id uuid;
  source_cycle_id uuid;
begin
  if tg_op = 'INSERT' then
    source_company_id := new.company_id;
    source_trip_id := new.trip_id;
    source_cycle_id := new.cycle_id;
  else
    source_company_id := old.company_id;
    source_trip_id := old.trip_id;
    source_cycle_id := old.cycle_id;
  end if;

  select s.status into locked_status
  from public.settlements s
  where s.company_id = source_company_id
    and ((source_trip_id is not null and s.trip_id = source_trip_id)
      or (source_cycle_id is not null and s.cycle_id = source_cycle_id))
  for key share;

  if found and locked_status = 'closed' then
    raise exception using errcode = '55000', message = 'Expense belongs to a closed settlement';
  end if;

  if tg_op = 'UPDATE'
     and (new.company_id, new.trip_id, new.cycle_id) is distinct from
         (old.company_id, old.trip_id, old.cycle_id) then
    select s.status into locked_status
    from public.settlements s
    where s.company_id = new.company_id
      and ((new.trip_id is not null and s.trip_id = new.trip_id)
        or (new.cycle_id is not null and s.cycle_id = new.cycle_id))
    for key share;
    if found and locked_status = 'closed' then
      raise exception using errcode = '55000', message = 'Expense cannot be moved into a closed settlement';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  source_cycle_id uuid;
begin
  if tg_op = 'INSERT' then
    source_company_id := new.company_id;
    source_trip_id := new.trip_id;
    source_cycle_id := new.cycle_id;
  else
    source_company_id := old.company_id;
    source_trip_id := old.trip_id;
    source_cycle_id := old.cycle_id;
  end if;

  select s.status into locked_status
  from public.settlements s
  where s.company_id = source_company_id
    and ((source_trip_id is not null and s.trip_id = source_trip_id)
      or (source_cycle_id is not null and s.cycle_id = source_cycle_id))
  for key share;
  if found and locked_status = 'closed' then
    raise exception using errcode = '55000', message = 'Fuel entry belongs to a closed settlement';
  end if;

  if tg_op = 'UPDATE'
     and (new.company_id, new.trip_id, new.cycle_id) is distinct from
         (old.company_id, old.trip_id, old.cycle_id) then
    select s.status into locked_status
    from public.settlements s
    where s.company_id = new.company_id
      and ((new.trip_id is not null and s.trip_id = new.trip_id)
        or (new.cycle_id is not null and s.cycle_id = new.cycle_id))
    for key share;
    if found and locked_status = 'closed' then
      raise exception using errcode = '55000', message = 'Fuel entry cannot be moved into a closed settlement';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.can_access_operational_cycle(target_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.is_staff() or private.is_accounting() then exists (
      select 1 from public.operational_cycles c
      where c.company_id = private.current_company_id() and c.id = target_cycle_id
    )
    else exists (
      select 1 from public.operational_cycles c
      where c.company_id = private.current_company_id()
        and c.id = target_cycle_id
        and c.primary_driver_id = private.current_driver_id()
    )
  end
$$;

revoke all on function private.can_access_operational_cycle(uuid) from public;
grant execute on function private.can_access_operational_cycle(uuid) to authenticated;

-- Generate a code and create a planned or active departure in one command.
-- The existing create_operational_cycle RPC remains available for full detail.
create or replace function public.create_quick_operational_cycle(
  p_id uuid,
  p_vehicle_id uuid,
  p_primary_driver_id uuid,
  p_started_at timestamptz,
  p_status public.operational_cycle_status,
  p_notes text,
  p_idempotency_key uuid
)
returns public.operational_cycles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  result public.operational_cycles;
  generated_code text;
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_vehicle_id is null then
    raise exception using errcode = '23514', message = 'Cycle, vehicle and idempotency IDs are required';
  end if;
  if p_status not in ('planned', 'active') then
    raise exception using errcode = '23514', message = 'Quick departure can only be planned or active';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':quick-cycle:' || p_idempotency_key::text, 0));
  select * into result from public.operational_cycles c
  where c.company_id = current_company_id and c.idempotency_key = p_idempotency_key;
  if found then return result; end if;
  if not exists (select 1 from public.vehicles v where v.company_id = current_company_id and v.id = p_vehicle_id and v.active) then
    raise exception using errcode = '23514', message = 'Cycle vehicle is not active in this company';
  end if;
  if p_primary_driver_id is not null and not exists (select 1 from public.drivers d where d.company_id = current_company_id and d.id = p_primary_driver_id and d.active) then
    raise exception using errcode = '23514', message = 'Cycle primary driver is not active in this company';
  end if;
  generated_code := 'SAL-' || to_char(coalesce(p_started_at, now()) at time zone 'America/Lima', 'YYYYMMDD') || '-' || upper(substr(replace(p_id::text, '-', ''), 1, 6));
  insert into public.operational_cycles (id, company_id, code, vehicle_id, primary_driver_id, status, return_status, started_at, notes, created_by, idempotency_key)
  values (p_id, current_company_id, generated_code, p_vehicle_id, p_primary_driver_id, p_status, 'unidentified', case when p_status = 'active' then coalesce(p_started_at, now()) else null end, normalized_notes, auth.uid(), p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id, 'QUICK_OPERATIONAL_CYCLE_CREATED', 'operational_cycle', result.id, null, to_jsonb(result), null);
  return result;
end;
$$;

create or replace function public.issue_cycle_advance(
  p_id uuid,
  p_cycle_id uuid,
  p_driver_id uuid,
  p_delivered_at timestamptz,
  p_amount numeric,
  p_delivery_method text,
  p_concept text,
  p_idempotency_key uuid
)
returns public.advances
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  result public.advances;
  cycle_row public.operational_cycles;
  normalized_method text := nullif(trim(coalesce(p_delivery_method, '')), '');
  normalized_concept text := nullif(trim(coalesce(p_concept, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_cycle_id is null or p_driver_id is null or p_amount is null or p_amount <= 0 or p_idempotency_key is null or normalized_method is null then
    raise exception using errcode = '23514', message = 'Cycle, driver, method, positive amount and idempotency key are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':cycle-advance:' || p_idempotency_key::text, 0));
  select * into result from public.advances a where a.company_id = current_company_id and a.idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then
    raise exception using errcode = '23514', message = 'Advance driver must be the cycle driver';
  end if;
  if cycle_row.status in ('completed', 'cancelled') then raise exception using errcode = '23514', message = 'Cycle cannot receive an advance in its current state'; end if;
  insert into public.advances (id, company_id, trip_id, cycle_id, driver_id, delivered_at, amount, currency, delivery_method, concept, created_by, idempotency_key)
  values (p_id, current_company_id, null, p_cycle_id, p_driver_id, coalesce(p_delivered_at, now()), p_amount, 'PEN', normalized_method, normalized_concept, auth.uid(), p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id, 'CYCLE_ADVANCE_ISSUED', 'advance', result.id, null, to_jsonb(result), null);
  return result;
end;
$$;

create or replace function public.record_cycle_expense(
  p_id uuid,
  p_cycle_id uuid,
  p_driver_id uuid,
  p_category_id uuid,
  p_incurred_at timestamptz,
  p_amount numeric,
  p_currency char(3),
  p_receipt_type text,
  p_receipt_number text,
  p_receipt_file_id uuid,
  p_description text,
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
  result public.expenses;
  cycle_row public.operational_cycles;
  normalized_currency char(3) := upper(p_currency::text)::char(3);
normalized_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_cycle_id is null or p_driver_id is null or p_category_id is null or p_amount is null or p_amount <= 0 or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Cycle, driver, category, positive amount and idempotency key are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':cycle-expense:' || p_idempotency_key::text, 0));
  select * into result from public.expenses e where e.company_id = current_company_id and e.idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then raise exception using errcode = '23514', message = 'Expense driver must be the cycle driver'; end if;
  if not private.is_staff() and p_driver_id is distinct from private.current_driver_id() then raise exception using errcode = '42501', message = 'Driver can only record activity for the authenticated cycle'; end if;
  if not exists (select 1 from public.expense_categories ec where ec.company_id = current_company_id and ec.id = p_category_id and ec.active) then raise exception using errcode = '23514', message = 'Expense category is not active in this company'; end if;
  insert into public.expenses (id, company_id, assignment_type, trip_id, cycle_id, vehicle_id, driver_id, category_id, incurred_at, amount, currency, receipt_type, receipt_number, receipt_file_id, description, source, validation_status, created_by, idempotency_key)
  values (p_id, current_company_id, 'trip', null, p_cycle_id, cycle_row.vehicle_id, p_driver_id, p_category_id, coalesce(p_incurred_at, now()), p_amount, normalized_currency, nullif(trim(coalesce(p_receipt_type, '')), ''), nullif(trim(coalesce(p_receipt_number, '')), ''), p_receipt_file_id, normalized_description, case when private.is_staff() then 'office_quick' else 'driver_mobile' end, 'pending_review', auth.uid(), p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id, 'CYCLE_EXPENSE_RECORDED', 'expense', result.id, null, to_jsonb(result), null);
  return result;
end;
$$;

create or replace function public.record_cycle_fuel_entry(
  p_id uuid,
  p_cycle_id uuid,
  p_driver_id uuid,
  p_fueled_at timestamptz,
  p_location text,
  p_odometer_km numeric,
  p_quantity numeric,
  p_volume_unit text,
  p_unit_price numeric,
  p_total_amount numeric,
  p_currency char(3),
  p_payment_source text,
  p_payment_method text,
  p_supplier_id uuid,
  p_receipt_type text,
  p_receipt_number text,
  p_receipt_file_id uuid,
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
  result public.fuel_entries;
  cycle_row public.operational_cycles;
  normalized_currency char(3) := upper(p_currency::text)::char(3);
  normalized_source text := lower(trim(coalesce(p_payment_source, '')));
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_cycle_id is null or p_driver_id is null or p_quantity is null or p_quantity <= 0 or p_unit_price is null or p_unit_price < 0 or p_total_amount is null or p_total_amount <= 0 or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Cycle, driver, positive fuel amounts and idempotency key are required';
  end if;
  if normalized_source not in ('company', 'driver_fund') then raise exception using errcode = '23514', message = 'Fuel payment source must be company or driver_fund'; end if;
  if p_odometer_km is not null and (p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric) then raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative'; end if;
  if abs(p_total_amount - round((p_quantity * p_unit_price)::numeric, 2)) > 0.05 then raise exception using errcode = '23514', message = 'Fuel total does not match quantity and unit price'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':cycle-fuel:' || p_idempotency_key::text, 0));
  select * into result from public.fuel_entries f where f.company_id = current_company_id and f.idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then raise exception using errcode = '23514', message = 'Fuel driver must be the cycle driver'; end if;
  if not private.is_staff() and p_driver_id is distinct from private.current_driver_id() then raise exception using errcode = '42501', message = 'Driver can only record activity for the authenticated cycle'; end if;
  insert into public.fuel_entries (id, company_id, trip_id, cycle_id, vehicle_id, driver_id, supplier_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, payment_source, payment_method, receipt_type, receipt_number, receipt_file_id, validation_status, created_by, idempotency_key)
  values (p_id, current_company_id, null, p_cycle_id, cycle_row.vehicle_id, p_driver_id, p_supplier_id, coalesce(p_fueled_at, now()), nullif(trim(coalesce(p_location, '')), ''), p_odometer_km, p_quantity, p_volume_unit, p_unit_price, p_total_amount, normalized_currency, normalized_source, nullif(trim(coalesce(p_payment_method, '')), ''), nullif(trim(coalesce(p_receipt_type, '')), ''), nullif(trim(coalesce(p_receipt_number, '')), ''), p_receipt_file_id, 'pending_review', auth.uid(), p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id, 'CYCLE_FUEL_RECORDED', 'fuel_entry', result.id, null, to_jsonb(result), null);
  return result;
end;
$$;

create or replace function public.create_cycle_settlement(
  p_id uuid,
  p_cycle_id uuid,
  p_driver_id uuid,
  p_notes text
)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  result public.settlements;
  cycle_row public.operational_cycles;
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then raise exception using errcode = '23514', message = 'Settlement driver must be the cycle driver'; end if;
  insert into public.settlements (id, company_id, trip_id, cycle_id, driver_id, notes)
  values (p_id, current_company_id, null, p_cycle_id, p_driver_id, nullif(trim(coalesce(p_notes, '')), ''))
  on conflict (company_id, cycle_id) where cycle_id is not null do update set updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.get_cycle_settlement_snapshot(p_cycle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
  fuel_driver_total numeric(14,2);
  fuel_company_total numeric(14,2);
begin
  perform private.assert_role(array['management', 'administration', 'accounting']::public.app_role[]);
  if not exists (select 1 from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id) then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  select coalesce(sum(amount), 0)::numeric(14,2) into advances_total from public.advances where company_id = current_company_id and cycle_id = p_cycle_id and status <> 'cancelled';
  select coalesce(sum(coalesce(approved_amount, amount)), 0)::numeric(14,2) into expenses_total from public.expenses where company_id = current_company_id and cycle_id = p_cycle_id and validation_status = 'validated';
  select coalesce(sum(total_amount) filter (where payment_source = 'driver_fund'), 0)::numeric(14,2), coalesce(sum(total_amount) filter (where payment_source = 'company'), 0)::numeric(14,2) into fuel_driver_total, fuel_company_total from public.fuel_entries where company_id = current_company_id and cycle_id = p_cycle_id and validation_status = 'validated';
  return jsonb_build_object('cycle_id', p_cycle_id, 'advances', advances_total, 'expenses', expenses_total, 'fuel_driver_fund', fuel_driver_total, 'fuel_company', fuel_company_total, 'driver_fund_spent', expenses_total + fuel_driver_total, 'balance', advances_total - expenses_total - fuel_driver_total);
end;
$$;

create or replace function private.enforce_settlement_expense_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.settlements s
    join public.expenses e
      on e.company_id = s.company_id
     and ((s.trip_id is not null and e.trip_id = s.trip_id)
       or (s.cycle_id is not null and e.cycle_id = s.cycle_id))
    where s.company_id = new.company_id
      and s.id = new.settlement_id
      and e.id = new.expense_id
  ) then
    raise exception using errcode = '23514', message = 'Settlement and expense must share the same trip or operational cycle';
  end if;
  return new;
end;
$$;

drop policy if exists operational_cycles_driver_select on public.operational_cycles;
create policy operational_cycles_driver_select on public.operational_cycles
  for select to authenticated
  using (company_id = (select private.current_company_id()) and primary_driver_id = (select private.current_driver_id()));

drop policy if exists advances_driver_trip_select on public.advances;
create policy advances_driver_trip_select on public.advances
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((trip_id is not null and (select private.can_access_trip(trip_id)))
      or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  );

drop policy if exists expenses_driver_trip_select on public.expenses;
create policy expenses_driver_trip_select on public.expenses
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((trip_id is not null and (select private.can_access_trip(trip_id)))
      or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  );

drop policy if exists fuel_entries_driver_trip_select on public.fuel_entries;
create policy fuel_entries_driver_select on public.fuel_entries
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((trip_id is not null and (select private.can_access_trip(trip_id)))
      or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  );

drop policy if exists settlements_driver_trip_select on public.settlements;
create policy settlements_driver_select on public.settlements
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and ((trip_id is not null and (select private.can_access_trip(trip_id)))
      or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  );

drop policy if exists expenses_driver_insert on public.expenses;
create policy expenses_driver_insert on public.expenses for insert to authenticated with check (
  company_id = (select private.current_company_id()) and created_by = (select auth.uid())
  and driver_id = (select private.current_driver_id())
  and ((trip_id is not null and (select private.can_write_trip_activity(trip_id)))
    or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  and assignment_type = 'trip' and validation_status = 'pending_review' and idempotency_key is not null
);

drop policy if exists fuel_driver_insert on public.fuel_entries;
create policy fuel_driver_insert on public.fuel_entries for insert to authenticated with check (
  company_id = (select private.current_company_id()) and created_by = (select auth.uid())
  and driver_id = (select private.current_driver_id())
  and ((trip_id is not null and (select private.can_write_trip_activity(trip_id)))
    or (cycle_id is not null and (select private.can_access_operational_cycle(cycle_id))))
  and validation_status = 'pending_review' and idempotency_key is not null
);

revoke all on function public.create_quick_operational_cycle(uuid,uuid,uuid,timestamptz,public.operational_cycle_status,text,uuid) from public, anon, service_role;
revoke all on function public.issue_cycle_advance(uuid,uuid,uuid,timestamptz,numeric,text,text,uuid) from public, anon, service_role;
revoke all on function public.create_cycle_settlement(uuid,uuid,uuid,text) from public, anon, service_role;
revoke all on function public.get_cycle_settlement_snapshot(uuid) from public, anon, service_role;
grant execute on function public.create_quick_operational_cycle(uuid,uuid,uuid,timestamptz,public.operational_cycle_status,text,uuid) to authenticated;
grant execute on function public.issue_cycle_advance(uuid,uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated;
revoke all on function public.record_cycle_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char(3),text,text,uuid,text,uuid) from public, anon, service_role;
revoke all on function public.record_cycle_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char(3),text,text,uuid,text,text,uuid,uuid) from public, anon, service_role;
grant execute on function public.record_cycle_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char(3),text,text,uuid,text,uuid) to authenticated;
grant execute on function public.record_cycle_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char(3),text,text,uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.create_cycle_settlement(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.get_cycle_settlement_snapshot(uuid) to authenticated;

comment on column public.operational_cycles.capture_channel is 'Origin of the operational capture; does not replace audit source.';
comment on column public.fuel_entries.payment_source is 'Who funded the fuel: company or the driver fund.';
comment on column public.fuel_entries.odometer_km is 'Optional manual reading; GPS is not inferred when absent.';
