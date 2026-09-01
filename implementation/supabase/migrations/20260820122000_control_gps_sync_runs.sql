-- Stage 3 keeps the temporary Goldcar bridge manually invocable and bounded.
-- A durable lease, rather than an in-memory mutex, prevents overlapping runs
-- while the worker is outside PostgreSQL reading the approved portal export.

alter table public.gps_sync_runs
  add column request_id uuid,
  add column initiated_by uuid,
  add column trigger_kind text not null default 'manual'
    check (trigger_kind in ('manual', 'scheduled')),
  add column lease_expires_at timestamptz,
  add column deadline_at timestamptz,
  add column heartbeat_at timestamptz,
  add column provider_checkpoint_at timestamptz,
  add column source_attempts integer not null default 0
    check (source_attempts between 0 and 1),
  add constraint gps_sync_runs_initiated_by_fk
    foreign key (company_id, initiated_by)
    references public.profiles (company_id, id) on delete restrict,
  add constraint gps_sync_runs_request_unique
    unique (company_id, provider_kind, request_id);

alter table public.gps_sync_runs
  drop constraint gps_sync_runs_completion,
  add constraint gps_sync_runs_completion check (
    (
      status = 'started'
      and finished_at is null
      and lease_expires_at is not null
      and deadline_at is not null
      and heartbeat_at is not null
      and lease_expires_at <= deadline_at
    )
    or (
      status <> 'started'
      and finished_at is not null
      and lease_expires_at is null
    )
  );

create unique index gps_sync_runs_one_active_provider_idx
  on public.gps_sync_runs (company_id, provider_kind)
  where status = 'started';

alter table public.gps_positions
  add column sync_run_id uuid,
  add constraint gps_positions_sync_run_fk
    foreign key (sync_run_id) references public.gps_sync_runs (id) on delete restrict;

create index gps_positions_sync_run_id_idx
  on public.gps_positions (sync_run_id)
  where sync_run_id is not null;

comment on column public.gps_sync_runs.request_id is
  'Worker-generated idempotency key for a single manual synchronization request.';
comment on column public.gps_sync_runs.initiated_by is
  'Approved active management profile that authorized the manual synchronization.';
comment on column public.gps_sync_runs.lease_expires_at is
  'Durable exclusive lease; an expired run may be recovered safely by a later request.';
comment on column public.gps_sync_runs.deadline_at is
  'Maximum permitted wall-clock completion time for this synchronization run.';
comment on column public.gps_sync_runs.provider_checkpoint_at is
  'Maximum provider observation time seen in the snapshot, diagnostic only and not a cursor.';
comment on column public.gps_positions.sync_run_id is
  'Synchronization run that persisted this evidence; direct server ingestion predating Stage 3 remains null.';

create function public.begin_gps_sync_run(
  p_company_id uuid,
  p_provider_kind text,
  p_request_id uuid,
  p_initiated_by uuid,
  p_lease_seconds integer,
  p_max_duration_seconds integer
)
returns public.gps_sync_runs
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  provider_kind_normalized text := upper(trim(p_provider_kind));
  started_at_value timestamptz := clock_timestamp();
  deadline_at_value timestamptz;
  existing_request public.gps_sync_runs;
  active_run public.gps_sync_runs;
  new_run public.gps_sync_runs;
