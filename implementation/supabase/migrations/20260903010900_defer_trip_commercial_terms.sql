-- A trip is operational from the vehicle departure, even when the commercial
-- weight or freight quote is not known yet. NULL is the only pending value;
-- zero remains available only for legacy compatibility and is never complete.

alter table public.trips
  add column pickup_location text,
  alter column freight_amount drop default,
  alter column freight_amount drop not null,
  alter column freight_pricing_mode drop default,
  alter column freight_pricing_mode drop not null;

alter table public.trips
  add constraint trips_pickup_location_not_blank check (
    pickup_location is null or length(trim(pickup_location)) > 0
  );

alter table public.trips
  drop constraint trips_freight_pricing_shape;

alter table public.trips
  add constraint trips_freight_pricing_shape check (
    (
      freight_pricing_mode is null
      and freight_amount is null
      and freight_rate_per_ton is null
    )
    or (
      freight_pricing_mode = 'total'
      and freight_amount is not null
      and freight_amount >= 0
      and freight_amount <> 'NaN'::numeric
      and freight_rate_per_ton is null
    )
    or (
      freight_pricing_mode = 'per_ton'
      and freight_rate_per_ton is not null
      and freight_rate_per_ton > 0
      and freight_rate_per_ton <> 'NaN'::numeric
      and (
        freight_amount is null
        or (freight_amount > 0 and freight_amount <> 'NaN'::numeric)
      )
    )
  );

comment on column public.trips.origin is
  'Required place where the vehicle starts the operational trip.';
comment on column public.trips.pickup_location is
  'Optional intermediate place where the initial cargo is collected.';
comment on column public.trips.destination is
  'Required final delivery destination for the operational trip.';
comment on column public.trips.freight_amount is
  'Authoritative freight total. NULL means pending; zero is legacy and is not commercially complete.';
comment on column public.trips.freight_pricing_mode is
  'Commercial pricing source. NULL means that the freight quote is still pending.';

create function public.create_trip_draft(
  p_client_id uuid,
  p_origin text,
  p_pickup_location text,
  p_destination text,
  p_scheduled_at timestamptz,
  p_cargo_description text,
  p_cargo_tons numeric,
  p_freight_pricing_mode public.freight_pricing_mode,
  p_freight_amount numeric,
  p_freight_rate_per_ton numeric
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  client_row public.clients;
  trip_row public.trips;
  load_row public.loads;
  new_trip_id uuid := gen_random_uuid();
  year_part text;
  code_prefix text;
  next_trip_number bigint;
  trip_code text;
  normalized_pickup text := nullif(trim(coalesce(p_pickup_location, '')), '');
  calculated_freight numeric(14,2);
  normalized_rate numeric(14,4);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);

  if p_client_id is null or p_scheduled_at is null then
    raise exception using errcode = '23514', message = 'Client and scheduled time are required';
  end if;
  if length(trim(coalesce(p_origin, ''))) = 0
     or length(trim(coalesce(p_destination, ''))) = 0
     or length(trim(coalesce(p_cargo_description, ''))) = 0 then
    raise exception using errcode = '23514', message = 'Departure, destination, and cargo description are required';
  end if;
  if p_cargo_tons is not null
     and (p_cargo_tons <= 0 or p_cargo_tons = 'NaN'::numeric) then
    raise exception using errcode = '23514', message = 'Cargo tons must be positive when provided';
  end if;

  if p_freight_pricing_mode is null then
    if p_freight_amount is not null or p_freight_rate_per_ton is not null then
      raise exception using errcode = '23514', message = 'Pending freight cannot include an amount or rate';
    end if;
    calculated_freight := null;
    normalized_rate := null;
  elsif p_freight_pricing_mode = 'total' then
    if p_freight_amount is null
       or p_freight_amount <= 0
       or p_freight_amount = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Total freight amount must be positive';
    end if;
    if p_freight_rate_per_ton is not null then
      raise exception using errcode = '23514', message = 'A total freight amount cannot include a rate per ton';
    end if;
    calculated_freight := round(p_freight_amount, 2);
    normalized_rate := null;
  elsif p_freight_pricing_mode = 'per_ton' then
    if p_freight_rate_per_ton is null
       or p_freight_rate_per_ton <= 0
       or p_freight_rate_per_ton = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Freight rate per ton must be positive';
    end if;
    if p_freight_amount is not null then
      raise exception using errcode = '23514', message = 'Per-ton freight is calculated by the server';
    end if;
    normalized_rate := round(p_freight_rate_per_ton, 4);
    calculated_freight := case
      when p_cargo_tons is null then null
      else round(p_cargo_tons * normalized_rate, 2)
    end;
  else
    raise exception using errcode = '23514', message = 'Unsupported freight pricing mode';
  end if;

  select * into client_row
  from public.clients c
  where c.id = p_client_id
    and c.company_id = current_company_id
    and c.active;
  if not found then
    raise exception using errcode = '23514', message = 'An active client from the authenticated company is required';
  end if;

  year_part := extract(year from p_scheduled_at)::integer::text;
  code_prefix := 'RT-' || year_part || '-';
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-code:' || year_part, 0)
  );
  select coalesce(max(substring(t.code from length(code_prefix) + 1)::bigint), 0) + 1
    into next_trip_number
  from public.trips t
  where t.company_id = current_company_id
    and t.code ~ ('^' || code_prefix || '[0-9]+$');
  trip_code := code_prefix || lpad(next_trip_number::text, 4, '0');

  insert into public.trips (
    id, company_id, code, client_id, origin, pickup_location, destination,
    scheduled_at, freight_amount, freight_pricing_mode,
    freight_rate_per_ton, created_by
  ) values (
    new_trip_id, current_company_id, trip_code, client_row.id,
    trim(p_origin), normalized_pickup, trim(p_destination), p_scheduled_at,
    calculated_freight, p_freight_pricing_mode, normalized_rate, actor_id
  ) returning * into trip_row;

  insert into public.loads (company_id, trip_id, description, tons)
  values (current_company_id, new_trip_id, trim(p_cargo_description), p_cargo_tons)
  returning * into load_row;

  perform private.write_audit(
    current_company_id,
    'TRIP_CREATED',
    'trip',
    new_trip_id,
    null,
    jsonb_build_object('trip', to_jsonb(trip_row), 'initial_load', to_jsonb(load_row))
  );
  return trip_row;
