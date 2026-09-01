-- Authoritative reporting facts, explicit load-state events, and vehicle status
-- history. This migration deliberately starts coverage at deployment time; it
-- does not reconstruct facts from pre-existing operational records.

create type public.trip_load_state as enum ('loaded', 'empty');

create table public.trip_load_state_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null,
  vehicle_id uuid not null,
  load_state public.trip_load_state not null,
  effective_at timestamptz not null,
  odometer_km numeric(14,2) not null check (odometer_km >= 0),
  recorded_by uuid not null,
  source_device_id text,
  idempotency_key uuid not null,
  supersedes_event_id uuid,
  correction_reason text,
  created_at timestamptz not null default now(),
  constraint trip_load_state_event_trip_fk foreign key (company_id, trip_id)
    references public.trips (company_id, id) on delete restrict,
  constraint trip_load_state_event_vehicle_fk foreign key (company_id, vehicle_id)
    references public.vehicles (company_id, id) on delete restrict,
  constraint trip_load_state_event_actor_fk foreign key (company_id, recorded_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint trip_load_state_event_supersedes_fk foreign key (company_id, supersedes_event_id)
    references public.trip_load_state_events (company_id, id) on delete restrict,
  constraint trip_load_state_event_idempotency_unique unique (company_id, idempotency_key),
  constraint trip_load_state_event_correction_check check (
    (supersedes_event_id is null and correction_reason is null)
    or (supersedes_event_id is not null and length(trim(coalesce(correction_reason, ''))) > 0)
  ),
  constraint trip_load_state_event_company_id_id_unique unique (company_id, id)
);

create index trip_load_state_events_trip_sequence_idx
  on public.trip_load_state_events (company_id, trip_id, odometer_km, effective_at, created_at);
create index trip_load_state_events_superseded_idx
  on public.trip_load_state_events (company_id, supersedes_event_id)
  where supersedes_event_id is not null;

-- A baseline interval records only the status at deployment. Earlier time is
-- intentionally unknown instead of being fabricated.
alter table public.vehicle_status_history
  alter column recorded_by drop not null;
alter table public.vehicle_status_history
  add column if not exists source text not null default 'system'
    check (source in ('baseline', 'transition', 'manual', 'system'));

update public.vehicle_status_history
set ended_at = started_at
where ended_at is not null and ended_at < started_at;

insert into public.vehicle_status_history (
  company_id, vehicle_id, status, started_at, ended_at, reason, recorded_by, source
)
select v.company_id, v.id, v.current_status, now(), null,
  null, null, 'baseline'
from public.vehicles v
where not exists (
  select 1 from public.vehicle_status_history h
  where h.company_id = v.company_id and h.vehicle_id = v.id and h.ended_at is null
);

create unique index vehicle_status_history_one_open_interval_idx
  on public.vehicle_status_history (company_id, vehicle_id)
  where ended_at is null;
create index vehicle_status_history_report_interval_idx
  on public.vehicle_status_history (company_id, vehicle_id, started_at, ended_at);

create or replace function private.record_vehicle_status_interval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  interval_started_at timestamptz := coalesce(new.updated_at, now());
begin
  if new.current_status is not distinct from old.current_status then
    return new;
  end if;

  update public.vehicle_status_history
  set ended_at = greatest(started_at, interval_started_at)
  where company_id = new.company_id and vehicle_id = new.id and ended_at is null;

  insert into public.vehicle_status_history (
    company_id, vehicle_id, status, started_at, reason, recorded_by, source
  ) values (
    new.company_id, new.id, new.current_status, interval_started_at,
    null, auth.uid(), 'transition'
  );
  return new;
end;
$$;

revoke all on function private.record_vehicle_status_interval() from public;
drop trigger if exists vehicles_status_history_after_update on public.vehicles;
create trigger vehicles_status_history_after_update
  after update of current_status on public.vehicles
  for each row execute function private.record_vehicle_status_interval();