begin
  if p_company_id is null or p_request_id is null or p_initiated_by is null
    or coalesce(provider_kind_normalized !~ '^[A-Z][A-Z0-9_]{1,63}$', true) then
    raise exception using errcode = '23514', message = 'Invalid GPS synchronization identity';
  end if;
  if p_lease_seconds is null
    or p_max_duration_seconds is null
    or p_lease_seconds not between 15 and 120
    or p_max_duration_seconds not between 30 and 300
    or p_lease_seconds > p_max_duration_seconds then
    raise exception using errcode = '23514', message = 'Invalid GPS synchronization time limit';
  end if;
  if not exists (
    select 1
    from public.companies company
    where company.id = p_company_id and company.active
  ) then
    raise exception using errcode = 'P0002', message = 'Active GPS company not found';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.company_id = p_company_id
      and profile.id = p_initiated_by
      and profile.active
      and profile.role = 'management'
  ) then
    raise exception using errcode = '42501', message = 'An active management profile must authorize the GPS synchronization';
  end if;
  if not exists (
    select 1
    from public.gps_telemetry_retention_policies policy
    where policy.company_id = p_company_id
  ) then
    raise exception using errcode = 'P0002', message = 'No approved GPS retention policy exists';
  end if;
  if not exists (
    select 1
    from public.gps_provider_vehicle_links link
    where link.company_id = p_company_id
      and link.provider_kind = provider_kind_normalized
      and link.active
  ) then
    raise exception using errcode = 'P0002', message = 'No active approved GPS vehicle mapping exists';
  end if;

  perform pg_advisory_xact_lock(hashtext(
    'gps-sync:' || p_company_id::text || ':' || provider_kind_normalized
  ));

  select * into existing_request
  from public.gps_sync_runs run
  where run.company_id = p_company_id
    and run.provider_kind = provider_kind_normalized
    and run.request_id = p_request_id
  for update;
  if found then
    if existing_request.initiated_by is distinct from p_initiated_by then
      raise exception using errcode = '42501', message = 'GPS synchronization request identity does not match its authorizer';
    end if;
    return existing_request;
  end if;

  select * into active_run
  from public.gps_sync_runs run
  where run.company_id = p_company_id
    and run.provider_kind = provider_kind_normalized
    and run.status = 'started'
  for update;
  if found then
    if active_run.lease_expires_at > started_at_value then
      raise exception using errcode = '55P03', message = 'Another GPS synchronization already holds the active lease';
    end if;
    update public.gps_sync_runs run
    set status = 'failed',
        finished_at = started_at_value,
        lease_expires_at = null,
        error_code = 'LEASE_EXPIRED',
        error_message = 'La ejecución anterior superó su lease y se cerró antes de iniciar una nueva.'
    where run.id = active_run.id;
  end if;

  deadline_at_value := started_at_value + make_interval(secs => p_max_duration_seconds);
  insert into public.gps_sync_runs (
    company_id,
    provider_kind,
    request_id,
    initiated_by,
    trigger_kind,
    status,
    started_at,
    lease_expires_at,
    deadline_at,
    heartbeat_at
  ) values (
    p_company_id,
    provider_kind_normalized,
    p_request_id,
    p_initiated_by,
    'manual',
    'started',
    started_at_value,
    least(started_at_value + make_interval(secs => p_lease_seconds), deadline_at_value),
    deadline_at_value,
    started_at_value
  ) returning * into new_run;
  return new_run;
end;
$$;

create function public.heartbeat_gps_sync_run(
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
  current_time timestamptz := clock_timestamp();
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
  if active_run.lease_expires_at <= current_time then
    raise exception using errcode = '55P03', message = 'GPS synchronization lease expired';
  end if;
  if active_run.deadline_at <= current_time then
    raise exception using errcode = '57014', message = 'GPS synchronization deadline expired';
  end if;
  update public.gps_sync_runs run
  set heartbeat_at = current_time,
      lease_expires_at = least(
        current_time + make_interval(secs => p_lease_seconds),
        active_run.deadline_at
      )
  where run.id = active_run.id
  returning * into renewed_run;
  return renewed_run;
end;
$$;

create function public.finish_gps_sync_run(
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
  current_time timestamptz := clock_timestamp();
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
    and (active_run.lease_expires_at <= current_time or active_run.deadline_at <= current_time) then
    raise exception using errcode = '57014', message = 'GPS synchronization cannot succeed after its lease or deadline expires';
  end if;

  update public.gps_sync_runs run
  set status = p_status,
      finished_at = current_time,
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

create function public.ingest_gps_position_for_sync(
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
  current_time timestamptz := clock_timestamp();
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
    or sync_run.lease_expires_at <= current_time
    or sync_run.deadline_at <= current_time then
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
      updated_at = current_time
  where (excluded.recorded_at, excluded.received_at)
    > (vehicle_latest_positions.recorded_at, vehicle_latest_positions.received_at);

  position_id := persisted_position_id;
  disposition := 'persisted';
  return next;
end;
$$;

revoke all on function public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.heartbeat_gps_sync_run(uuid,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)
  to service_role;
grant execute on function public.heartbeat_gps_sync_run(uuid,integer)
  to service_role;
grant execute on function public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)
  to service_role;
grant execute on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
