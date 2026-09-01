-- `current_time` is a PostgreSQL special expression (time without a date).
-- Keep the Stage 3 wall-clock value unambiguous inside SECURITY INVOKER RPCs.

create or replace function public.heartbeat_gps_sync_run(
  p_run_id uuid,
  p_lease_seconds integer
)
returns public.gps_sync_runs
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  active_run public.gps_sync_runs;
  renewed_run public.gps_sync_runs;
begin
  if p_run_id is null or p_lease_seconds is null or p_lease_seconds not between 15 and 120 then
    raise exception using errcode = '23514', message = 'Invalid GPS synchronization lease';
  end if;
  select * into active_run
  from public.gps_sync_runs run
  where run.id = p_run_id
  for update;
  if not found or active_run.status <> 'started' then
    raise exception using errcode = 'P0002', message = 'Active GPS synchronization run not found';
  end if;
  if active_run.lease_expires_at <= observed_at then
    raise exception using errcode = '55P03', message = 'GPS synchronization lease expired';
  end if;
  if active_run.deadline_at <= observed_at then
    raise exception using errcode = '57014', message = 'GPS synchronization deadline expired';
  end if;
  update public.gps_sync_runs run
  set heartbeat_at = observed_at,
      lease_expires_at = least(
        observed_at + make_interval(secs => p_lease_seconds),
        active_run.deadline_at
      )
  where run.id = active_run.id
  returning * into renewed_run;
  return renewed_run;
end;
$$;

create or replace function public.finish_gps_sync_run(
  p_run_id uuid,
  p_status public.gps_sync_run_status,
  p_assets_seen integer,
  p_positions_received integer,
  p_positions_persisted integer,
  p_positions_deduplicated integer,
  p_positions_unlinked integer,
  p_source_attempts integer,
  p_provider_checkpoint_at timestamptz default null,
  p_error_code text default null
)
returns public.gps_sync_runs
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  active_run public.gps_sync_runs;
  completed_run public.gps_sync_runs;
  normalized_error_code text := nullif(upper(trim(p_error_code)), '');
  canonical_error_message text;
begin
  if p_run_id is null or p_status is null or p_status not in ('succeeded', 'failed') then
    raise exception using errcode = '23514', message = 'Invalid GPS synchronization completion state';
  end if;
  if p_assets_seen is null
    or p_positions_received is null
    or p_positions_persisted is null
    or p_positions_deduplicated is null
    or p_positions_unlinked is null
    or p_source_attempts is null
    or p_assets_seen < 0
    or p_positions_received < 0
    or p_positions_persisted < 0
    or p_positions_deduplicated < 0
    or p_positions_unlinked < 0
    or p_source_attempts not between 0 and 1
    or p_positions_received > p_assets_seen
    or p_positions_persisted + p_positions_deduplicated + p_positions_unlinked > p_positions_received then
    raise exception using errcode = '23514', message = 'Invalid GPS synchronization counters';
  end if;

  if p_status = 'succeeded' then
    if normalized_error_code is not null then
      raise exception using errcode = '23514', message = 'Successful GPS synchronization cannot include an error code';
    end if;
  else
    canonical_error_message := case normalized_error_code
      when 'CONFIGURATION' then 'La configuración autorizada de la sincronización no está disponible.'
      when 'UNAUTHORIZED' then 'El proveedor o la persistencia rechazó la autenticación de la sincronización.'
      when 'RATE_LIMITED' then 'Un límite remoto impidió completar la sincronización.'
      when 'UNAVAILABLE' then 'Un servicio remoto no estuvo disponible durante la sincronización.'
      when 'MALFORMED_RESPONSE' then 'La respuesta del proveedor no tuvo el formato autorizado.'
      when 'REMOTE_ERROR' then 'El proveedor respondió con un error no recuperable.'
      when 'PERSISTENCE_UNAVAILABLE' then 'La persistencia de telemetría no estuvo disponible.'
      when 'PERSISTENCE_ERROR' then 'La persistencia de telemetría rechazó una operación.'
      when 'TIMEOUT' then 'La sincronización superó su duración máxima autorizada.'
      when 'UNLINKED_ASSET' then 'La sincronización encontró activos externos sin un vínculo aprobado.'
      when 'LEASE_EXPIRED' then 'La sincronización perdió su lease exclusivo antes de completarse.'
      else null
    end;
    if canonical_error_message is null then
      raise exception using errcode = '23514', message = 'Unsupported sanitized GPS synchronization error code';
    end if;
  end if;

  select * into active_run
  from public.gps_sync_runs run
  where run.id = p_run_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GPS synchronization run not found';
  end if;

  if active_run.status <> 'started' then
    if active_run.status = p_status
      and active_run.assets_seen = p_assets_seen
      and active_run.positions_received = p_positions_received
      and active_run.positions_persisted = p_positions_persisted
      and active_run.positions_deduplicated = p_positions_deduplicated
      and active_run.positions_unlinked = p_positions_unlinked
      and active_run.source_attempts = p_source_attempts
      and active_run.provider_checkpoint_at is not distinct from p_provider_checkpoint_at
      and active_run.error_code is not distinct from normalized_error_code then
      return active_run;
    end if;
    raise exception using errcode = 'P0002', message = 'GPS synchronization run is already finalized';
  end if;

  if p_status = 'succeeded'
    and (active_run.lease_expires_at <= observed_at or active_run.deadline_at <= observed_at) then
    raise exception using errcode = '57014', message = 'GPS synchronization cannot succeed after its lease or deadline expires';
  end if;

  update public.gps_sync_runs run
  set status = p_status,
      finished_at = observed_at,
      lease_expires_at = null,
      assets_seen = p_assets_seen,
      positions_received = p_positions_received,
      positions_persisted = p_positions_persisted,
      positions_deduplicated = p_positions_deduplicated,
      positions_unlinked = p_positions_unlinked,
      source_attempts = p_source_attempts,
      provider_checkpoint_at = p_provider_checkpoint_at,
      error_code = normalized_error_code,
      error_message = canonical_error_message
  where run.id = active_run.id
  returning * into completed_run;
  return completed_run;