create or replace function private.project_work_order_vehicle_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_status public.vehicle_status;
begin
  if new.blocks_operation and new.status not in ('finished', 'cancelled') then
    target_status := case
      when new.status in ('scheduled', 'waiting_workshop') then 'waiting_workshop'::public.vehicle_status
      when lower(new.maintenance_type) like '%prevent%' then 'preventive_maintenance'::public.vehicle_status
      else 'repair'::public.vehicle_status
    end;
    update public.vehicles
    set current_status = target_status
    where company_id = new.company_id and id = new.vehicle_id and current_status is distinct from target_status;
  elsif not exists (
    select 1 from public.work_orders w
    where w.company_id = new.company_id and w.vehicle_id = new.vehicle_id and w.blocks_operation
      and w.status not in ('finished', 'cancelled')
  ) and not exists (
    select 1 from public.trips t
    where t.company_id = new.company_id and t.vehicle_id = new.vehicle_id
      and t.operational_status in ('scheduled', 'loading', 'in_transit', 'unloading')
  ) then
    update public.vehicles
    set current_status = 'available'
    where company_id = new.company_id and id = new.vehicle_id
      and current_status in ('waiting_workshop', 'preventive_maintenance', 'repair');
  end if;
  return new;
end;
$$;
revoke all on function private.project_work_order_vehicle_status() from public;
drop trigger if exists work_orders_vehicle_status_projection on public.work_orders;
create trigger work_orders_vehicle_status_projection
  after insert or update of status, blocks_operation, maintenance_type on public.work_orders
  for each row execute function private.project_work_order_vehicle_status();

create or replace function public.set_vehicle_operational_status(
  p_vehicle_id uuid,
  p_status public.vehicle_status,
  p_reason text
)
returns public.vehicles language plpgsql volatile security definer set search_path = '' as $$
declare
  current_company_id uuid := private.current_company_id();
  old_vehicle public.vehicles;
  new_vehicle public.vehicles;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A reason is required for a manual vehicle status change';
  end if;
  select * into old_vehicle from public.vehicles
  where vehicles.company_id = current_company_id and id = p_vehicle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Vehicle not found'; end if;
  if old_vehicle.current_status = p_status then
    raise exception using errcode = '23514', message = 'Vehicle already has the requested status';
  end if;
  if exists (
    select 1 from public.trips t
    where t.company_id = current_company_id and t.vehicle_id = p_vehicle_id
      and t.operational_status in ('scheduled', 'loading', 'in_transit', 'unloading')
  ) then
    raise exception using errcode = '23514', message = 'An active trip controls the vehicle status';
  end if;
  if exists (
    select 1 from public.work_orders w
    where w.company_id = current_company_id and w.vehicle_id = p_vehicle_id and w.blocks_operation
      and w.status not in ('finished', 'cancelled')
  ) then
    raise exception using errcode = '23514', message = 'A blocking work order controls the vehicle status';
  end if;

  update public.vehicles
  set current_status = p_status
  where vehicles.company_id = current_company_id and id = p_vehicle_id
  returning * into new_vehicle;
  update public.vehicle_status_history
  set reason = normalized_reason, source = 'manual'
  where vehicle_status_history.company_id = current_company_id and vehicle_id = p_vehicle_id and ended_at is null;
  perform private.write_audit(
    current_company_id, 'VEHICLE_STATUS_MANUALLY_SET', 'vehicle', p_vehicle_id,
    to_jsonb(old_vehicle), to_jsonb(new_vehicle), normalized_reason
  );
  return new_vehicle;
end;
$$;

revoke all on function public.set_vehicle_operational_status(uuid, public.vehicle_status, text) from public;
grant execute on function public.set_vehicle_operational_status(uuid, public.vehicle_status, text) to authenticated;

-- Load-state events are append-only. A correction is a new event that replaces
-- an earlier event in the analytical projection; the original event remains
-- auditable and is never updated or deleted.
create function private.prevent_trip_load_state_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'Trip load state events are append-only';
end;
$$;
revoke all on function private.prevent_trip_load_state_event_mutation() from public;
create trigger trip_load_state_events_append_only
  before update or delete on public.trip_load_state_events
  for each row execute function private.prevent_trip_load_state_event_mutation();

