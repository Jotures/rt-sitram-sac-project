-- GPS telemetry is operational evidence. It is deliberately separate from
-- trips, odometer entries and PowerSync replication.

create type public.gps_sync_run_status as enum ('started', 'succeeded', 'failed', 'cancelled');

create table public.gps_provider_vehicle_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  provider_kind text not null check (provider_kind ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  external_asset_id text not null check (length(trim(external_asset_id)) between 1 and 255),
  external_display_name text,
  vehicle_id uuid not null,
  active boolean not null default true,
  linked_by uuid not null,
  linked_at timestamptz not null default now(),
  unlinked_by uuid,
  unlinked_at timestamptz,
  unlink_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gps_provider_vehicle_links_vehicle_fk
    foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint gps_provider_vehicle_links_linked_by_fk
    foreign key (company_id, linked_by) references public.profiles (company_id, id) on delete restrict,
  constraint gps_provider_vehicle_links_unlinked_by_fk
    foreign key (company_id, unlinked_by) references public.profiles (company_id, id) on delete restrict,
  constraint gps_provider_vehicle_links_company_id_id_unique unique (company_id, id),
  constraint gps_provider_vehicle_links_unlink_state check (
    (active and unlinked_by is null and unlinked_at is null and unlink_reason is null)
    or (not active and unlinked_by is not null and unlinked_at is not null and coalesce(length(trim(unlink_reason)) > 0, false))
  )
);

create unique index gps_provider_vehicle_links_active_asset_unique
  on public.gps_provider_vehicle_links (company_id, provider_kind, external_asset_id)
  where active;
create unique index gps_provider_vehicle_links_active_vehicle_provider_unique
  on public.gps_provider_vehicle_links (company_id, vehicle_id, provider_kind)
  where active;

create trigger gps_provider_vehicle_links_set_updated_at
  before update on public.gps_provider_vehicle_links
  for each row execute function private.set_updated_at();

create table public.gps_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  provider_link_id uuid not null,
  vehicle_id uuid not null,
  provider_kind text not null check (provider_kind ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  external_asset_id text not null check (length(trim(external_asset_id)) between 1 and 255),
  provider_event_id text,
  observation_key text not null check (length(trim(observation_key)) between 1 and 512),
  recorded_at timestamptz not null,
  received_at timestamptz not null,
  latitude numeric(10,7) not null check (latitude between -90 and 90),
  longitude numeric(10,7) not null check (longitude between -180 and 180),
  speed_kmh numeric(10,3) check (speed_kmh is null or speed_kmh >= 0),
  heading_degrees numeric(6,3) check (heading_degrees is null or heading_degrees >= 0 and heading_degrees < 360),
  altitude_meters numeric(12,3),
  ignition boolean,
  odometer_km numeric(14,3) check (odometer_km is null or odometer_km >= 0),
  persisted_at timestamptz not null default now(),
  constraint gps_positions_link_fk
    foreign key (company_id, provider_link_id)
    references public.gps_provider_vehicle_links (company_id, id) on delete restrict,
  constraint gps_positions_vehicle_fk
    foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint gps_positions_company_id_id_unique unique (company_id, id),
  constraint gps_positions_observation_unique unique (company_id, provider_kind, observation_key)
);

create index gps_positions_vehicle_recorded_at_idx
  on public.gps_positions (company_id, vehicle_id, recorded_at desc, received_at desc);
create index gps_positions_provider_asset_recorded_at_idx
  on public.gps_positions (company_id, provider_kind, external_asset_id, recorded_at desc, received_at desc);

create table public.vehicle_latest_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  vehicle_id uuid not null,
  position_id uuid not null,
  provider_kind text not null check (provider_kind ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  external_asset_id text not null check (length(trim(external_asset_id)) between 1 and 255),
  recorded_at timestamptz not null,
  received_at timestamptz not null,
  latitude numeric(10,7) not null check (latitude between -90 and 90),
  longitude numeric(10,7) not null check (longitude between -180 and 180),
  speed_kmh numeric(10,3) check (speed_kmh is null or speed_kmh >= 0),
  heading_degrees numeric(6,3) check (heading_degrees is null or heading_degrees >= 0 and heading_degrees < 360),
  altitude_meters numeric(12,3),
  ignition boolean,
  odometer_km numeric(14,3) check (odometer_km is null or odometer_km >= 0),
  updated_at timestamptz not null default now(),
  constraint vehicle_latest_positions_vehicle_fk
    foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  constraint vehicle_latest_positions_position_fk
    foreign key (company_id, position_id) references public.gps_positions (company_id, id) on delete restrict,
  constraint vehicle_latest_positions_company_vehicle_unique unique (company_id, vehicle_id)
);

create table public.gps_telemetry_retention_policies (
  company_id uuid primary key references public.companies (id) on delete restrict,
  historical_position_retention_days integer not null check (historical_position_retention_days between 1 and 3650),
  configured_by uuid not null,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gps_telemetry_retention_policies_configured_by_fk
    foreign key (company_id, configured_by) references public.profiles (company_id, id) on delete restrict
);

create trigger gps_telemetry_retention_policies_set_updated_at
  before update on public.gps_telemetry_retention_policies
  for each row execute function private.set_updated_at();

create table public.gps_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  provider_kind text not null check (provider_kind ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  status public.gps_sync_run_status not null default 'started',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  assets_seen integer not null default 0 check (assets_seen >= 0),
  positions_received integer not null default 0 check (positions_received >= 0),
  positions_persisted integer not null default 0 check (positions_persisted >= 0),
  positions_deduplicated integer not null default 0 check (positions_deduplicated >= 0),
  positions_unlinked integer not null default 0 check (positions_unlinked >= 0),
  error_code text,
  error_message text,
  constraint gps_sync_runs_completion check (
    (status = 'started' and finished_at is null)
    or (status <> 'started' and finished_at is not null)
  ),
  constraint gps_sync_runs_error_state check (
    (status = 'failed' and coalesce(length(trim(error_code)) > 0, false) and coalesce(length(trim(error_message)) > 0, false))
    or (status <> 'failed' and error_code is null and error_message is null)
  )
);

create index gps_sync_runs_provider_started_at_idx
  on public.gps_sync_runs (company_id, provider_kind, started_at desc);

comment on table public.gps_provider_vehicle_links is
  'Approved provider asset to internal vehicle mappings; provisional portal names are not auto-linked.';
comment on table public.gps_positions is
  'Immutable normalized GPS evidence; raw provider payloads and credentials are intentionally excluded.';
comment on table public.vehicle_latest_positions is
  'Monotonic latest-position projection; delayed evidence never makes this projection move backward.';
comment on table public.gps_telemetry_retention_policies is
  'No row means no automatic telemetry deletion is authorized for the company.';
comment on table public.gps_sync_runs is
  'Sanitized telemetry ingestion observability; it must not retain raw provider responses or secrets.';
