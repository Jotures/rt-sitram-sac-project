-- A trip always has one accountable capture channel. A linked driver can work
-- offline through the PWA; a staff-assisted trip is recorded online by
-- Administración or Gerencia without impersonating the assigned driver.

create type public.trip_capture_mode as enum ('driver_app', 'staff_assisted');

alter table public.trips
  add column capture_mode public.trip_capture_mode not null default 'driver_app',
  add column capture_mode_changed_at timestamptz not null default now();

-- Existing trips keep the driver channel when it can still resolve a valid
-- driver account. Historical unlinked assignments become office-assisted;
-- the original creation/schedule time deliberately permits pending offline
-- entries that predate this migration.
update public.trips t
set
  capture_mode = case
    when t.driver_id is not null and not exists (
      select 1
      from public.drivers d
      join public.profiles p
        on p.id = d.profile_id
       and p.company_id = d.company_id
      where d.id = t.driver_id
        and d.company_id = t.company_id
        and d.active
        and p.active
        and p.role = 'driver'
    ) then 'staff_assisted'::public.trip_capture_mode
    else 'driver_app'::public.trip_capture_mode
  end,
  capture_mode_changed_at = coalesce(t.created_at, now());

comment on column public.trips.capture_mode is
  'Exclusive operational capture channel: driver_app offline PWA or staff_assisted online representation.';
comment on column public.trips.capture_mode_changed_at is
  'Lower bound for driver-originated occurrences after the latest handoff to the driver app.';

-- The existing activity trigger protects every driver/offline fact table.
-- Staff facts are allowed only while their trip is explicitly office-assisted;
-- post-completion regularisations keep DEC-037 behaviour.
create or replace function private.enforce_trip_activity_scope()
returns trigger language plpgsql set search_path = '' as $$
declare
  payload jsonb := to_jsonb(new);
  target_trip uuid;
  target_vehicle uuid;
  target_driver uuid;
  assigned_vehicle uuid;
  assigned_driver uuid;
  trip_status public.trip_operational_status;
  trip_finished_at timestamptz;
  trip_capture_mode public.trip_capture_mode;
  mode_changed_at timestamptz;
  captured_at timestamptz;
begin
  target_trip := nullif(payload ->> 'trip_id','')::uuid;
  if target_trip is null then return new; end if;
  target_vehicle := nullif(payload ->> 'vehicle_id','')::uuid;
  target_driver := nullif(payload ->> 'driver_id','')::uuid;
  captured_at := coalesce(
    nullif(payload ->> 'reading_at','')::timestamptz,
    nullif(payload ->> 'incurred_at','')::timestamptz,
    nullif(payload ->> 'fueled_at','')::timestamptz,
    nullif(payload ->> 'occurred_at','')::timestamptz
  );
  select t.vehicle_id, t.driver_id, t.operational_status, t.operational_finished_at,
         t.capture_mode, t.capture_mode_changed_at
    into assigned_vehicle, assigned_driver, trip_status, trip_finished_at,
         trip_capture_mode, mode_changed_at
  from public.trips t
  where t.company_id = new.company_id and t.id = target_trip;
  if not found then raise exception using errcode = '23503', message = 'Trip does not belong to the row company'; end if;
  if target_vehicle is not null and target_vehicle is distinct from assigned_vehicle then
    raise exception using errcode = '23514', message = 'Vehicle does not match trip assignment';
  end if;
  if target_driver is not null and target_driver is distinct from assigned_driver then
    raise exception using errcode = '23514', message = 'Driver does not match trip assignment';
  end if;
  if private.current_app_role() = 'driver' and (
    trip_capture_mode <> 'driver_app'
    or captured_at is null
    or captured_at < mode_changed_at
  ) then
    raise exception using errcode = '42501', message = 'Driver capture is disabled because the trip is managed from office or changed channel';
  end if;
  if private.is_staff()
     and trip_status in ('scheduled','loading','in_transit','unloading')
     and trip_capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Staff representation requires a staff-assisted trip';
  end if;
  if trip_status = 'completed' and (captured_at is null or trip_finished_at is null or captured_at > trip_finished_at) then
    raise exception using errcode = '23514', message = 'Late activity must have been captured before trip completion';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_trip_transition_capture_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_row public.trips;