create or replace function public.record_trip_load_state_event(
  p_id uuid,
  p_trip_id uuid,
  p_load_state public.trip_load_state,
  p_effective_at timestamptz,
  p_odometer_km numeric,
  p_source_device_id text,
  p_idempotency_key uuid,
  p_supersedes_event_id uuid default null,
  p_correction_reason text default null
)
returns public.trip_load_state_events language plpgsql volatile security definer set search_path = '' as $$
declare
  current_company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  trip_row public.trips;
  existing_row public.trip_load_state_events;
  superseded_row public.trip_load_state_events;
  result_row public.trip_load_state_events;
  last_odometer numeric;
  last_effective_at timestamptz;
  normalized_reason text := nullif(trim(coalesce(p_correction_reason, '')), '');
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_effective_at is null or p_odometer_km is null or p_odometer_km < 0 then
    raise exception using errcode = '23514', message = 'A valid load-state event requires id, timestamp, odometer and idempotency key';
  end if;
  select * into existing_row from public.trip_load_state_events
  where trip_load_state_events.company_id = current_company_id and idempotency_key = p_idempotency_key;
  if found then return existing_row; end if;
  select * into trip_row from public.trips
  where trips.company_id = current_company_id and id = p_trip_id for update;
  if not found or trip_row.vehicle_id is null then
    raise exception using errcode = 'P0002', message = 'Trip with assigned vehicle not found';
  end if;
  if private.current_app_role() = 'driver' then
    if trip_row.driver_id is distinct from private.current_driver_id()
      or trip_row.operational_status not in ('loading', 'in_transit', 'unloading') then
      raise exception using errcode = '42501', message = 'Driver cannot record load state for this trip';
    end if;
    if p_supersedes_event_id is not null then
      raise exception using errcode = '42501', message = 'Only staff can correct a load-state event';
    end if;
  end if;
  if p_supersedes_event_id is not null then
    if normalized_reason is null then
      raise exception using errcode = '23514', message = 'A correction reason is required';
    end if;
    select * into superseded_row from public.trip_load_state_events
    where trip_load_state_events.company_id = current_company_id and id = p_supersedes_event_id and trip_id = p_trip_id;
    if not found or exists (
      select 1 from public.trip_load_state_events later_event
      where later_event.company_id = current_company_id and later_event.supersedes_event_id = p_supersedes_event_id
    ) then
      raise exception using errcode = '23514', message = 'The load-state event cannot be corrected';
    end if;
    if p_odometer_km <> superseded_row.odometer_km or p_effective_at <> superseded_row.effective_at then
      raise exception using errcode = '23514', message = 'A correction must preserve the original odometer and effective time';
    end if;
  else
    if normalized_reason is not null then
      raise exception using errcode = '23514', message = 'A correction reason requires a superseded event';
    end if;
    select e.odometer_km, e.effective_at into last_odometer, last_effective_at
    from public.trip_load_state_events e
    where e.company_id = current_company_id and e.trip_id = p_trip_id
      and not exists (
        select 1 from public.trip_load_state_events correction
        where correction.company_id = e.company_id and correction.supersedes_event_id = e.id
      )
    order by e.odometer_km desc, e.effective_at desc, e.created_at desc
    limit 1;
    if last_odometer is not null and (p_odometer_km <= last_odometer or p_effective_at < last_effective_at) then
      raise exception using errcode = '23514', message = 'Load-state events must increase odometer and time';
    end if;
  end if;
  if trip_row.started_at is not null and p_effective_at < trip_row.started_at - interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event predates trip start';
  end if;
  if trip_row.operational_finished_at is not null and p_effective_at > trip_row.operational_finished_at + interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event is after trip completion';
  end if;
  insert into public.trip_load_state_events (
    id, company_id, trip_id, vehicle_id, load_state, effective_at, odometer_km,
    recorded_by, source_device_id, idempotency_key, supersedes_event_id, correction_reason
  ) values (
    p_id, current_company_id, p_trip_id, trip_row.vehicle_id, p_load_state, p_effective_at, p_odometer_km,
    actor_id, nullif(trim(coalesce(p_source_device_id, '')), ''), p_idempotency_key,
    p_supersedes_event_id, normalized_reason
  ) returning * into result_row;
  perform private.write_audit(
    current_company_id,
    case when p_supersedes_event_id is null then 'TRIP_LOAD_STATE_RECORDED' else 'TRIP_LOAD_STATE_CORRECTED' end,
    'trip_load_state_event', result_row.id, null, to_jsonb(result_row), normalized_reason
  );
  return result_row;