end;
$$;

create function public.set_trip_commercial_terms(
  p_trip_id uuid,
  p_load_id uuid,
  p_pickup_location text,
  p_cargo_tons numeric,
  p_freight_pricing_mode public.freight_pricing_mode,
  p_freight_amount numeric,
  p_freight_rate_per_ton numeric,
  p_expected_version integer,
  p_reason text
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
  old_load public.loads;
  new_load public.loads;
  normalized_pickup text := nullif(trim(coalesce(p_pickup_location, '')), '');
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  normalized_rate numeric(14,4);
  normalized_total numeric(14,2);
  projected_load_count bigint;
  projected_missing_tons bigint;
  projected_tons numeric;
  requires_reason boolean := false;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);

  if p_trip_id is null or p_load_id is null then
    raise exception using errcode = '23514', message = 'Trip and load are required';
  end if;
  if p_cargo_tons is not null
     and (p_cargo_tons <= 0 or p_cargo_tons = 'NaN'::numeric) then
    raise exception using errcode = '23514', message = 'Cargo tons must be positive when provided';
  end if;

  if p_freight_pricing_mode is null then
    if p_freight_amount is not null or p_freight_rate_per_ton is not null then
      raise exception using errcode = '23514', message = 'Pending freight cannot include an amount or rate';
    end if;
    normalized_total := null;
    normalized_rate := null;
  elsif p_freight_pricing_mode = 'total' then
    if p_freight_amount is null
       or p_freight_amount <= 0
       or p_freight_amount = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Total freight amount must be positive';
    end if;
    if p_freight_rate_per_ton is not null then
      raise exception using errcode = '23514', message = 'A total freight amount cannot include a rate per ton';
    end if;
    normalized_total := round(p_freight_amount, 2);
    normalized_rate := null;
  elsif p_freight_pricing_mode = 'per_ton' then
    if p_freight_rate_per_ton is null
       or p_freight_rate_per_ton <= 0
       or p_freight_rate_per_ton = 'NaN'::numeric then
      raise exception using errcode = '23514', message = 'Freight rate per ton must be positive';
    end if;
    if p_freight_amount is not null then
      raise exception using errcode = '23514', message = 'Per-ton freight is calculated by the server';
    end if;
    normalized_total := null;
    normalized_rate := round(p_freight_rate_per_ton, 4);
  else
    raise exception using errcode = '23514', message = 'Unsupported freight pricing mode';
  end if;

  select * into old_trip
  from public.trips t
  where t.id = p_trip_id
    and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;

  select * into old_load
  from public.loads l
  where l.id = p_load_id
    and l.trip_id = old_trip.id
    and l.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip load not found';
  end if;

  select
    count(*),
    count(*) filter (
      where (case when l.id = old_load.id then p_cargo_tons else l.tons end) is null
    ),
    sum(case when l.id = old_load.id then p_cargo_tons else l.tons end)
  into projected_load_count, projected_missing_tons, projected_tons
  from public.loads l
  where l.company_id = current_company_id
    and l.trip_id = old_trip.id;

  if p_freight_pricing_mode = 'per_ton'
     and projected_load_count > 0
     and projected_missing_tons = 0 then
    normalized_total := round(projected_tons * normalized_rate, 2);
  end if;

  -- Exact retries are harmless even if another trip field advanced the version.
  if old_trip.pickup_location is not distinct from normalized_pickup
     and old_load.tons is not distinct from p_cargo_tons
     and old_trip.freight_pricing_mode is not distinct from p_freight_pricing_mode
     and old_trip.freight_amount is not distinct from normalized_total
     and old_trip.freight_rate_per_ton is not distinct from normalized_rate then
    return old_trip;
  end if;

  if p_expected_version is null or old_trip.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Trip changed while updating commercial terms';
  end if;
  if old_trip.operational_status = 'cancelled' then
    raise exception using errcode = '55000', message = 'Cancelled trip commercial terms cannot be changed';
  end if;
  if exists (
    select 1
    from public.invoices i
    where i.company_id = current_company_id
      and i.trip_id = old_trip.id
      and i.status <> 'cancelled'
  ) then
    raise exception using errcode = '55000', message = 'Active invoice locks trip commercial terms';
  end if;

  requires_reason :=
    (old_trip.pickup_location is not null and old_trip.pickup_location is distinct from normalized_pickup)
    or (old_load.tons is not null and old_load.tons is distinct from p_cargo_tons)
    or (
      old_trip.freight_pricing_mode is not null
      and old_trip.freight_pricing_mode is distinct from p_freight_pricing_mode
    )
    or (
      old_trip.freight_pricing_mode = 'total'
      and old_trip.freight_amount is not null
      and old_trip.freight_amount is distinct from normalized_total
    )
    or (
      old_trip.freight_rate_per_ton is not null
      and old_trip.freight_rate_per_ton is distinct from normalized_rate
    );
  if requires_reason and normalized_reason is null then
    raise exception using errcode = '23514', message = 'A reason is required to correct commercial terms';
  end if;

  update public.loads l
  set tons = p_cargo_tons,
      updated_at = now()
  where l.id = old_load.id
    and l.company_id = current_company_id
  returning * into new_load;

  update public.trips t
  set pickup_location = normalized_pickup,
      freight_pricing_mode = p_freight_pricing_mode,
      freight_amount = normalized_total,
      freight_rate_per_ton = normalized_rate,
      version = t.version + 1,
      updated_at = now()
  where t.id = old_trip.id
    and t.company_id = current_company_id
  returning * into new_trip;

  perform private.write_audit(
    current_company_id,
    'TRIP_COMMERCIAL_TERMS_UPDATED',
    'trip',
    old_trip.id,
    jsonb_build_object('trip', to_jsonb(old_trip), 'load', to_jsonb(old_load)),
    jsonb_build_object('trip', to_jsonb(new_trip), 'load', to_jsonb(new_load)),
    normalized_reason
  );
  return new_trip;