begin
  select * into trip_row
  from public.trips t
  where t.id = new.trip_id and t.company_id = new.company_id;
  if not found then
    raise exception using errcode = '23503', message = 'Transition trip is not available';
  end if;
  if private.current_app_role() = 'driver' and (
    trip_row.capture_mode <> 'driver_app'
    or new.occurred_at < trip_row.capture_mode_changed_at
  ) then
    raise exception using errcode = '42501', message = 'Driver transition belongs to a previous or disabled capture channel';
  end if;
  if private.is_staff() and trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Staff transition requires a staff-assisted trip';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_transition_requests_capture_mode_guard on public.trip_transition_requests;
create trigger trip_transition_requests_capture_mode_guard
before insert on public.trip_transition_requests
for each row execute function private.enforce_trip_transition_capture_mode();

create or replace function private.enforce_trip_load_state_capture_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_row public.trips;
begin
  select * into trip_row
  from public.trips t
  where t.id = new.trip_id and t.company_id = new.company_id;
  if not found then
    raise exception using errcode = '23503', message = 'Load-state trip is not available';
  end if;
  if private.current_app_role() = 'driver' and (
    trip_row.capture_mode <> 'driver_app'
    or new.effective_at < trip_row.capture_mode_changed_at
  ) then
    raise exception using errcode = '42501', message = 'Driver load-state belongs to a previous or disabled capture channel';
  end if;
  if private.is_staff() and trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Staff load-state requires a staff-assisted trip';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_load_state_events_capture_mode_guard on public.trip_load_state_events;
create trigger trip_load_state_events_capture_mode_guard
before insert on public.trip_load_state_events
for each row execute function private.enforce_trip_load_state_capture_mode();

-- The legacy three-argument scheduling adapter remains untouched. It resolves
-- to the old linked-driver-only primitive, so an open old PWA cannot schedule
-- an unlinked driver. The new adapter is explicit about the capture mode.
create function public.schedule_trip(
  p_trip_id uuid,
  p_vehicle_id uuid,
  p_driver_id uuid,
  p_expected_version integer,
  p_capture_mode public.trip_capture_mode
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
  if p_capture_mode is null then
    raise exception using errcode = '23514', message = 'A trip capture mode is required';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'approved' then
    raise exception using errcode = '40001', message = 'Trip changed or is not plannable';
  end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.company_id = current_company_id
      and v.active and v.current_status in ('available','scheduled')
  ) then raise exception using errcode = '23514', message = 'Vehicle is not available'; end if;
  if not exists (
    select 1 from public.drivers d
    where d.id = p_driver_id and d.company_id = current_company_id
      and d.active and d.current_status = 'available'
  ) then raise exception using errcode = '23514', message = 'Driver is not available'; end if;
  if p_capture_mode = 'driver_app' and not exists (
    select 1
    from public.drivers d
    join public.profiles p on p.id = d.profile_id and p.company_id = d.company_id
    where d.id = p_driver_id and d.company_id = current_company_id
      and d.active and p.active and p.role = 'driver'
  ) then
    raise exception using errcode = '23514', message = 'Driver app mode requires an active linked driver profile';
  end if;
  if exists (
    select 1 from public.documents d
    where d.company_id = current_company_id and d.blocks_operation
      and ((d.entity_type = 'vehicle' and d.vehicle_id = p_vehicle_id)
        or (d.entity_type = 'driver' and d.driver_id = p_driver_id))
      and (d.file_id is null or d.status in ('expired','cancelled') or d.expires_on < current_date)
  ) then raise exception using errcode = '23514', message = 'Critical vehicle or driver document blocks scheduling'; end if;
  if exists (
    select 1 from public.work_orders w
    where w.company_id = current_company_id and w.vehicle_id = p_vehicle_id
      and w.blocks_operation and w.status not in ('finished','cancelled')
  ) then raise exception using errcode = '23514', message = 'Blocking maintenance work order prevents scheduling'; end if;
  if exists (
    select 1 from public.trips t
    where t.company_id = current_company_id and t.id <> p_trip_id
      and (t.vehicle_id = p_vehicle_id or t.driver_id = p_driver_id)
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
  ) then raise exception using errcode = '23505', message = 'Vehicle or driver already has an active trip'; end if;
  update public.trips t
  set vehicle_id = p_vehicle_id,
      driver_id = p_driver_id,
      operational_status = 'scheduled',
      capture_mode = p_capture_mode,
      capture_mode_changed_at = now(),
      version = t.version + 1,
      updated_at = now()
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v set current_status = 'scheduled'
  where v.id = p_vehicle_id and v.company_id = current_company_id;
  update public.drivers d set current_status = 'assigned'
  where d.id = p_driver_id and d.company_id = current_company_id;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text, 'scheduled', auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'TRIP_SCHEDULED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip),
    case when p_capture_mode = 'staff_assisted' then 'Scheduled for staff-assisted capture' else null end
  );
  return new_trip;