end;
$$;

revoke all on function public.record_trip_load_state_event(uuid,uuid,public.trip_load_state,timestamptz,numeric,text,uuid,uuid,text) from public;
grant execute on function public.record_trip_load_state_event(uuid,uuid,public.trip_load_state,timestamptz,numeric,text,uuid,uuid,text) to authenticated;
grant execute on function public.record_trip_load_state_event(uuid,uuid,public.trip_load_state,timestamptz,numeric,text,uuid,uuid,text) to service_role;

alter table public.trip_load_state_events enable row level security;
alter table public.trip_load_state_events force row level security;
revoke all on table public.trip_load_state_events from anon, authenticated;
grant all on table public.trip_load_state_events to service_role;
grant select on table public.trip_load_state_events to authenticated;
create policy trip_load_state_events_staff_select on public.trip_load_state_events for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy trip_load_state_events_driver_select on public.trip_load_state_events for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.can_access_trip(trip_id)));

alter publication powersync add table public.trip_load_state_events;
grant select on table public.trip_load_state_events to powersync_role;

-- Operational analytics views are security-invoker views: source-table RLS is
-- retained, and Accounting is not given a path to fleet or margin facts.
create or replace view public.report_trip_facts
with (security_invoker = true) as
select
  t.company_id, t.id as trip_id, t.code as trip_code, t.cycle_id, t.client_id, c.legal_name as client_name,
  t.vehicle_id, v.plate as vehicle_plate, t.driver_id, d.display_name as driver_name, t.route_id,
  t.origin, t.destination, t.started_at, t.operational_finished_at, t.operational_status,
  t.administrative_status, t.financial_status, t.currency,
  coalesce(t.freight_amount, 0) + coalesce(t.additional_amount, 0) as contracted_revenue,
  coalesce(load_totals.tons, 0) as tons, load_totals.missing_tons,
  odo.start_km, odo.final_km,
  case when odo.start_km is not null and odo.final_km >= odo.start_km then odo.final_km - odo.start_km end as completed_distance_km,
  fuel_totals.fuel_cost, expense_totals.expense_cost,
  coalesce(fuel_totals.has_currency_mismatch, false) or coalesce(expense_totals.has_currency_mismatch, false) as has_currency_mismatch,
  case when not (coalesce(fuel_totals.has_currency_mismatch, false) or coalesce(expense_totals.has_currency_mismatch, false))
    then coalesce(fuel_totals.fuel_cost, 0) + coalesce(expense_totals.expense_cost, 0) end as direct_cost,
  settlement.closed_at is not null as settlement_closed,
  coalesce(fuel_totals.pending_cost_records, 0) + coalesce(expense_totals.pending_cost_records, 0) as pending_cost_records
from public.trips t
join public.vehicles v on v.company_id = t.company_id and v.id = t.vehicle_id
join public.clients c on c.company_id = t.company_id and c.id = t.client_id
left join public.drivers d on d.company_id = t.company_id and d.id = t.driver_id
left join lateral (select sum(l.tons) filter (where l.tons is not null) as tons, count(*) filter (where l.tons is null) as missing_tons from public.loads l where l.company_id = t.company_id and l.trip_id = t.id) load_totals on true
left join lateral (select min(o.reading_km) filter (where o.reading_type = 'start') as start_km, max(o.reading_km) filter (where o.reading_type = 'final') as final_km from public.odometer_entries o where o.company_id = t.company_id and o.trip_id = t.id) odo on true
left join lateral (select sum(f.total_amount) filter (where f.validation_status = 'validated' and f.currency = t.currency) as fuel_cost, bool_or(f.validation_status = 'validated' and f.currency <> t.currency) as has_currency_mismatch, count(*) filter (where f.validation_status <> 'validated') as pending_cost_records from public.fuel_entries f where f.company_id = t.company_id and f.trip_id = t.id) fuel_totals on true
left join lateral (select sum(coalesce(e.approved_amount, e.amount)) filter (where e.validation_status = 'validated' and e.currency = t.currency) as expense_cost, bool_or(e.validation_status = 'validated' and e.currency <> t.currency) as has_currency_mismatch, count(*) filter (where e.validation_status <> 'validated') as pending_cost_records from public.expenses e where e.company_id = t.company_id and e.trip_id = t.id) expense_totals on true
left join lateral (select s.closed_at from public.settlements s where s.company_id = t.company_id and s.trip_id = t.id and s.status = 'closed' order by s.closed_at desc nulls last limit 1) settlement on true
where (select private.is_staff());