end;
$$;

-- Initial load and commercial mutations are authoritative commands only.
revoke insert on table public.trips from authenticated;
revoke insert, update on table public.loads from authenticated;
drop policy if exists trips_staff_insert on public.trips;
drop policy if exists loads_staff_insert on public.loads;
drop policy if exists loads_staff_update on public.loads;

revoke all on function public.create_trip_draft(uuid,text,text,text,timestamptz,text,numeric,public.freight_pricing_mode,numeric,numeric)
  from public, anon;
grant execute on function public.create_trip_draft(uuid,text,text,text,timestamptz,text,numeric,public.freight_pricing_mode,numeric,numeric)
  to authenticated, service_role;
revoke all on function public.set_trip_commercial_terms(uuid,uuid,text,numeric,public.freight_pricing_mode,numeric,numeric,integer,text)
  from public, anon;
grant execute on function public.set_trip_commercial_terms(uuid,uuid,text,numeric,public.freight_pricing_mode,numeric,numeric,integer,text)
  to authenticated, service_role;

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
  if $7 is null or $7 <= 0 or $7 = 'NaN'::numeric then
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
  if trip_row.freight_pricing_mode is null
     or trip_row.freight_amount is null
     or trip_row.freight_amount <= 0
     or not exists (
       select 1 from public.loads l
       where l.company_id = current_company_id and l.trip_id = trip_row.id
     )
     or exists (
       select 1 from public.loads l
       where l.company_id = current_company_id
         and l.trip_id = trip_row.id
         and l.tons is null
     ) then
    raise exception using errcode = '23514', message = 'Trip weight and freight must be complete before invoicing';
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
  if $7 is null or $8 is null
     or $7 = 'NaN'::numeric or $8 = 'NaN'::numeric
     or $7 < 0 or $8 < 0 or invoice_total <= 0 then
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
  if trip_row.freight_pricing_mode is null
     or trip_row.freight_amount is null
     or trip_row.freight_amount <= 0
     or not exists (
       select 1 from public.loads l
       where l.company_id = current_company_id and l.trip_id = trip_row.id
     )
     or exists (
       select 1 from public.loads l
       where l.company_id = current_company_id
         and l.trip_id = trip_row.id
         and l.tons is null
     ) then
    raise exception using errcode = '23514', message = 'Trip weight and freight must be complete before invoicing';
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

