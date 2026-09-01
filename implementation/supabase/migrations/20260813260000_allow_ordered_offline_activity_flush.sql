-- A driver may reconnect after the server already accepted trip completion.
-- Permit only activity captured no later than that completion, for the same
-- assigned driver, before administrative settlement closure.

create or replace function private.can_write_trip_activity(target_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.is_staff() then exists (
      select 1 from public.trips t where t.id = target_trip_id and t.company_id = private.current_company_id()
    )
    when private.current_app_role() = 'driver' then exists (
      select 1 from public.trips t
      where t.id = target_trip_id
        and t.company_id = private.current_company_id()
        and t.driver_id = private.current_driver_id()
        and (
          t.operational_status in ('loading','in_transit','unloading')
          or (
            t.operational_status = 'completed'
            and t.administrative_status <> 'settlement_closed'
          )
        )
    )
    else false
  end
$$;

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
  select t.vehicle_id, t.driver_id, t.operational_status, t.operational_finished_at
    into assigned_vehicle, assigned_driver, trip_status, trip_finished_at
  from public.trips t
  where t.company_id = new.company_id and t.id = target_trip;
  if not found then raise exception using errcode = '23503', message = 'Trip does not belong to the row company'; end if;
  if target_vehicle is not null and target_vehicle is distinct from assigned_vehicle then
    raise exception using errcode = '23514', message = 'Vehicle does not match trip assignment';
  end if;
  if target_driver is not null and target_driver is distinct from assigned_driver then
    raise exception using errcode = '23514', message = 'Driver does not match trip assignment';
  end if;
  if trip_status = 'completed' and (captured_at is null or trip_finished_at is null or captured_at > trip_finished_at) then
    raise exception using errcode = '23514', message = 'Late activity must have been captured before trip completion';
  end if;
  return new;
end;
$$;