create or replace view public.report_fuel_facts
with (security_invoker = true) as
select f.company_id, f.id as fuel_entry_id, f.trip_id, f.vehicle_id, v.plate as vehicle_plate,
  f.fueled_at, f.quantity, f.volume_unit, f.total_amount, f.currency, f.validation_status,
  f.odometer_km, t.operational_finished_at, t.completed_distance_km
from public.fuel_entries f
join public.vehicles v on v.company_id = f.company_id and v.id = f.vehicle_id
left join public.report_trip_facts t on t.company_id = f.company_id and t.trip_id = f.trip_id
where (select private.is_staff());

alter table public.work_orders add column if not exists currency char(3) not null default 'PEN';
create or replace view public.report_maintenance_facts
with (security_invoker = true) as
select w.company_id, w.id as work_order_id, w.code, w.vehicle_id, v.plate as vehicle_plate,
  w.status, w.maintenance_type, w.blocks_operation, w.admitted_at, w.started_at, w.finished_at,
  w.currency, w.labor_cost + w.parts_cost as cost,
  case when w.started_at is not null then extract(epoch from (coalesce(w.finished_at, now()) - w.started_at)) / 3600 end as immobilized_hours
from public.work_orders w
join public.vehicles v on v.company_id = w.company_id and v.id = w.vehicle_id
where (select private.is_staff());

create or replace view public.report_collection_facts
with (security_invoker = true) as
select i.company_id, i.id as invoice_id, i.trip_id, i.client_id, c.legal_name as client_name,
  i.series, i.number, i.issued_on, i.due_on, i.currency, i.total, i.status,
  p.id as payment_id, p.paid_at, p.amount as payment_amount, p.cancelled_at, p.currency as payment_currency
from public.invoices i
join public.clients c on c.company_id = i.company_id and c.id = i.client_id
left join public.payments p on p.company_id = i.company_id and p.invoice_id = i.id
where (select private.is_staff()) or (select private.is_accounting());

create or replace view public.report_vehicle_status_intervals
with (security_invoker = true) as
select h.company_id, h.id, h.vehicle_id, v.plate as vehicle_plate, h.status, h.started_at, h.ended_at, h.reason, h.source
from public.vehicle_status_history h
join public.vehicles v on v.company_id = h.company_id and v.id = h.vehicle_id
where (select private.is_staff());

create or replace view public.report_distance_segments
with (security_invoker = true) as
with active_events as (
  select e.* from public.trip_load_state_events e
  where not exists (
    select 1 from public.trip_load_state_events correction
    where correction.company_id = e.company_id and correction.supersedes_event_id = e.id
  )
), ordered_events as (
  select e.*, lead(e.odometer_km) over (partition by e.company_id, e.trip_id order by e.odometer_km, e.effective_at, e.created_at) as next_odometer_km
  from active_events e
)
select e.company_id, e.trip_id, e.vehicle_id, v.plate as vehicle_plate, e.load_state,
  e.odometer_km as start_odometer_km,
  coalesce(e.next_odometer_km, final_reading.reading_km) as end_odometer_km,
  case when coalesce(e.next_odometer_km, final_reading.reading_km) >= e.odometer_km
    then coalesce(e.next_odometer_km, final_reading.reading_km) - e.odometer_km end as kilometres,
  t.operational_finished_at,
  case when coalesce(e.next_odometer_km, final_reading.reading_km) is null then 'missing_end_odometer'
    when coalesce(e.next_odometer_km, final_reading.reading_km) < e.odometer_km then 'inconsistent_odometer'
    else null end as coverage_gap