end;
$$;

create function public.schedule_trip(
  trip_id uuid,
  vehicle_id uuid,
  driver_id uuid,
  capture_mode public.trip_capture_mode
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare trip_row public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into trip_row from public.trips t
  where t.id = $1 and t.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.operational_status = 'scheduled'
     and trip_row.vehicle_id = $2 and trip_row.driver_id = $3
     and trip_row.capture_mode = $4 then return trip_row; end if;
  return public.schedule_trip($1, $2, $3, trip_row.version, $4);
end;
$$;

create function public.change_trip_capture_mode(
  p_trip_id uuid,
  p_capture_mode public.trip_capture_mode,
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
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_capture_mode is null or normalized_reason is null then
    raise exception using errcode = '23514', message = 'A capture mode and handoff reason are required';
  end if;
  select * into old_trip from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if old_trip.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Trip changed while changing capture mode';
  end if;
  if old_trip.operational_status not in ('scheduled','loading','in_transit','unloading') then
    raise exception using errcode = '23514', message = 'Only an active trip can change capture mode';
  end if;
  if old_trip.capture_mode = p_capture_mode then
    raise exception using errcode = '23514', message = 'Choose a different capture mode';
  end if;
  if p_capture_mode = 'driver_app' and not exists (
    select 1 from public.drivers d
    join public.profiles p on p.id = d.profile_id and p.company_id = d.company_id
    where d.id = old_trip.driver_id and d.company_id = current_company_id
      and d.active and p.active and p.role = 'driver'
  ) then
    raise exception using errcode = '23514', message = 'Driver app mode requires an active linked driver profile';
  end if;
  update public.trips t
  set capture_mode = p_capture_mode,
      capture_mode_changed_at = now(),
      version = t.version + 1,
      updated_at = now()
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  perform private.write_audit(
    current_company_id, 'TRIP_CAPTURE_MODE_CHANGED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip), normalized_reason
  );
  return new_trip;
end;
$$;

create function public.record_staff_trip_transition(
  p_request_id uuid,
  p_trip_id uuid,
  p_action text,
  p_odometer_km numeric,
  p_cargo_delivered boolean,
  p_occurred_at timestamptz,
  p_load_state public.trip_load_state,
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
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  old_trip public.trips;
  existing_request public.trip_transition_requests;
  arrival_at timestamptz;
  current_vehicle_odometer numeric(14,2);
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_request_id is null or p_trip_id is null or p_occurred_at is null or normalized_reason is null then
    raise exception using errcode = '23514', message = 'Staff transition needs ID, trip, occurrence time and reason';
  end if;
  if p_occurred_at > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;
  if p_odometer_km is not null and (p_odometer_km = 'NaN'::numeric or p_odometer_km < 0) then
    raise exception using errcode = '23514', message = 'Transition odometer must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':trip-transition:' || p_request_id::text, 0));
  select * into existing_request from public.trip_transition_requests r
  where r.id = p_request_id and r.company_id = current_company_id;
  if found then
    if existing_request.actor_id is distinct from current_actor_id
       or existing_request.trip_id is distinct from p_trip_id
       or existing_request.requested_action is distinct from p_action
       or existing_request.odometer_km is distinct from p_odometer_km::numeric(14,2)
       or existing_request.cargo_delivered is distinct from coalesce(p_cargo_delivered, false)
       or existing_request.occurred_at is distinct from p_occurred_at then
      raise exception using errcode = '23505', message = 'Transition ID was already used';
    end if;
    select * into trip_row from public.trips t
    where t.id = existing_request.trip_id and t.company_id = current_company_id;
    return trip_row;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Trip changed while recording its operation';
  end if;
  if trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Staff transition requires a staff-assisted trip';
  end if;
  old_trip := trip_row;
  if p_action = 'start' then
    if p_odometer_km is null or coalesce(p_cargo_delivered, false) or p_load_state is null then
      raise exception using errcode = '23514', message = 'Start requires mileage and load state';
    end if;
    if trip_row.operational_status not in ('scheduled','loading') or trip_row.vehicle_id is null or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v where v.id = trip_row.vehicle_id and v.company_id = current_company_id for update;
    if p_odometer_km < current_vehicle_odometer
       and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    update public.trips t set operational_status = 'in_transit', started_at = p_occurred_at,
      version = t.version + case when trip_row.operational_status = 'scheduled' then 2 else 1 end,
      updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    update public.vehicles v set current_status = 'in_trip', current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
      values
        (current_company_id,old_trip.id,'operational','scheduled','loading',p_occurred_at,normalized_reason,current_actor_id),
        (current_company_id,old_trip.id,'operational','loading','in_transit',p_occurred_at,normalized_reason,current_actor_id);
    else
      insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
      values (current_company_id,old_trip.id,'operational','loading','in_transit',p_occurred_at,normalized_reason,current_actor_id);
    end if;
    insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.vehicle_id,old_trip.id,p_odometer_km,p_occurred_at,'trip_start','staff_representative',current_actor_id,null,p_request_id);
    insert into public.trip_load_state_events (id,company_id,trip_id,vehicle_id,load_state,effective_at,odometer_km,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.id,old_trip.vehicle_id,p_load_state,p_occurred_at,p_odometer_km,current_actor_id,null,p_request_id);
    perform private.write_audit(current_company_id,'STAFF_TRIP_STARTED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  elsif p_action = 'arrive' then
    if p_odometer_km is not null or coalesce(p_cargo_delivered,false) or p_load_state is not null then
      raise exception using errcode = '23514', message = 'Arrival does not accept mileage, delivery or load state';
    end if;
    if trip_row.operational_status <> 'in_transit' or trip_row.started_at is null or p_occurred_at <= trip_row.started_at then
      raise exception using errcode = '23514', message = 'Arrival must follow an active trip start';
    end if;
    update public.trips t set operational_status = 'unloading', version = t.version + 1, updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
    values (current_company_id,old_trip.id,'operational','in_transit','unloading',p_occurred_at,normalized_reason,current_actor_id);
    perform private.write_audit(current_company_id,'STAFF_TRIP_ARRIVED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  elsif p_action = 'complete' then
    if p_odometer_km is null or p_cargo_delivered is distinct from true or p_load_state is not null then
      raise exception using errcode = '23514', message = 'Completion requires final mileage and delivered cargo';
    end if;
    if trip_row.operational_status <> 'unloading' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to complete';
    end if;
    select max(e.occurred_at) into arrival_at from public.trip_status_events e
    where e.company_id = current_company_id and e.trip_id = trip_row.id
      and e.dimension = 'operational' and e.new_status = 'unloading';
    if arrival_at is null or p_occurred_at <= arrival_at or p_occurred_at <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id for update;
    if p_odometer_km < current_vehicle_odometer
       and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1 from public.odometer_entries o where o.company_id = current_company_id and o.trip_id = trip_row.id and o.reading_at > p_occurred_at
      union all select 1 from public.expenses e where e.company_id = current_company_id and e.trip_id = trip_row.id and e.incurred_at > p_occurred_at
      union all select 1 from public.fuel_entries f where f.company_id = current_company_id and f.trip_id = trip_row.id and f.fueled_at > p_occurred_at
      union all select 1 from public.incidents i where i.company_id = current_company_id and i.trip_id = trip_row.id and i.occurred_at > p_occurred_at
    ) then raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity'; end if;
    update public.trips t set operational_status = 'completed', administrative_status = 'settlement_pending',
      operational_finished_at = p_occurred_at, version = t.version + 1, updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    update public.vehicles v set current_status = 'available', current_odometer_km = greatest(v.current_odometer_km,p_odometer_km)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.vehicle_id,old_trip.id,p_odometer_km,p_occurred_at,'trip_finish','staff_representative',current_actor_id,null,p_request_id);
    insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
    values
      (current_company_id,old_trip.id,'operational','unloading','completed',p_occurred_at,normalized_reason,current_actor_id),
      (current_company_id,old_trip.id,'administrative',old_trip.administrative_status::text,'settlement_pending',p_occurred_at,normalized_reason,current_actor_id);
    insert into public.settlements (company_id,trip_id,driver_id,started_at)
    values (current_company_id,old_trip.id,old_trip.driver_id,p_occurred_at)
    on conflict (company_id,trip_id) do nothing;
    perform private.write_audit(current_company_id,'STAFF_TRIP_COMPLETED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  else
    raise exception using errcode = '22023', message = 'Unsupported staff transition action';
  end if;
  insert into public.trip_transition_requests (id,company_id,trip_id,requested_action,odometer_km,cargo_delivered,occurred_at,source_device_id,actor_id,applied_at)
  values (p_request_id,current_company_id,p_trip_id,p_action,p_odometer_km,coalesce(p_cargo_delivered,false),p_occurred_at,null,current_actor_id,now());
  return trip_row;
end;
$$;

create function public.record_staff_trip_load_state(
  p_id uuid,
  p_trip_id uuid,
  p_load_state public.trip_load_state,
  p_effective_at timestamptz,
  p_odometer_km numeric,
  p_expected_version integer,
  p_reason text,
  p_idempotency_key uuid
)
returns public.trip_load_state_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.trip_load_state_events;
  normalized_reason text := nullif(trim(p_reason), '');
  last_odometer numeric;
  last_effective_at timestamptz;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_expected_version is null or p_effective_at is null
     or p_odometer_km is null or p_odometer_km < 0 or normalized_reason is null then
    raise exception using errcode = '23514', message = 'Staff load-state capture needs version, time, mileage, reason and idempotency';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':load-state:' || p_idempotency_key::text, 0));
  select * into result from public.trip_load_state_events e
  where e.company_id = current_company_id and e.idempotency_key = p_idempotency_key;
  if found then
    if result.id is distinct from p_id or result.trip_id is distinct from p_trip_id
       or result.load_state is distinct from p_load_state or result.effective_at is distinct from p_effective_at
       or result.odometer_km is distinct from p_odometer_km::numeric(14,2) or result.recorded_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found or trip_row.vehicle_id is null then raise exception using errcode = 'P0002', message = 'Trip with assigned vehicle not found'; end if;
  if trip_row.version <> p_expected_version then raise exception using errcode = '40001', message = 'Trip changed; refresh before recording load state'; end if;
  if trip_row.capture_mode <> 'staff_assisted' or trip_row.operational_status not in ('loading','in_transit','unloading') then
    raise exception using errcode = '42501', message = 'Office load-state capture requires an active staff-assisted trip';
  end if;
  select e.odometer_km, e.effective_at into last_odometer, last_effective_at
  from public.trip_load_state_events e
  where e.company_id = current_company_id and e.trip_id = p_trip_id
    and not exists (select 1 from public.trip_load_state_events correction where correction.company_id = e.company_id and correction.supersedes_event_id = e.id)
  order by e.odometer_km desc, e.effective_at desc, e.created_at desc limit 1;
  if last_odometer is not null and (p_odometer_km <= last_odometer or p_effective_at < last_effective_at) then
    raise exception using errcode = '23514', message = 'Load-state events must increase odometer and time';
  end if;
  if trip_row.started_at is not null and p_effective_at < trip_row.started_at - interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event predates trip start';
  end if;
  insert into public.trip_load_state_events (id,company_id,trip_id,vehicle_id,load_state,effective_at,odometer_km,recorded_by,source_device_id,idempotency_key)
  values (p_id,current_company_id,p_trip_id,trip_row.vehicle_id,p_load_state,p_effective_at,p_odometer_km,current_actor_id,null,p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id,'STAFF_TRIP_LOAD_STATE_RECORDED','trip_load_state_event',result.id,null,
    jsonb_build_object('load_state_event',to_jsonb(result),'represented_driver_id',trip_row.driver_id),normalized_reason);
  return result;
end;
$$;

create function public.record_staff_trip_odometer_entry(
  p_id uuid,
  p_trip_id uuid,
  p_reading_km numeric,
  p_reading_at timestamptz,
  p_reading_type text,
  p_expected_version integer,
  p_reason text,
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
  normalized_reason text := nullif(trim(p_reason), '');
  current_vehicle_odometer numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_expected_version is null or p_reading_at is null or normalized_reason is null
     or nullif(trim(p_reading_type),'') is null or p_reading_km is null or p_reading_km < 0 then
    raise exception using errcode = '23514', message = 'Staff odometer entry needs valid data and a reason';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':odometer:' || p_idempotency_key::text, 0));
  select * into result from public.odometer_entries o
  where o.company_id = current_company_id and o.idempotency_key = p_idempotency_key;
  if found then
    if result.id is distinct from p_id or result.trip_id is distinct from p_trip_id
       or result.reading_km is distinct from p_reading_km::numeric(14,2)
       or result.reading_at is distinct from p_reading_at or result.reading_type is distinct from p_reading_type
       or result.source is distinct from 'staff_representative' or result.recorded_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found or trip_row.vehicle_id is null then raise exception using errcode = 'P0002', message = 'Trip with assigned vehicle not found'; end if;
  if trip_row.version <> p_expected_version then raise exception using errcode = '40001', message = 'Trip changed; refresh before recording mileage'; end if;
  if trip_row.operational_status in ('scheduled','loading','in_transit','unloading') and trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Office mileage capture requires a staff-assisted trip';
  end if;
  if trip_row.operational_status not in ('scheduled','loading','in_transit','unloading','completed') then
    raise exception using errcode = '23514', message = 'Trip is not open for an odometer entry';
  end if;
  select v.current_odometer_km into current_vehicle_odometer from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id for update;
  if p_reading_km < current_vehicle_odometer
     and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
  values (p_id,current_company_id,trip_row.vehicle_id,p_trip_id,p_reading_km,p_reading_at,p_reading_type,'staff_representative',current_actor_id,null,p_idempotency_key)
  returning * into result;
  update public.vehicles v set current_odometer_km = greatest(v.current_odometer_km,p_reading_km)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  perform private.write_audit(current_company_id,'STAFF_TRIP_ODOMETER_RECORDED','odometer_entry',result.id,null,
    jsonb_build_object('odometer_entry',to_jsonb(result),'represented_driver_id',trip_row.driver_id),normalized_reason);
  return result;
