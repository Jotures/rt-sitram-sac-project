-- A scheduled trip must be operable by the assigned driver's authenticated
-- account. The driver-facing read model resolves assignments through
-- drivers.profile_id, so scheduling an unlinked, inactive, or non-driver
-- profile would create a trip that nobody can operate.

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
    join public.profiles p
      on p.id = d.profile_id
      and p.company_id = d.company_id
    where d.id = p_driver_id
      and d.company_id = current_company_id
      and d.active
      and d.current_status = 'available'
      and p.active
      and p.role = 'driver'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Driver must be available and linked to an active driver profile';
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

-- The versioned primitive is invoked only by the public three-argument RPC
-- adapter, which resolves the authoritative version. Keep it off every API
-- role, including service_role, in line with DEC-020 and the ACL allowlist.
revoke all on function public.schedule_trip(uuid,uuid,uuid,integer)
  from public, anon, authenticated, service_role;
