-- Ordered, idempotent driver transitions submitted by PowerSync. The request
-- carries no company, actor, driver, status version, or target state chosen by
-- the browser; Auth and the current authoritative state determine all of them.

create table public.trip_transition_requests (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete restrict,
  trip_id uuid not null,
  requested_action text not null check (requested_action in ('start','arrive','complete')),
  odometer_km numeric(14,2) check (odometer_km is null or odometer_km >= 0),
  cargo_delivered boolean not null default false,
  occurred_at timestamptz not null,
  source_device_id text,
  actor_id uuid not null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint transition_requests_trip_fk foreign key (company_id, trip_id)
    references public.trips (company_id, id) on delete restrict,
  constraint transition_requests_actor_fk foreign key (company_id, actor_id)
    references public.profiles (company_id, id) on delete restrict,
  constraint transition_requests_payload check (
    (requested_action = 'arrive' and odometer_km is null and not cargo_delivered)
    or (requested_action = 'start' and odometer_km is not null and not cargo_delivered)
    or (requested_action = 'complete' and odometer_km is not null and cargo_delivered)
  ),
  constraint transition_requests_company_id_id_unique unique (company_id, id)
);

alter table public.trip_transition_requests enable row level security;
alter table public.trip_transition_requests force row level security;
revoke all on table public.trip_transition_requests from anon, authenticated;
grant all on table public.trip_transition_requests to service_role;
grant select on table public.trip_transition_requests to authenticated;

create policy transition_requests_driver_select
on public.trip_transition_requests for select to authenticated
using (
  company_id = (select private.current_company_id())
  and actor_id = (select auth.uid())
);

create policy transition_requests_staff_select
on public.trip_transition_requests for select to authenticated
using (
  company_id = (select private.current_company_id())
  and (select private.is_staff())
);

create function public.apply_driver_trip_transition(
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
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  trip_row public.trips;
  existing_request public.trip_transition_requests;
begin
  perform private.assert_role(array['driver']::public.app_role[]);
  if $1 is null or $2 is null or $6 is null then
    raise exception using errcode = '23514', message = 'Transition ID, trip, and occurrence time are required';
  end if;

  select * into existing_request
  from public.trip_transition_requests r
  where r.id = $1 and r.company_id = company_id;
  if found then
    if existing_request.actor_id is distinct from actor_id
      or existing_request.trip_id is distinct from $2
      or existing_request.requested_action is distinct from $3
      or existing_request.odometer_km is distinct from $4
      or existing_request.cargo_delivered is distinct from coalesce($5,false)
      or existing_request.occurred_at is distinct from $6
      or existing_request.source_device_id is distinct from nullif(trim($7),'')
    then
      raise exception using errcode = '23505', message = 'Transition ID was already used with another payload';
    end if;
    select * into trip_row from public.trips t
      where t.id = existing_request.trip_id and t.company_id = company_id;
    if trip_row.driver_id is distinct from private.current_driver_id() then
      raise exception using errcode = '42501', message = 'Driver is no longer assigned to this trip';
    end if;
    return trip_row;
  end if;

  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = company_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;

  if $3 = 'start' then
    if $4 is null or coalesce($5,false) then
      raise exception using errcode = '23514', message = 'Start requires mileage only';
    end if;
    if trip_row.operational_status = 'scheduled' then
      trip_row := public.transition_trip_operational($2, 'loading', trip_row.version, 'Offline driver request');
    end if;
    if trip_row.operational_status = 'loading' then
      trip_row := public.start_trip($2, $4, trip_row.version, $1);
    elsif trip_row.operational_status <> 'in_transit' then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
  elsif $3 = 'arrive' then
    if $4 is not null or coalesce($5,false) then
      raise exception using errcode = '23514', message = 'Arrival does not accept closure fields';
    end if;
    if trip_row.operational_status = 'in_transit' then
      trip_row := public.transition_trip_operational($2, 'unloading', trip_row.version, 'Offline driver request');
    elsif trip_row.operational_status <> 'unloading' then
      raise exception using errcode = '23514', message = 'Trip is not in transit';
    end if;
  elsif $3 = 'complete' then
    if $4 is null or $5 is distinct from true then
      raise exception using errcode = '23514', message = 'Completion requires final mileage and delivered cargo';
    end if;
    if trip_row.operational_status = 'unloading' then
      trip_row := public.complete_trip($2, $4, trip_row.version, $1, true);
    elsif trip_row.operational_status <> 'completed' then
      raise exception using errcode = '23514', message = 'Trip is not ready to complete';
    end if;
  else
    raise exception using errcode = '22023', message = 'Unsupported transition action';
  end if;

  insert into public.trip_transition_requests (
    id, company_id, trip_id, requested_action, odometer_km,
    cargo_delivered, occurred_at, source_device_id, actor_id
  ) values ($1, company_id, $2, $3, $4, coalesce($5,false), $6, nullif(trim($7),''), actor_id);

  return trip_row;
end;
$$;

revoke all on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) from public;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) to authenticated;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) to service_role;

alter publication powersync add table public.trip_transition_requests;
grant select on table public.trip_transition_requests to powersync_role;