end;
$$;

create function public.record_staff_trip_incident(
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
  p_expected_version integer,
  p_reason text,
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
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_expected_version is null or p_occurred_at is null or normalized_reason is null
     or nullif(trim(p_incident_type),'') is null or nullif(trim(p_description),'') is null or p_severity is null then
    raise exception using errcode = '23514', message = 'Staff incident needs valid data and a reason';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':incident:' || p_idempotency_key::text, 0));
  select * into result from public.incidents i
  where i.company_id = current_company_id and i.idempotency_key = p_idempotency_key;
  if found then
    if result.id is distinct from p_id or result.trip_id is distinct from p_trip_id
       or result.occurred_at is distinct from p_occurred_at or result.location is distinct from p_location
       or result.incident_type is distinct from p_incident_type or result.severity is distinct from p_severity
       or result.description is distinct from p_description or result.action_taken is distinct from p_action_taken
       or result.estimated_cost is distinct from p_estimated_cost::numeric(14,2)
       or result.file_id is distinct from p_file_id or result.created_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.version <> p_expected_version then raise exception using errcode = '40001', message = 'Trip changed; refresh before recording incident'; end if;
  if trip_row.operational_status in ('scheduled','loading','in_transit','unloading') and trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Office incident capture requires a staff-assisted trip';
  end if;
  if trip_row.operational_status not in ('scheduled','loading','in_transit','unloading','completed') then
    raise exception using errcode = '23514', message = 'Trip is not open for an incident';
  end if;
  insert into public.incidents (id,company_id,trip_id,vehicle_id,driver_id,occurred_at,location,incident_type,severity,description,action_taken,status,estimated_cost,file_id,created_by,source_device_id,idempotency_key)
  values (p_id,current_company_id,p_trip_id,trip_row.vehicle_id,trip_row.driver_id,p_occurred_at,p_location,p_incident_type,p_severity,p_description,p_action_taken,'open',p_estimated_cost,p_file_id,current_actor_id,null,p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id,'STAFF_TRIP_INCIDENT_RECORDED','incident',result.id,null,
    jsonb_build_object('incident',to_jsonb(result),'represented_driver_id',trip_row.driver_id),normalized_reason);
  return result;