from ordered_events e
join public.trips t on t.company_id = e.company_id and t.id = e.trip_id
join public.vehicles v on v.company_id = e.company_id and v.id = e.vehicle_id
left join lateral (
  select o.reading_km from public.odometer_entries o
  where o.company_id = e.company_id and o.trip_id = e.trip_id and o.reading_type = 'final'
  order by o.reading_at desc, o.created_at desc limit 1
) final_reading on true
where (select private.is_staff());

grant select on public.report_trip_facts, public.report_fuel_facts, public.report_maintenance_facts,
  public.report_collection_facts, public.report_vehicle_status_intervals, public.report_distance_segments to authenticated;

create index fuel_entries_report_date_idx on public.fuel_entries (company_id, fueled_at, trip_id);
create index work_orders_report_date_idx on public.work_orders (company_id, finished_at, started_at);
create index invoices_report_date_idx on public.invoices (company_id, issued_on, status);
create index payments_report_date_idx on public.payments (company_id, invoice_id, paid_at) where cancelled_at is null;

-- A single server snapshot prevents the chart, table, CSV and PDF from
-- disagreeing because their inputs were fetched at different times.
create or replace function public.get_report_snapshot(
  p_kind text,
  p_from date,
  p_to date,
  p_vehicle_id uuid default null,
  p_route_id uuid default null,
  p_client_id uuid default null,
  p_driver_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  current_company_id uuid := private.current_company_id();
  lower_bound timestamptz := (p_from::timestamp at time zone 'America/Lima');
  upper_bound timestamptz := ((p_to + 1)::timestamp at time zone 'America/Lima');
  data_available_from timestamptz;
  operational_allowed boolean := private.current_app_role() in ('management', 'administration');
  collection_allowed boolean := private.current_app_role() in ('management', 'administration', 'accounting');
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = '22007', message = 'Invalid report period';
  end if;
  if p_kind not in ('OVERVIEW','TRIPS_CARGO','FLEET_UTILIZATION','DOWNTIME','DIRECT_MARGIN','FUEL','EMPTY_KILOMETRES','MAINTENANCE','COLLECTIONS') then
    raise exception using errcode = '22023', message = 'Unsupported report kind';
  end if;
  if p_kind = 'COLLECTIONS' then
    if not collection_allowed then raise exception using errcode = '42501', message = 'Not authorized for collections report'; end if;
  elsif not operational_allowed then
    raise exception using errcode = '42501', message = 'Not authorized for operational report';
  end if;
  select min(h.started_at) into data_available_from
  from public.vehicle_status_history h
  where h.company_id = current_company_id and h.source = 'baseline';
  if data_available_from is null then data_available_from := now(); end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'availableFrom', data_available_from,
    'trips', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_trip_facts r
      where r.company_id = current_company_id and r.operational_status = 'completed'
        and r.operational_finished_at >= greatest(lower_bound, data_available_from) and r.operational_finished_at < upper_bound
        and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
        and (p_route_id is null or r.route_id = p_route_id)
        and (p_client_id is null or r.client_id = p_client_id)
        and (p_driver_id is null or r.driver_id = p_driver_id)
    ) x), '[]'::jsonb),
    'fuel', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_fuel_facts r
      where r.company_id = current_company_id and r.fueled_at >= greatest(lower_bound, data_available_from) and r.fueled_at < upper_bound
        and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
    ) x), '[]'::jsonb),
    'maintenance', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_maintenance_facts r
      where r.company_id = current_company_id
        and coalesce(r.finished_at, r.started_at, r.admitted_at) < upper_bound
        and coalesce(r.finished_at, r.started_at, r.admitted_at) >= greatest(lower_bound, data_available_from)
        and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
    ) x), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_collection_facts r
      where r.company_id = current_company_id
        and r.issued_on >= (data_available_from at time zone 'America/Lima')::date and r.issued_on <= p_to
        and (p_client_id is null or r.client_id = p_client_id)
    ) x), '[]'::jsonb),
    'intervals', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_vehicle_status_intervals r
      where r.company_id = current_company_id and r.started_at < upper_bound and coalesce(r.ended_at, upper_bound) > lower_bound
        and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
    ) x), '[]'::jsonb),
    'segments', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from public.report_distance_segments r
      where r.company_id = current_company_id and r.operational_finished_at >= greatest(lower_bound, data_available_from) and r.operational_finished_at < upper_bound
        and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
    ) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_report_snapshot(text,date,date,uuid,uuid,uuid,uuid) from public;