-- Keep the established column order and append new facts so dependent views
-- remain valid while callers can distinguish incomplete commercial records.
create or replace view public.report_trip_facts
with (security_invoker = true) as
select
  t.company_id, t.id as trip_id, t.code as trip_code, t.cycle_id, t.client_id, c.legal_name as client_name,
  t.vehicle_id, v.plate as vehicle_plate, t.driver_id, d.display_name as driver_name, t.route_id,
  t.origin, t.destination, t.started_at, t.operational_finished_at, t.operational_status,
  t.administrative_status, t.financial_status, t.currency,
  case
    when t.freight_pricing_mode is not null
      and t.freight_amount is not null
      and t.freight_amount > 0
      and load_totals.load_count > 0
      and load_totals.missing_tons = 0
    then t.freight_amount + t.additional_amount
  end as contracted_revenue,
  case
    when load_totals.load_count > 0 and load_totals.missing_tons = 0
    then load_totals.tons
  end as tons,
  load_totals.missing_tons,
  odo.start_km, odo.final_km,
  case when odo.start_km is not null and odo.final_km >= odo.start_km then odo.final_km - odo.start_km end as completed_distance_km,
  fuel_totals.fuel_cost, expense_totals.expense_cost,
  coalesce(fuel_totals.has_currency_mismatch, false) or coalesce(expense_totals.has_currency_mismatch, false) as has_currency_mismatch,
  case when not (coalesce(fuel_totals.has_currency_mismatch, false) or coalesce(expense_totals.has_currency_mismatch, false))
    then coalesce(fuel_totals.fuel_cost, 0) + coalesce(expense_totals.expense_cost, 0) end as direct_cost,
  settlement.closed_at is not null as settlement_closed,
  coalesce(fuel_totals.pending_cost_records, 0) + coalesce(expense_totals.pending_cost_records, 0) as pending_cost_records,
  t.pickup_location,
  (
    t.freight_pricing_mode is not null
    and t.freight_amount is not null
    and t.freight_amount > 0
    and load_totals.load_count > 0
    and load_totals.missing_tons = 0
  ) as commercial_terms_complete
from public.trips t
join public.vehicles v on v.company_id = t.company_id and v.id = t.vehicle_id
join public.clients c on c.company_id = t.company_id and c.id = t.client_id
left join public.drivers d on d.company_id = t.company_id and d.id = t.driver_id
left join lateral (
  select
    count(*) as load_count,
    sum(l.tons) filter (where l.tons is not null) as tons,
    count(*) filter (where l.tons is null) as missing_tons
  from public.loads l
  where l.company_id = t.company_id and l.trip_id = t.id
) load_totals on true
left join lateral (select min(o.reading_km) filter (where o.reading_type = 'start') as start_km, max(o.reading_km) filter (where o.reading_type = 'final') as final_km from public.odometer_entries o where o.company_id = t.company_id and o.trip_id = t.id) odo on true
left join lateral (select sum(f.total_amount) filter (where f.validation_status = 'validated' and f.currency = t.currency) as fuel_cost, bool_or(f.validation_status = 'validated' and f.currency <> t.currency) as has_currency_mismatch, count(*) filter (where f.validation_status <> 'validated') as pending_cost_records from public.fuel_entries f where f.company_id = t.company_id and f.trip_id = t.id) fuel_totals on true
left join lateral (select sum(coalesce(e.approved_amount, e.amount)) filter (where e.validation_status = 'validated' and e.currency = t.currency) as expense_cost, bool_or(e.validation_status = 'validated' and e.currency <> t.currency) as has_currency_mismatch, count(*) filter (where e.validation_status <> 'validated') as pending_cost_records from public.expenses e where e.company_id = t.company_id and e.trip_id = t.id) expense_totals on true
left join lateral (select s.closed_at from public.settlements s where s.company_id = t.company_id and s.trip_id = t.id and s.status = 'closed' order by s.closed_at desc nulls last limit 1) settlement on true
where (select private.is_staff());