end;
$$;

-- A driver profile may lose access while assigned only after every active trip
-- has been deliberately handed to office capture. The driver record and all
-- operational history remain intact.
create or replace function public.manage_company_profile_access(
  p_profile_id uuid,
  p_action text,
  p_next_role public.app_role default null,
  p_reason text default null
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  actor_id uuid := (select auth.uid());
  old_profile public.profiles;
  new_profile public.profiles;
  linked_driver public.drivers;
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if p_action not in ('suspend', 'reactivate', 'change_role', 'unlink_driver') then
    raise exception using errcode = '22023', message = 'Unsupported profile access action';
  end if;
  if normalized_reason is null then
    raise exception using errcode = '23514', message = 'A reason is required for access administration';
  end if;
  if p_profile_id = actor_id then
    raise exception using errcode = '23514', message = 'You cannot change your own access or role';
  end if;
  select * into old_profile from public.profiles p
  where p.id = p_profile_id and p.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Profile not found in your company'; end if;
  select * into linked_driver from public.drivers d
  where d.company_id = company_id and d.profile_id = p_profile_id for update;
  if p_action in ('suspend', 'unlink_driver') and linked_driver.id is not null and exists (
    select 1 from public.trips t
    where t.company_id = company_id and t.driver_id = linked_driver.id
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
      and t.capture_mode <> 'staff_assisted'
  ) then
    raise exception using errcode = '23514', message = 'Move every active trip to office capture before removing driver access';
  end if;
  if old_profile.role = 'management' and (
    p_action = 'suspend' or (p_action = 'change_role' and p_next_role is distinct from 'management')
  ) and (select count(*) from public.profiles p where p.company_id = company_id and p.active and p.role = 'management') <= 1 then
    raise exception using errcode = '23514', message = 'Your company must retain at least one active management profile';
  end if;
  if p_action = 'suspend' then
    if not old_profile.active then raise exception using errcode = '23514', message = 'Profile access is already suspended'; end if;
    update public.profiles p set active = false, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id,'PROFILE_ACCESS_SUSPENDED','profile',p_profile_id,to_jsonb(old_profile),to_jsonb(new_profile),normalized_reason);
    return new_profile;
  end if;
  if p_action = 'reactivate' then
    if old_profile.active then raise exception using errcode = '23514', message = 'Profile access is already active'; end if;
    update public.profiles p set active = true, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id,'PROFILE_ACCESS_REACTIVATED','profile',p_profile_id,to_jsonb(old_profile),to_jsonb(new_profile),normalized_reason);
    return new_profile;
  end if;
  if p_action = 'change_role' then
    if p_next_role is null then raise exception using errcode = '23514', message = 'A new role is required'; end if;
    if p_next_role = old_profile.role then raise exception using errcode = '23514', message = 'Choose a different role'; end if;
    if old_profile.role = 'driver' and p_next_role <> 'driver' and linked_driver.id is not null then
      raise exception using errcode = '23514', message = 'Unlink the driver record before changing this role';
    end if;
    update public.profiles p set role = p_next_role, updated_at = now()
    where p.id = p_profile_id and p.company_id = company_id returning * into new_profile;
    perform private.write_audit(company_id,'PROFILE_ROLE_CHANGED','profile',p_profile_id,to_jsonb(old_profile),to_jsonb(new_profile),normalized_reason);
    return new_profile;
  end if;
  if linked_driver.id is null then raise exception using errcode = '23514', message = 'This profile is not linked to a driver record'; end if;
  update public.drivers d set profile_id = null, updated_at = now()
  where d.id = linked_driver.id and d.company_id = company_id;
  perform private.write_audit(company_id,'DRIVER_PROFILE_UNLINKED','driver',linked_driver.id,to_jsonb(linked_driver),to_jsonb(linked_driver) || jsonb_build_object('profile_id', null),normalized_reason);
  return old_profile;