grant execute on function public.get_report_snapshot(text,date,date,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.get_report_dossier_snapshot(
  p_kinds text[],
  p_from date,
  p_to date,
  p_vehicle_id uuid default null,
  p_route_id uuid default null,
  p_client_id uuid default null,
  p_driver_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare requested_kind text;
begin
  if coalesce(array_length(p_kinds, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'A dossier requires at least one report kind';
  end if;
  foreach requested_kind in array p_kinds loop
    if requested_kind not in ('OVERVIEW','TRIPS_CARGO','FLEET_UTILIZATION','DOWNTIME','DIRECT_MARGIN','FUEL','EMPTY_KILOMETRES','MAINTENANCE','COLLECTIONS') then
      raise exception using errcode = '22023', message = 'Unsupported report kind';
    end if;
  end loop;
  return (
    select jsonb_object_agg(kind, snapshot)
    from (
      select requested.kind,
        public.get_report_snapshot(requested.kind, p_from, p_to, p_vehicle_id, p_route_id, p_client_id, p_driver_id) as snapshot
      from unnest(p_kinds) as requested(kind)
    ) dossier
  );
end;
$$;
revoke all on function public.get_report_dossier_snapshot(text[],date,date,uuid,uuid,uuid,uuid) from public;
grant execute on function public.get_report_dossier_snapshot(text[],date,date,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.record_report_export(
  p_kind text,
  p_format text,
  p_filters jsonb
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  current_company_id uuid := private.current_company_id();
  audit_id uuid := gen_random_uuid();
begin
  if p_format not in ('csv', 'pdf', 'dossier') then
    raise exception using errcode = '22023', message = 'Unsupported report export format';
  end if;
  if p_kind not in ('OVERVIEW','TRIPS_CARGO','FLEET_UTILIZATION','DOWNTIME','DIRECT_MARGIN','FUEL','EMPTY_KILOMETRES','MAINTENANCE','COLLECTIONS') then
    raise exception using errcode = '22023', message = 'Unsupported report export kind';
  end if;
  if private.current_app_role() = 'accounting' and p_kind <> 'COLLECTIONS' then
    raise exception using errcode = '42501', message = 'Accounting may export collections only';
  end if;
  perform private.assert_role(array['management','administration','accounting']::public.app_role[]);
  perform private.write_audit(
    current_company_id, 'REPORT_EXPORTED', 'report_export', audit_id, null,
    jsonb_build_object('kind', p_kind, 'format', p_format, 'filters', coalesce(p_filters, '{}'::jsonb))
  );
  return audit_id;
end;
$$;
revoke all on function public.record_report_export(text,text,jsonb) from public;
grant execute on function public.record_report_export(text,text,jsonb) to authenticated;

create or replace function public.get_report_filter_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare current_company_id uuid := private.current_company_id();
begin
  if private.current_app_role() not in ('management', 'administration', 'accounting') then
    raise exception using errcode = '42501', message = 'Not authorized for report filters';
  end if;
  return jsonb_build_object(
    'vehicles', case when private.current_app_role() in ('management', 'administration') then coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.plate) order by v.plate)
      from public.vehicles v where v.company_id = current_company_id and v.active
    ), '[]'::jsonb) else '[]'::jsonb end,
    'routes', case when private.current_app_role() in ('management', 'administration') then coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'label', r.name) order by r.name)
      from public.routes r where r.company_id = current_company_id and r.active
    ), '[]'::jsonb) else '[]'::jsonb end,
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'label', coalesce(c.trade_name, c.legal_name)) order by coalesce(c.trade_name, c.legal_name))
      from public.clients c where c.company_id = current_company_id and c.active
    ), '[]'::jsonb),
    'drivers', case when private.current_app_role() in ('management', 'administration') then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.display_name) order by d.display_name)
      from public.drivers d where d.company_id = current_company_id and d.active
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.get_report_filter_options() from public;
grant execute on function public.get_report_filter_options() to authenticated;
