-- Offline transitions carry the physical occurrence time. Validate that time
-- before applying it and preserve it in trip, odometer, and status history.

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
  company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  driver_id uuid := private.current_driver_id();
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
    hashtextextended(company_id::text || ':trip-transition:' || $1::text, 0)
  );

  select * into existing_request
  from public.trip_transition_requests r
  where r.id = $1 and r.company_id = company_id;
  if found then
    if existing_request.actor_id is distinct from actor_id
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
    where t.id = existing_request.trip_id and t.company_id = company_id;
    return trip_row;
  end if;

  if $6 > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;

  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from driver_id then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  old_trip := trip_row;

  if $3 = 'start' then
    if $4 is null or coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Start requires mileage only';
    end if;
    if trip_row.operational_status not in ('scheduled','loading')
       or trip_row.vehicle_id is null or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = company_id
    for update;
    if $4 < current_vehicle_odometer then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;

    update public.trips t
    set operational_status = 'in_transit',
        started_at = $6,
        version = t.version + case when trip_row.operational_status = 'scheduled' then 2 else 1 end,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = company_id
    returning * into trip_row;

    update public.vehicles v
    set current_status = 'in_trip',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = company_id;
    update public.drivers d
    set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = company_id;

    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values
        (company_id, old_trip.id, 'operational', 'scheduled', 'loading', $6, 'Offline driver request', actor_id),
        (company_id, old_trip.id, 'operational', 'loading', 'in_transit', $6, 'Offline driver request', actor_id);
    else
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values (
        company_id, old_trip.id, 'operational', 'loading', 'in_transit',
        $6, 'Offline driver request', actor_id
      );
    end if;

    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      company_id, old_trip.vehicle_id, old_trip.id, $4, $6, 'trip_start',
      'command', actor_id, normalized_device_id, $1
    );
    perform private.write_audit(
      company_id, 'TRIP_STARTED', 'trip', old_trip.id,
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
    where t.id = trip_row.id and t.company_id = company_id
    returning * into trip_row;
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values (
      company_id, old_trip.id, 'operational', 'in_transit', 'unloading',
      $6, 'Offline driver request', actor_id
    );
    perform private.write_audit(
      company_id, 'TRIP_ARRIVED', 'trip', old_trip.id,
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
    where e.company_id = company_id
      and e.trip_id = trip_row.id
      and e.dimension = 'operational'
      and e.new_status = 'unloading';
    if arrival_at is null or $6 <= arrival_at or $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = company_id
    for update;
    if $4 < current_vehicle_odometer then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1 from public.odometer_entries o
      where o.company_id = company_id and o.trip_id = trip_row.id and o.reading_at > $6
      union all
      select 1 from public.expenses e
      where e.company_id = company_id and e.trip_id = trip_row.id and e.incurred_at > $6
      union all
      select 1 from public.fuel_entries f
      where f.company_id = company_id and f.trip_id = trip_row.id and f.fueled_at > $6
      union all
      select 1 from public.incidents i
      where i.company_id = company_id and i.trip_id = trip_row.id and i.occurred_at > $6
    ) then
      raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity';
    end if;

    update public.trips t
    set operational_status = 'completed',
        administrative_status = 'settlement_pending',
        operational_finished_at = $6,
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'available',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = company_id;
    update public.drivers d
    set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = company_id;
    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      company_id, old_trip.vehicle_id, old_trip.id, $4, $6, 'trip_finish',
      'command', actor_id, normalized_device_id, $1
    );
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values
      (company_id, old_trip.id, 'operational', 'unloading', 'completed', $6, 'Offline driver request', actor_id),
      (company_id, old_trip.id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', $6, 'Offline driver request', actor_id);
    insert into public.settlements (company_id, trip_id, driver_id, started_at)
    values (company_id, old_trip.id, old_trip.driver_id, $6)
    on conflict (company_id, trip_id) do nothing;
    perform private.write_audit(
      company_id, 'TRIP_COMPLETED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );
  else
    raise exception using errcode = '22023', message = 'Unsupported transition action';
  end if;

  insert into public.trip_transition_requests (
    id, company_id, trip_id, requested_action, odometer_km,
    cargo_delivered, occurred_at, source_device_id, actor_id, applied_at
  ) values (
    $1, company_id, $2, $3, $4,
    coalesce($5, false), $6, normalized_device_id, actor_id, now()
  );
  return trip_row;
end;
$$;

revoke all on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) from public, anon;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) to authenticated, service_role;
