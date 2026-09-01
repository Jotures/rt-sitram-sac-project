-- GPS mappings are approved business configuration; incoming evidence is
-- server-only and derives company scope from an active approved mapping.

alter table public.gps_provider_vehicle_links enable row level security;
alter table public.gps_provider_vehicle_links force row level security;
alter table public.gps_positions enable row level security;
alter table public.gps_positions force row level security;
alter table public.vehicle_latest_positions enable row level security;
alter table public.vehicle_latest_positions force row level security;
alter table public.gps_telemetry_retention_policies enable row level security;
alter table public.gps_telemetry_retention_policies force row level security;
alter table public.gps_sync_runs enable row level security;
alter table public.gps_sync_runs force row level security;

revoke all on table public.gps_provider_vehicle_links from anon, authenticated;
revoke all on table public.gps_positions from anon, authenticated;
revoke all on table public.vehicle_latest_positions from anon, authenticated;
revoke all on table public.gps_telemetry_retention_policies from anon, authenticated;
revoke all on table public.gps_sync_runs from anon, authenticated;
grant all on table public.gps_provider_vehicle_links to service_role;
grant all on table public.gps_positions to service_role;
grant all on table public.vehicle_latest_positions to service_role;
grant all on table public.gps_telemetry_retention_policies to service_role;
grant all on table public.gps_sync_runs to service_role;

grant select on table public.gps_provider_vehicle_links to authenticated;
grant select on table public.gps_positions to authenticated;
grant select on table public.vehicle_latest_positions to authenticated;
grant select on table public.gps_telemetry_retention_policies to authenticated;
grant select on table public.gps_sync_runs to authenticated;

create policy gps_provider_vehicle_links_staff_select
  on public.gps_provider_vehicle_links for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy gps_positions_staff_select
  on public.gps_positions for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy vehicle_latest_positions_staff_select
  on public.vehicle_latest_positions for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy gps_telemetry_retention_policies_management_select
  on public.gps_telemetry_retention_policies for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.current_app_role()) = 'management');
create policy gps_sync_runs_management_select
  on public.gps_sync_runs for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.current_app_role()) = 'management'
  );

create function public.link_gps_vehicle(
  p_provider_kind text,
  p_external_asset_id text,
  p_external_display_name text,
  p_vehicle_id uuid
)
returns public.gps_provider_vehicle_links
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  provider_kind_normalized text := upper(trim(p_provider_kind));
  external_asset_id_normalized text := trim(p_external_asset_id);
  display_name_normalized text := nullif(trim(p_external_display_name), '');
  existing_link public.gps_provider_vehicle_links;
  new_link public.gps_provider_vehicle_links;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if coalesce(provider_kind_normalized !~ '^[A-Z][A-Z0-9_]{1,63}$', true)
    or coalesce(length(external_asset_id_normalized) not between 1 and 255, true) then
    raise exception using errcode = '23514', message = 'Invalid GPS provider asset identity';
  end if;
  if display_name_normalized is not null and length(display_name_normalized) > 255 then
    raise exception using errcode = '23514', message = 'GPS asset display name is too long';
  end if;
  if not exists (
    select 1 from public.vehicles vehicle
    where vehicle.company_id = current_company_id and vehicle.id = p_vehicle_id and vehicle.active
  ) then
    raise exception using errcode = 'P0002', message = 'Active vehicle not found';
  end if;
  select * into existing_link
  from public.gps_provider_vehicle_links link
  where link.company_id = current_company_id
    and link.active
    and (
      (link.provider_kind = provider_kind_normalized and link.external_asset_id = external_asset_id_normalized)
      or (link.provider_kind = provider_kind_normalized and link.vehicle_id = p_vehicle_id)
    )
  for update;
  if found then
    if existing_link.provider_kind = provider_kind_normalized
      and existing_link.external_asset_id = external_asset_id_normalized
      and existing_link.vehicle_id = p_vehicle_id then
      return existing_link;
    end if;
    raise exception using errcode = '23505', message = 'An active GPS mapping already conflicts with this provider asset or vehicle';
  end if;

  insert into public.gps_provider_vehicle_links (
    company_id, provider_kind, external_asset_id, external_display_name, vehicle_id, linked_by
  ) values (
    current_company_id, provider_kind_normalized, external_asset_id_normalized, display_name_normalized, p_vehicle_id, auth.uid()
  ) returning * into new_link;
  perform private.write_audit(
    current_company_id,
    'GPS_VEHICLE_LINKED',
    'gps_provider_vehicle_link',
    new_link.id,
    null,
    to_jsonb(new_link),
    null
  );
  return new_link;
end;
$$;

create function public.unlink_gps_vehicle(p_link_id uuid, p_reason text)
returns public.gps_provider_vehicle_links
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  normalized_reason text := trim(p_reason);
  old_link public.gps_provider_vehicle_links;
  new_link public.gps_provider_vehicle_links;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if length(normalized_reason) = 0 or length(normalized_reason) > 500 then
    raise exception using errcode = '23514', message = 'GPS unlink reason is required and must be at most 500 characters';
  end if;
  select * into old_link
  from public.gps_provider_vehicle_links link
  where link.company_id = current_company_id and link.id = p_link_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GPS mapping not found';
  end if;
  if not old_link.active then
    return old_link;
  end if;
  update public.gps_provider_vehicle_links link
  set active = false,
      unlinked_by = auth.uid(),
      unlinked_at = now(),
      unlink_reason = normalized_reason
  where link.id = old_link.id
  returning * into new_link;
  perform private.write_audit(
    current_company_id,
    'GPS_VEHICLE_UNLINKED',
    'gps_provider_vehicle_link',
    new_link.id,
    to_jsonb(old_link),
    to_jsonb(new_link),
    normalized_reason
  );
  return new_link;