end;
$$;

create or replace function public.ingest_gps_position_for_sync(
  p_run_id uuid,
  p_provider_kind text,
  p_external_asset_id text,
  p_observation_key text,
  p_provider_event_id text,
  p_recorded_at timestamptz,
  p_received_at timestamptz,
  p_latitude numeric,
  p_longitude numeric,
  p_speed_kmh numeric default null,
  p_heading_degrees numeric default null,
  p_altitude_meters numeric default null,
  p_ignition boolean default null,
  p_odometer_km numeric default null
)
returns table (position_id uuid, disposition text)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  observed_at timestamptz := clock_timestamp();
  provider_kind_normalized text := upper(trim(p_provider_kind));
  external_asset_id_normalized text := trim(p_external_asset_id);
  observation_key_normalized text := trim(p_observation_key);
  sync_run public.gps_sync_runs;
  link_row public.gps_provider_vehicle_links;
  persisted_position_id uuid;
begin
  if p_run_id is null
    or coalesce(provider_kind_normalized !~ '^[A-Z][A-Z0-9_]{1,63}$', true)
    or coalesce(length(external_asset_id_normalized) not between 1 and 255, true)
    or coalesce(length(observation_key_normalized) not between 1 and 512, true) then
    raise exception using errcode = '23514', message = 'Invalid normalized GPS synchronization evidence identity';
  end if;
  if p_recorded_at is null or p_received_at is null
    or p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180
    or p_speed_kmh is not null and p_speed_kmh < 0
    or p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360)
    or p_odometer_km is not null and p_odometer_km < 0 then
    raise exception using errcode = '23514', message = 'Invalid normalized GPS synchronization evidence';
  end if;

  select * into sync_run
  from public.gps_sync_runs run
  where run.id = p_run_id
  for update;
  if not found
    or sync_run.status <> 'started'
    or sync_run.provider_kind <> provider_kind_normalized
    or sync_run.lease_expires_at <= observed_at
    or sync_run.deadline_at <= observed_at then
    raise exception using errcode = '55P03', message = 'GPS synchronization run does not hold an active lease';
  end if;

  select * into link_row
  from public.gps_provider_vehicle_links link
  where link.company_id = sync_run.company_id
    and link.active
    and link.provider_kind = provider_kind_normalized
    and link.external_asset_id = external_asset_id_normalized
  for share;
  if not found then
    position_id := null;
    disposition := 'unlinked';
    return next;
    return;
  end if;

  insert into public.gps_positions (
    company_id, provider_link_id, vehicle_id, sync_run_id, provider_kind, external_asset_id,
    provider_event_id, observation_key, recorded_at, received_at, latitude, longitude,
    speed_kmh, heading_degrees, altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.id, link_row.vehicle_id, sync_run.id, provider_kind_normalized,
    external_asset_id_normalized, nullif(trim(p_provider_event_id), ''), observation_key_normalized,
    p_recorded_at, p_received_at, p_latitude, p_longitude, p_speed_kmh, p_heading_degrees,
    p_altitude_meters, p_ignition, p_odometer_km
  ) on conflict (company_id, provider_kind, observation_key) do nothing
  returning id into persisted_position_id;

  if persisted_position_id is null then
    select position.id into persisted_position_id
    from public.gps_positions position
    where position.company_id = link_row.company_id
      and position.provider_kind = provider_kind_normalized
      and position.observation_key = observation_key_normalized;
    position_id := persisted_position_id;
    disposition := 'deduplicated';
    return next;
    return;
  end if;

  insert into public.vehicle_latest_positions (
    company_id, vehicle_id, position_id, provider_kind, external_asset_id, recorded_at, received_at,
    latitude, longitude, speed_kmh, heading_degrees, altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.vehicle_id, persisted_position_id, provider_kind_normalized,
    external_asset_id_normalized, p_recorded_at, p_received_at, p_latitude, p_longitude,
    p_speed_kmh, p_heading_degrees, p_altitude_meters, p_ignition, p_odometer_km
  ) on conflict (company_id, vehicle_id) do update
  set position_id = excluded.position_id,
      provider_kind = excluded.provider_kind,
      external_asset_id = excluded.external_asset_id,
      recorded_at = excluded.recorded_at,
      received_at = excluded.received_at,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      speed_kmh = excluded.speed_kmh,
      heading_degrees = excluded.heading_degrees,
      altitude_meters = excluded.altitude_meters,
      ignition = excluded.ignition,
      odometer_km = excluded.odometer_km,
      updated_at = observed_at
  where (excluded.recorded_at, excluded.received_at)
    > (vehicle_latest_positions.recorded_at, vehicle_latest_positions.received_at);

  position_id := persisted_position_id;
  disposition := 'persisted';
  return next;
end;
$$;

revoke all on function public.heartbeat_gps_sync_run(uuid,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.heartbeat_gps_sync_run(uuid,integer)
  to service_role;
grant execute on function public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)
  to service_role;
grant execute on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
