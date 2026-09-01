-- Correct P1 cycle commands after their initial deployment. The original
-- PL/pgSQL local `company_id` collided with queried table columns, so every
-- company-scoped predicate could fail before evaluating its authorization.

create or replace function public.create_operational_cycle(
  p_id uuid,
  p_code text,
  p_vehicle_id uuid,
  p_primary_driver_id uuid,
  p_return_status public.return_status,
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
  normalized_code text := trim(coalesce(p_code, ''));
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  existing public.operational_cycles;
  result public.operational_cycles;
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Cycle and idempotency IDs are required';
  end if;
  if normalized_code = '' then
    raise exception using errcode = '23514', message = 'Cycle code is required';
  end if;
  if p_vehicle_id is null then
    raise exception using errcode = '23514', message = 'Cycle vehicle is required';
  end if;
  if p_return_status is null then
    raise exception using errcode = '23514', message = 'Cycle return status is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':operational-cycle:' || p_idempotency_key::text, 0)
  );
  select * into existing
  from public.operational_cycles c
  where c.company_id = current_company_id and c.idempotency_key = p_idempotency_key;
  if found then
    if existing.code = normalized_code
       and existing.vehicle_id = p_vehicle_id
       and existing.primary_driver_id is not distinct from p_primary_driver_id
       and existing.return_status = p_return_status
       and existing.notes is not distinct from normalized_notes then
      return existing;
    end if;
    raise exception using errcode = '23505', message = 'Cycle idempotency key belongs to another request';
  end if;

  if not exists (
    select 1 from public.vehicles v
    where v.company_id = current_company_id and v.id = p_vehicle_id and v.active
  ) then
    raise exception using errcode = '23514', message = 'Cycle vehicle is not active in this company';
  end if;
  if p_primary_driver_id is not null and not exists (
    select 1 from public.drivers d
    where d.company_id = current_company_id and d.id = p_primary_driver_id and d.active
  ) then
    raise exception using errcode = '23514', message = 'Cycle primary driver is not active in this company';
  end if;

  insert into public.operational_cycles (
    id, company_id, code, vehicle_id, primary_driver_id, status, return_status,
    notes, created_by, idempotency_key
  ) values (
    p_id, current_company_id, normalized_code, p_vehicle_id, p_primary_driver_id,
    'planned', p_return_status, normalized_notes, auth.uid(), p_idempotency_key
  ) returning * into result;

  perform private.write_audit(
    current_company_id, 'OPERATIONAL_CYCLE_CREATED', 'operational_cycle', result.id,
    null, to_jsonb(result), null
  );
  return result;
end;
$$;

create or replace function public.update_operational_cycle(
  p_cycle_id uuid,
  p_expected_version integer,
  p_status public.operational_cycle_status,
  p_return_status public.return_status,
  p_notes text
)
returns public.operational_cycles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_cycle public.operational_cycles;
  result public.operational_cycles;
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '23514', message = 'Expected cycle version is required';
  end if;
  if p_status is null or p_return_status is null then
    raise exception using errcode = '23514', message = 'Cycle status and return status are required';
  end if;

  select * into old_cycle
  from public.operational_cycles c
  where c.company_id = current_company_id and c.id = p_cycle_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Operational cycle not found';
  end if;
  if old_cycle.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Operational cycle changed';
  end if;
  if old_cycle.status = 'planned' and p_status not in ('planned', 'active', 'cancelled') then
    raise exception using errcode = '23514', message = 'Invalid planned cycle transition';
  end if;
  if old_cycle.status = 'active' and p_status not in ('active', 'completed', 'cancelled') then
    raise exception using errcode = '23514', message = 'Invalid active cycle transition';
  end if;
  if old_cycle.status in ('completed', 'cancelled') then
    raise exception using errcode = '23514', message = 'Terminal operational cycle cannot change';
  end if;
  if p_status = 'completed' and exists (
    select 1 from public.trips t
    where t.company_id = current_company_id
      and t.cycle_id = old_cycle.id
      and t.operational_status not in ('completed', 'cancelled')
  ) then
    raise exception using errcode = '23514', message = 'Every cycle trip must finish before completing the cycle';
  end if;

  update public.operational_cycles c
  set status = p_status,
      return_status = p_return_status,
      notes = normalized_notes,
      started_at = case when p_status = 'active' then coalesce(c.started_at, now()) else c.started_at end,
      ended_at = case when p_status in ('completed', 'cancelled') then coalesce(c.ended_at, now()) else null end,
      version = c.version + 1,
      updated_at = now()
  where c.company_id = current_company_id and c.id = old_cycle.id
  returning * into result;

  perform private.write_audit(
    current_company_id, 'OPERATIONAL_CYCLE_UPDATED', 'operational_cycle', result.id,
    to_jsonb(old_cycle), to_jsonb(result), null
  );
  return result;
end;
$$;