end;
$$;

revoke all on function public.schedule_trip(uuid,uuid,uuid,integer,public.trip_capture_mode) from public, anon, authenticated, service_role;
revoke all on function public.schedule_trip(uuid,uuid,uuid,public.trip_capture_mode) from public, anon, authenticated, service_role;
revoke all on function public.change_trip_capture_mode(uuid,public.trip_capture_mode,integer,text) from public, anon, authenticated, service_role;
revoke all on function public.record_staff_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,public.trip_load_state,integer,text) from public, anon, authenticated, service_role;
revoke all on function public.record_staff_trip_load_state(uuid,uuid,public.trip_load_state,timestamptz,numeric,integer,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_staff_trip_odometer_entry(uuid,uuid,numeric,timestamptz,text,integer,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.record_staff_trip_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.schedule_trip(uuid,uuid,uuid,public.trip_capture_mode) to authenticated;
grant execute on function public.change_trip_capture_mode(uuid,public.trip_capture_mode,integer,text) to authenticated;
grant execute on function public.record_staff_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,public.trip_load_state,integer,text) to authenticated;
grant execute on function public.record_staff_trip_load_state(uuid,uuid,public.trip_load_state,timestamptz,numeric,integer,text,uuid) to authenticated;
grant execute on function public.record_staff_trip_odometer_entry(uuid,uuid,numeric,timestamptz,text,integer,text,uuid) to authenticated;
grant execute on function public.record_staff_trip_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,integer,text,uuid) to authenticated;
revoke all on function public.manage_company_profile_access(uuid,text,public.app_role,text) from public, anon;
grant execute on function public.manage_company_profile_access(uuid,text,public.app_role,text) to authenticated, service_role;

revoke all on function private.enforce_trip_transition_capture_mode() from public, anon, authenticated, service_role;
revoke all on function private.enforce_trip_load_state_capture_mode() from public, anon, authenticated, service_role;