end;
$$;

create function public.configure_gps_telemetry_retention(p_historical_position_retention_days integer)
returns public.gps_telemetry_retention_policies
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_policy public.gps_telemetry_retention_policies;
  new_policy public.gps_telemetry_retention_policies;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_historical_position_retention_days not between 1 and 3650 then
    raise exception using errcode = '23514', message = 'GPS retention must be between 1 and 3650 days';
  end if;
  select * into old_policy from public.gps_telemetry_retention_policies policy
  where policy.company_id = current_company_id for update;
  insert into public.gps_telemetry_retention_policies (
    company_id, historical_position_retention_days, configured_by
  ) values (
    current_company_id, p_historical_position_retention_days, auth.uid()
  ) on conflict (company_id) do update
  set historical_position_retention_days = excluded.historical_position_retention_days,
      configured_by = excluded.configured_by,
      configured_at = now()
  returning * into new_policy;
  perform private.write_audit(
    current_company_id,
    'GPS_RETENTION_CONFIGURED',
    'gps_telemetry_retention_policy',
    new_policy.company_id,
    to_jsonb(old_policy),
    to_jsonb(new_policy),
    null
  );
  return new_policy;
end;
$$;

create function public.ingest_gps_position(
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
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  provider_kind_normalized text := upper(trim(p_provider_kind));
  external_asset_id_normalized text := trim(p_external_asset_id);
  observation_key_normalized text := trim(p_observation_key);
  link_row public.gps_provider_vehicle_links;
  persisted_position_id uuid;
begin
  if coalesce(provider_kind_normalized !~ '^[A-Z][A-Z0-9_]{1,63}$', true)
    or coalesce(length(external_asset_id_normalized) not between 1 and 255, true)
    or coalesce(length(observation_key_normalized) not between 1 and 512, true) then
    raise exception using errcode = '23514', message = 'Invalid normalized GPS identity';
  end if;
  if p_recorded_at is null or p_received_at is null
    or p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180
    or p_speed_kmh is not null and p_speed_kmh < 0
    or p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360)
    or p_odometer_km is not null and p_odometer_km < 0 then
    raise exception using errcode = '23514', message = 'Invalid normalized GPS evidence';
  end if;
  select * into link_row
  from public.gps_provider_vehicle_links link
  where link.active
    and link.provider_kind = provider_kind_normalized
    and link.external_asset_id = external_asset_id_normalized;
  if not found then
    raise exception using errcode = '23503', message = 'No active approved GPS vehicle mapping exists';
  end if;

  insert into public.gps_positions (
    company_id, provider_link_id, vehicle_id, provider_kind, external_asset_id, provider_event_id,
    observation_key, recorded_at, received_at, latitude, longitude, speed_kmh, heading_degrees,
    altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.id, link_row.vehicle_id, provider_kind_normalized, external_asset_id_normalized,
    nullif(trim(p_provider_event_id), ''), observation_key_normalized, p_recorded_at, p_received_at,
    p_latitude, p_longitude, p_speed_kmh, p_heading_degrees, p_altitude_meters, p_ignition, p_odometer_km
  ) on conflict (company_id, provider_kind, observation_key) do nothing
  returning id into persisted_position_id;

  if persisted_position_id is null then
    select position.id into persisted_position_id
    from public.gps_positions position
    where position.company_id = link_row.company_id
      and position.provider_kind = provider_kind_normalized
      and position.observation_key = observation_key_normalized;
    return persisted_position_id;
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
      updated_at = now()
  where (excluded.recorded_at, excluded.received_at)
    > (vehicle_latest_positions.recorded_at, vehicle_latest_positions.received_at);
  return persisted_position_id;
end;
$$;

create function public.purge_expired_gps_positions(p_company_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  policy_row public.gps_telemetry_retention_policies;
  deleted_count integer;
begin
  select * into policy_row
  from public.gps_telemetry_retention_policies policy
  where policy.company_id = p_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'No approved GPS retention policy exists';
  end if;
  delete from public.gps_positions position
  where position.company_id = policy_row.company_id
    and position.recorded_at < now() - make_interval(days => policy_row.historical_position_retention_days)
    and not exists (
      select 1 from public.vehicle_latest_positions latest
      where latest.company_id = position.company_id and latest.position_id = position.id
    );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.link_gps_vehicle(text,text,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.unlink_gps_vehicle(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.configure_gps_telemetry_retention(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.purge_expired_gps_positions(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.link_gps_vehicle(text,text,text,uuid) to authenticated;
grant execute on function public.unlink_gps_vehicle(uuid,text) to authenticated;
grant execute on function public.configure_gps_telemetry_retention(integer) to authenticated;
grant execute on function public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
grant execute on function public.purge_expired_gps_positions(uuid) to service_role;