create or replace function public.add_trip_to_operational_cycle(
  p_cycle_id uuid,
  p_trip_id uuid,
  p_leg_kind public.operational_cycle_leg_kind,
  p_expected_cycle_version integer
)
returns public.trips
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  cycle_row public.operational_cycles;
  old_trip public.trips;
  result public.trips;
  next_sequence integer;
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_leg_kind is null or p_expected_cycle_version is null or p_expected_cycle_version < 1 then
    raise exception using errcode = '23514', message = 'Cycle leg kind and expected version are required';
  end if;
  select * into cycle_row
  from public.operational_cycles c
  where c.company_id = current_company_id and c.id = p_cycle_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Operational cycle not found';
  end if;
  if cycle_row.version <> p_expected_cycle_version then
    raise exception using errcode = '40001', message = 'Operational cycle changed';
  end if;
  if cycle_row.status not in ('planned', 'active') then
    raise exception using errcode = '23514', message = 'Terminal operational cycle cannot receive trips';
  end if;

  select * into old_trip
  from public.trips t
  where t.company_id = current_company_id and t.id = p_trip_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if old_trip.vehicle_id is distinct from cycle_row.vehicle_id then
    raise exception using errcode = '23514', message = 'Cycle trip must use the cycle vehicle';
  end if;
  if old_trip.cycle_id = cycle_row.id then
    if old_trip.cycle_leg_kind = p_leg_kind then
      return old_trip;
    end if;
    raise exception using errcode = '23505', message = 'Trip already belongs to this cycle with another leg kind';
  end if;
  if old_trip.cycle_id is not null then
    raise exception using errcode = '23505', message = 'Trip already belongs to another operational cycle';
  end if;

  select coalesce(max(t.cycle_sequence), 0) + 1 into next_sequence
  from public.trips t
  where t.company_id = current_company_id and t.cycle_id = cycle_row.id;

  update public.trips t
  set cycle_id = cycle_row.id,
      cycle_leg_kind = p_leg_kind,
      cycle_sequence = next_sequence,
      version = t.version + 1,
      updated_at = now()
  where t.company_id = current_company_id and t.id = old_trip.id
  returning * into result;
  update public.operational_cycles c
  set version = c.version + 1, updated_at = now()
  where c.company_id = current_company_id and c.id = cycle_row.id;

  perform private.write_audit(
    current_company_id, 'TRIP_ADDED_TO_OPERATIONAL_CYCLE', 'trip', result.id,
    to_jsonb(old_trip), to_jsonb(result), null
  );
  perform private.write_audit(
    current_company_id, 'OPERATIONAL_CYCLE_TRIP_ADDED', 'operational_cycle', cycle_row.id,
    null, jsonb_build_object('trip_id', result.id, 'leg_kind', p_leg_kind, 'sequence', next_sequence), null
  );
  return result;
end;
$$;

create or replace function public.remove_trip_from_operational_cycle(
  p_cycle_id uuid,
  p_trip_id uuid,
  p_expected_cycle_version integer,
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
  cycle_row public.operational_cycles;
  old_trip public.trips;
  result public.trips;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_expected_cycle_version is null or p_expected_cycle_version < 1 or normalized_reason = '' then
    raise exception using errcode = '23514', message = 'Expected version and removal reason are required';
  end if;
  select * into cycle_row
  from public.operational_cycles c
  where c.company_id = current_company_id and c.id = p_cycle_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Operational cycle not found';
  end if;
  if cycle_row.version <> p_expected_cycle_version then
    raise exception using errcode = '40001', message = 'Operational cycle changed';
  end if;
  if cycle_row.status not in ('planned', 'active') then
    raise exception using errcode = '23514', message = 'Terminal operational cycle cannot remove trips';
  end if;
  select * into old_trip
  from public.trips t
  where t.company_id = current_company_id and t.id = p_trip_id
  for update;
  if not found or old_trip.cycle_id is distinct from cycle_row.id then
    raise exception using errcode = 'P0002', message = 'Trip is not part of this operational cycle';
  end if;

  update public.trips t
  set cycle_id = null,
      cycle_leg_kind = null,
      cycle_sequence = null,
      version = t.version + 1,
      updated_at = now()
  where t.company_id = current_company_id and t.id = old_trip.id
  returning * into result;
  update public.operational_cycles c
  set version = c.version + 1, updated_at = now()
  where c.company_id = current_company_id and c.id = cycle_row.id;

  perform private.write_audit(
    current_company_id, 'TRIP_REMOVED_FROM_OPERATIONAL_CYCLE', 'trip', result.id,
    to_jsonb(old_trip), to_jsonb(result), normalized_reason
  );
  perform private.write_audit(
    current_company_id, 'OPERATIONAL_CYCLE_TRIP_REMOVED', 'operational_cycle', cycle_row.id,
    jsonb_build_object('trip_id', old_trip.id, 'leg_kind', old_trip.cycle_leg_kind, 'sequence', old_trip.cycle_sequence),
    null, normalized_reason
  );
  return result;
end;
$$;
