-- Goldcar may become the official odometer source only after an explicit
-- management enrollment tied to validated, current normalized evidence. Raw
-- GPS evidence remains separate and is still subject to its own retention.

create type public.gps_odometer_bootstrap_mode as enum (
  'standard',
  'test_placeholder'
);

create type public.gps_odometer_promotion_kind as enum (
  'baseline',
  'sync'
);

create type public.gps_odometer_promotion_outcome as enum (
  'advanced',
  'confirmed',
  'test_placeholder_replaced',
  'regression',
  'requires_review'
);

create type public.gps_odometer_authority_status as enum (
  'active',
  'suspended'
);

create type public.gps_odometer_review_decision as enum (
  'approved',
  'rejected'
);

-- Generic snapshots and CSV imports are useful telemetry, but they are not
-- eligible to establish the official odometer.  The only promotable marker is
-- written by the separate server-only Goldcar detail ingestion boundary below.
create type public.gps_position_source_kind as enum (
  'snapshot_csv',
  'goldcar_detail_html'
);

-- Goldcar exposes both cumulative distance and the vehicle odometer. The
-- authoritative path must preserve which semantic was selected, not merely
-- that the detail page happened to be read.
create type public.gps_odometer_source_semantic as enum (
  'unverified',
  'vehicle_odometer'
);

alter table public.gps_positions
  add column source_kind public.gps_position_source_kind not null default 'snapshot_csv',
  add column odometer_source_semantic public.gps_odometer_source_semantic not null default 'unverified';

comment on column public.gps_positions.source_kind is
  'Immutable ingestion provenance. Only goldcar_detail_html may be used for authoritative odometer enrollment, promotion, or review.';
comment on column public.gps_positions.odometer_source_semantic is
  'Immutable meaning of the reported kilometer value. Only vehicle_odometer, never Goldcar cumulative distance, is authority-eligible.';

create function private.guard_gps_position_provenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_kind is distinct from old.source_kind
    or new.odometer_source_semantic is distinct from old.odometer_source_semantic then
    raise exception using errcode = '23514', message = 'GPS evidence source provenance is immutable';
  end if;
  return new;
end;
$$;

create trigger gps_positions_provenance_immutable
before update of source_kind, odometer_source_semantic on public.gps_positions
for each row execute function private.guard_gps_position_provenance();

revoke all on function private.guard_gps_position_provenance()
  from public, anon, authenticated, service_role;

create table public.gps_odometer_authorities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  provider_link_id uuid not null,
  vehicle_id uuid not null,
  status public.gps_odometer_authority_status not null default 'active',
  bootstrap_mode public.gps_odometer_bootstrap_mode not null,
  baseline_position_id uuid not null,
  activation_request_id uuid not null,
  activated_by uuid not null,
  activated_at timestamptz not null default now(),
  suspended_by uuid,
  suspended_at timestamptz,
  suspension_reason text,
  constraint gps_odometer_authorities_company_id_id_unique unique (company_id, id),
  constraint gps_odometer_authorities_link_fk
    foreign key (company_id, provider_link_id)
    references public.gps_provider_vehicle_links (company_id, id)
    on delete restrict,
  constraint gps_odometer_authorities_vehicle_fk
    foreign key (company_id, vehicle_id)
    references public.vehicles (company_id, id)
    on delete restrict,
  constraint gps_odometer_authorities_actor_fk
    foreign key (company_id, activated_by)
    references public.profiles (company_id, id)
    on delete restrict,
  constraint gps_odometer_authorities_suspended_by_fk
    foreign key (company_id, suspended_by)
    references public.profiles (company_id, id)
    on delete restrict,
  constraint gps_odometer_authorities_request_unique unique (company_id, activation_request_id),
  constraint gps_odometer_authorities_suspension_state check (
    (status = 'active'
      and suspended_by is null
      and suspended_at is null
      and suspension_reason is null)
    or (
      status = 'suspended'
      and suspended_by is not null
      and suspended_at is not null
      and coalesce(length(trim(suspension_reason)) > 0, false)
    )
  )
);

create unique index gps_odometer_authorities_one_active_vehicle_idx
  on public.gps_odometer_authorities (company_id, vehicle_id)
  where status = 'active';
create unique index gps_odometer_authorities_one_active_link_idx
  on public.gps_odometer_authorities (company_id, provider_link_id)
  where status = 'active';
create index gps_odometer_authorities_vehicle_idx
  on public.gps_odometer_authorities (company_id, vehicle_id);

create table public.gps_odometer_promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  authority_id uuid not null,
  vehicle_id uuid not null,
  -- Deliberately no FK: raw GPS rows may expire after the configured retention
  -- period, while the official odometer audit must remain durable without
  -- retaining coordinates or provider identifiers.
  source_position_id uuid not null,
  source_kind public.gps_position_source_kind not null,
  source_odometer_semantic public.gps_odometer_source_semantic not null,
  source_recorded_at timestamptz not null,
  source_received_at timestamptz not null,
  reported_odometer_km numeric(14,3) not null
    check (reported_odometer_km >= 0 and reported_odometer_km <> 'NaN'::numeric),
  previous_odometer_km numeric(14,2) not null
    check (previous_odometer_km >= 0 and previous_odometer_km <> 'NaN'::numeric),
  resulting_odometer_km numeric(14,2) not null
    check (resulting_odometer_km >= 0 and resulting_odometer_km <> 'NaN'::numeric),
  promotion_kind public.gps_odometer_promotion_kind not null,
  outcome public.gps_odometer_promotion_outcome not null,
  bootstrap_mode public.gps_odometer_bootstrap_mode,
  odometer_entry_id uuid,
  sync_run_id uuid references public.gps_sync_runs (id) on delete restrict,
  authorized_by uuid not null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint gps_odometer_promotions_company_id_id_unique unique (company_id, id),
  constraint gps_odometer_promotions_authority_fk
    foreign key (company_id, authority_id)
    references public.gps_odometer_authorities (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotions_vehicle_fk
    foreign key (company_id, vehicle_id)
    references public.vehicles (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotions_entry_fk
    foreign key (company_id, odometer_entry_id)
    references public.odometer_entries (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotions_actor_fk
    foreign key (company_id, authorized_by)
    references public.profiles (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotions_source_unique unique (company_id, source_position_id),
  constraint gps_odometer_promotions_entry_unique unique (company_id, odometer_entry_id),
  constraint gps_odometer_promotions_detail_source check (
    source_kind = 'goldcar_detail_html'
    and source_odometer_semantic = 'vehicle_odometer'
  ),
  constraint gps_odometer_promotions_outcome_shape check (
    (
      promotion_kind = 'baseline'
      and bootstrap_mode is not null
      and odometer_entry_id is not null
      and outcome in ('advanced', 'confirmed', 'test_placeholder_replaced')
    )
    or (
      promotion_kind = 'sync'
      and bootstrap_mode is null
      and (
        (outcome = 'advanced' and odometer_entry_id is not null)
        or (outcome in ('confirmed', 'regression', 'requires_review') and odometer_entry_id is null)
      )
    )
  )
);

create unique index gps_odometer_promotions_one_test_placeholder_per_vehicle_idx
  on public.gps_odometer_promotions (company_id, vehicle_id)
  where promotion_kind = 'baseline'
    and bootstrap_mode = 'test_placeholder';

-- There is intentionally no default plausibility threshold. Management must
-- approve company-specific bounds before any non-baseline GPS reading may
-- advance a vehicle master automatically. This prevents a field-mapping error
-- (for example Goldcar's cumulative distance instead of its odometer) from
-- becoming an irreversible master-mileage jump.
create table public.gps_odometer_plausibility_policies (
  company_id uuid primary key references public.companies (id) on delete restrict,
  max_auto_advance_km numeric(14,2) not null
    check (max_auto_advance_km > 0 and max_auto_advance_km <> 'NaN'::numeric),
  max_average_speed_kmh numeric(10,2) not null
    check (max_average_speed_kmh > 0 and max_average_speed_kmh <> 'NaN'::numeric),
  configured_by uuid not null,
  configured_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) between 1 and 500),
  version integer not null default 1 check (version > 0),
  constraint gps_odometer_plausibility_policies_actor_fk
    foreign key (company_id, configured_by)
    references public.profiles (company_id, id)
    on delete restrict
);

-- A quarantine is immutable evidence of why automatic promotion stopped.
-- Management may make one explicit approved/rejected decision against it;
-- approval revalidates that the exact source is still current before it can
-- change the official master.
create table public.gps_odometer_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  promotion_id uuid not null,
  authority_id uuid not null,
  vehicle_id uuid not null,
  decision public.gps_odometer_review_decision not null,
  previous_odometer_km numeric(14,2) not null
    check (previous_odometer_km >= 0 and previous_odometer_km <> 'NaN'::numeric),
  resulting_odometer_km numeric(14,2) not null
    check (resulting_odometer_km >= 0 and resulting_odometer_km <> 'NaN'::numeric),
  odometer_entry_id uuid,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) between 1 and 500),
  idempotency_key uuid not null,
  constraint gps_odometer_promotion_reviews_company_id_id_unique unique (company_id, id),
  constraint gps_odometer_promotion_reviews_promotion_unique unique (company_id, promotion_id),
  constraint gps_odometer_promotion_reviews_request_unique unique (company_id, idempotency_key),
  constraint gps_odometer_promotion_reviews_promotion_fk
    foreign key (company_id, promotion_id)
    references public.gps_odometer_promotions (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotion_reviews_authority_fk
    foreign key (company_id, authority_id)
    references public.gps_odometer_authorities (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotion_reviews_vehicle_fk
    foreign key (company_id, vehicle_id)
    references public.vehicles (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotion_reviews_entry_fk
    foreign key (company_id, odometer_entry_id)
    references public.odometer_entries (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotion_reviews_actor_fk
    foreign key (company_id, reviewed_by)
    references public.profiles (company_id, id)
    on delete restrict,
  constraint gps_odometer_promotion_reviews_shape check (
    (decision = 'approved'
      and odometer_entry_id is not null
      and resulting_odometer_km > previous_odometer_km)
    or (decision = 'rejected'
      and odometer_entry_id is null
      and resulting_odometer_km = previous_odometer_km)
  )
);

alter table public.gps_odometer_authorities enable row level security;
alter table public.gps_odometer_authorities force row level security;
alter table public.gps_odometer_promotions enable row level security;
alter table public.gps_odometer_promotions force row level security;
alter table public.gps_odometer_plausibility_policies enable row level security;
alter table public.gps_odometer_plausibility_policies force row level security;
alter table public.gps_odometer_promotion_reviews enable row level security;
alter table public.gps_odometer_promotion_reviews force row level security;

revoke all on table public.gps_odometer_authorities from anon, authenticated;
revoke all on table public.gps_odometer_promotions from anon, authenticated;
revoke all on table public.gps_odometer_plausibility_policies from anon, authenticated;
revoke all on table public.gps_odometer_promotion_reviews from anon, authenticated;
grant all on table public.gps_odometer_authorities to service_role;
grant all on table public.gps_odometer_promotions to service_role;
grant all on table public.gps_odometer_plausibility_policies to service_role;
grant all on table public.gps_odometer_promotion_reviews to service_role;
grant select on table public.gps_odometer_authorities to authenticated;
grant select on table public.gps_odometer_promotions to authenticated;
grant select on table public.gps_odometer_plausibility_policies to authenticated;
grant select on table public.gps_odometer_promotion_reviews to authenticated;

create policy gps_odometer_authorities_management_select
  on public.gps_odometer_authorities for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.current_app_role()) = 'management'
  );
create policy gps_odometer_promotions_management_select
  on public.gps_odometer_promotions for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.current_app_role()) = 'management'
  );
create policy gps_odometer_plausibility_policies_management_select
  on public.gps_odometer_plausibility_policies for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.current_app_role()) = 'management'
  );
create policy gps_odometer_promotion_reviews_management_select
  on public.gps_odometer_promotion_reviews for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.current_app_role()) = 'management'
  );

-- The ordinary staff CRUD grant predates authoritative GPS mileage. Retain
-- editable vehicle-master fields, but never grant a client direct authority
-- to alter the official master odometer.
revoke update on table public.vehicles from authenticated;
grant update (
  plate,
  make,
  model,
  model_year,
  ownership_type,
  owner_name,
  capacity_tons,
  current_status,
  active,
  notes
) on table public.vehicles to authenticated;

-- PostgreSQL numeric accepts NaN and ordinary non-negative comparisons do not
-- reject it. Keep existing historical rows deployable while rejecting NaN on
-- every new/changed authoritative or odometer-evidence record.
alter table public.vehicles
  add constraint vehicles_current_odometer_finite
  check (current_odometer_km <> 'NaN'::numeric) not valid;
alter table public.gps_positions
  add constraint gps_positions_odometer_finite
  check (odometer_km is null or odometer_km <> 'NaN'::numeric) not valid;
alter table public.vehicle_latest_positions
  add constraint vehicle_latest_positions_odometer_finite
  check (odometer_km is null or odometer_km <> 'NaN'::numeric) not valid;
alter table public.odometer_entries
  add constraint odometer_entries_reading_finite
  check (reading_km <> 'NaN'::numeric) not valid;
alter table public.fuel_entries
  add constraint fuel_entries_odometer_finite
  check (odometer_km <> 'NaN'::numeric) not valid;
alter table public.work_orders
  add constraint work_orders_odometer_finite
  check (odometer_km is null or odometer_km <> 'NaN'::numeric) not valid;

-- Existing commands intentionally keep recording manual odometer evidence.
-- Once a vehicle has ever been enrolled, including after source suspension,
-- this trigger prevents every non-authorized projection from changing the
-- master while preserving other fields from the same UPDATE (for example
-- operational status). Only the narrowly scoped enrollment and sync helper
-- set the transaction-local capability immediately around their update.
create function private.guard_authoritative_gps_odometer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_odometer_km is distinct from old.current_odometer_km
    and current_setting('rt.gps_odometer_write', true) is distinct from 'enabled'
    and exists (
      select 1
      from public.gps_odometer_authorities authority
      where authority.company_id = old.company_id
        and authority.vehicle_id = old.id
    ) then
    new.current_odometer_km := old.current_odometer_km;
  end if;
  return new;
end;
$$;

create trigger vehicles_guard_authoritative_gps_odometer_update
  before update of current_odometer_km on public.vehicles
  for each row execute function private.guard_authoritative_gps_odometer_update();

create function private.has_gps_odometer_authority(
  p_company_id uuid,
  p_vehicle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gps_odometer_authorities authority
    where authority.company_id = p_company_id
      and authority.vehicle_id = p_vehicle_id
  )
$$;

create function public.configure_gps_odometer_plausibility_policy(
  p_max_auto_advance_km numeric,
  p_max_average_speed_kmh numeric,
  p_reason text
)
returns public.gps_odometer_plausibility_policies
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  normalized_reason text := trim(p_reason);
  old_policy public.gps_odometer_plausibility_policies;
  new_policy public.gps_odometer_plausibility_policies;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_max_auto_advance_km is null
    or p_max_average_speed_kmh is null
    or p_max_auto_advance_km = 'NaN'::numeric
    or p_max_average_speed_kmh = 'NaN'::numeric
    or p_max_auto_advance_km <= 0
    or p_max_average_speed_kmh <= 0
    or p_max_auto_advance_km <> round(p_max_auto_advance_km, 2)
    or p_max_average_speed_kmh <> round(p_max_average_speed_kmh, 2)
    or coalesce(length(normalized_reason) not between 1 and 500, true) then
    raise exception using errcode = '23514', message = 'Invalid GPS odometer plausibility policy';
  end if;

  select * into old_policy
  from public.gps_odometer_plausibility_policies policy
  where policy.company_id = current_company_id
  for update;
  insert into public.gps_odometer_plausibility_policies (
    company_id,
    max_auto_advance_km,
    max_average_speed_kmh,
    configured_by,
    configured_at,
    reason,
    version
  ) values (
    current_company_id,
    p_max_auto_advance_km,
    p_max_average_speed_kmh,
    current_actor_id,
    now(),
    normalized_reason,
    1
  ) on conflict (company_id) do update
  set max_auto_advance_km = excluded.max_auto_advance_km,
      max_average_speed_kmh = excluded.max_average_speed_kmh,
      configured_by = excluded.configured_by,
      configured_at = excluded.configured_at,
      reason = excluded.reason,
      version = public.gps_odometer_plausibility_policies.version + 1
  returning * into new_policy;

  perform private.write_audit(
    current_company_id,
    'GPS_ODOMETER_PLAUSIBILITY_POLICY_CONFIGURED',
    'gps_odometer_plausibility_policy',
    current_company_id,
    to_jsonb(old_policy),
    to_jsonb(new_policy),
    normalized_reason
  );
  return new_policy;
end;
$$;

create function public.suspend_gps_odometer_authority(
  p_authority_id uuid,
  p_reason text
)
returns public.gps_odometer_authorities
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  normalized_reason text := trim(p_reason);
  old_authority public.gps_odometer_authorities;
  new_authority public.gps_odometer_authorities;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_authority_id is null
    or coalesce(length(normalized_reason) not between 1 and 500, true) then
    raise exception using errcode = '23514', message = 'GPS odometer authority suspension reason is required';
  end if;
  select * into old_authority
  from public.gps_odometer_authorities authority
  where authority.company_id = current_company_id
    and authority.id = p_authority_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'GPS odometer authority not found';
  end if;
  if old_authority.status = 'suspended' then
    return old_authority;
  end if;
  update public.gps_odometer_authorities authority
  set status = 'suspended',
      suspended_by = auth.uid(),
      suspended_at = now(),
      suspension_reason = normalized_reason
  where authority.company_id = current_company_id
    and authority.id = old_authority.id
  returning * into new_authority;
  perform private.write_audit(
    current_company_id,
    'GPS_ODOMETER_AUTHORITY_SUSPENDED',
    'gps_odometer_authority',
    new_authority.id,
    jsonb_build_object('status', old_authority.status::text),
    jsonb_build_object('status', new_authority.status::text),
    normalized_reason
  );
  return new_authority;
end;
$$;

create function public.activate_gps_odometer_authority(
  p_provider_link_id uuid,
  p_position_id uuid,
  p_expected_current_odometer_km numeric,
  p_bootstrap_mode public.gps_odometer_bootstrap_mode,
  p_reason text,
  p_idempotency_key uuid
)
returns public.gps_odometer_promotions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  normalized_reason text := trim(p_reason);
  expected_odometer_km numeric(14,2) := round(p_expected_current_odometer_km, 2);
  source_odometer_km numeric(14,2);
  source_position public.gps_positions;
  link_row public.gps_provider_vehicle_links;
  vehicle_row public.vehicles;
  existing_authority public.gps_odometer_authorities;
  new_authority public.gps_odometer_authorities;
  existing_promotion public.gps_odometer_promotions;
  new_promotion public.gps_odometer_promotions;
  new_entry public.odometer_entries;
  baseline_outcome public.gps_odometer_promotion_outcome;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_provider_link_id is null
    or p_position_id is null
    or p_idempotency_key is null
    or p_bootstrap_mode is null
    or p_expected_current_odometer_km is null
    or p_expected_current_odometer_km = 'NaN'::numeric
    or p_expected_current_odometer_km < 0
    or p_expected_current_odometer_km <> expected_odometer_km
    or coalesce(length(normalized_reason) not between 1 and 500, true) then
    raise exception using errcode = '23514', message = 'Invalid GPS odometer authority enrollment';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':gps-odometer-authority:' || p_provider_link_id::text, 0)
  );
  select * into existing_authority
  from public.gps_odometer_authorities authority
  where authority.company_id = current_company_id
    and authority.activation_request_id = p_idempotency_key
  for update;
  if found then
    select * into existing_promotion
    from public.gps_odometer_promotions promotion
    where promotion.company_id = current_company_id
      and promotion.authority_id = existing_authority.id
      and promotion.promotion_kind = 'baseline';
    if not found
      or existing_authority.provider_link_id is distinct from p_provider_link_id
      or existing_authority.baseline_position_id is distinct from p_position_id
      or existing_authority.bootstrap_mode is distinct from p_bootstrap_mode
      or existing_authority.activated_by is distinct from current_actor_id
      or existing_promotion.previous_odometer_km is distinct from expected_odometer_km
      or existing_promotion.reason is distinct from normalized_reason then
      raise exception using errcode = '23505', message = 'GPS odometer authority idempotency key was already used';
    end if;
    return existing_promotion;
  end if;

  select * into link_row
  from public.gps_provider_vehicle_links link
  where link.company_id = current_company_id
    and link.id = p_provider_link_id
    and link.active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active approved GPS mapping not found';
  end if;
  if link_row.provider_kind <> 'GOLDCAR_PORTAL_RPA' then
    raise exception using errcode = '23514', message = 'GPS odometer authority requires a Goldcar portal detail mapping';
  end if;

  select position.* into source_position
  from public.gps_positions position
  join public.vehicle_latest_positions latest
    on latest.company_id = position.company_id
    and latest.vehicle_id = position.vehicle_id
    and latest.position_id = position.id
  where position.company_id = current_company_id
    and position.id = p_position_id
    and position.provider_link_id = link_row.id
    and position.vehicle_id = link_row.vehicle_id
    and position.provider_kind = 'GOLDCAR_PORTAL_RPA'
    and position.source_kind = 'goldcar_detail_html'
    and position.odometer_source_semantic = 'vehicle_odometer'
    and position.odometer_km is not null
  for update of latest;
  if not found then
    raise exception using errcode = '23514', message = 'GPS odometer enrollment requires current Goldcar detail-field evidence';
  end if;
  if source_position.recorded_at > clock_timestamp() then
    raise exception using errcode = '23514', message = 'GPS odometer enrollment cannot use future-dated GPS evidence';
  end if;

  select * into vehicle_row
  from public.vehicles vehicle
  where vehicle.company_id = current_company_id
    and vehicle.id = link_row.vehicle_id
    and vehicle.active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active linked vehicle not found';
  end if;
  if vehicle_row.current_odometer_km = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'Vehicle master odometer is not finite';
  end if;
  if p_bootstrap_mode = 'test_placeholder' then
    if exists (
      select 1
      from public.gps_odometer_promotions promotion
      where promotion.company_id = current_company_id
        and promotion.vehicle_id = vehicle_row.id
        and promotion.promotion_kind = 'baseline'
        and promotion.bootstrap_mode = 'test_placeholder'
    ) then
      raise exception using errcode = '23505', message = 'Vehicle already used its one-time test-placeholder odometer correction';
    end if;
    -- DEC-032 authorizes exactly one downward correction: the known false
    -- 141601 km value on VDR-768.  This is deliberately not a reusable
    -- per-vehicle escape hatch; every other correction needs a future DEC.
    if vehicle_row.plate <> 'VDR-768'
      or vehicle_row.current_odometer_km <> 141601::numeric
      or expected_odometer_km <> 141601::numeric then
      raise exception using errcode = '23514', message = 'Test-placeholder GPS correction is restricted to VDR-768 at 141601 km';
    end if;
  end if;
  if vehicle_row.current_odometer_km is distinct from expected_odometer_km then
    raise exception using errcode = '40001', message = 'Vehicle odometer changed before GPS authority enrollment';
  end if;
  if exists (
    select 1
    from public.gps_odometer_authorities authority
    where authority.company_id = current_company_id
      and authority.vehicle_id = vehicle_row.id
      and authority.status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'Vehicle already has an active GPS odometer authority';
  end if;
  if exists (
    select 1
    from public.trips trip
    where trip.company_id = current_company_id
      and trip.vehicle_id = vehicle_row.id
      and trip.operational_status in ('loading', 'in_transit', 'unloading')
  ) then
    raise exception using errcode = '23514', message = 'GPS odometer authority cannot be enrolled during an active trip';
  end if;

  if source_position.odometer_km = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'GPS odometer evidence is not finite';
  end if;
  source_odometer_km := round(source_position.odometer_km, 2);
  if p_bootstrap_mode = 'standard' then
    if source_odometer_km < vehicle_row.current_odometer_km then
      raise exception using errcode = '23514', message = 'Validated GPS odometer cannot decrease the official vehicle mileage';
    end if;
    baseline_outcome := case
      when source_odometer_km > vehicle_row.current_odometer_km then 'advanced'
      else 'confirmed'
    end;
  else
    if source_odometer_km >= vehicle_row.current_odometer_km then
      raise exception using errcode = '23514', message = 'Test-placeholder enrollment requires a lower validated GPS odometer';
    end if;
    baseline_outcome := 'test_placeholder_replaced';
  end if;

  insert into public.gps_odometer_authorities (
    company_id,
    provider_link_id,
    vehicle_id,
    bootstrap_mode,
    baseline_position_id,
    activation_request_id,
    activated_by
  ) values (
    current_company_id,
    link_row.id,
    vehicle_row.id,
    p_bootstrap_mode,
    source_position.id,
    p_idempotency_key,
    current_actor_id
  ) returning * into new_authority;

  insert into public.odometer_entries (
    company_id,
    vehicle_id,
    trip_id,
    reading_km,
    reading_at,
    reading_type,
    source,
    recorded_by,
    idempotency_key
  ) values (
    current_company_id,
    vehicle_row.id,
    null,
    source_odometer_km,
    source_position.recorded_at,
    'gps_baseline',
    'goldcar',
    current_actor_id,
    p_idempotency_key
  ) returning * into new_entry;

  insert into public.gps_odometer_promotions (
    company_id,
    authority_id,
    vehicle_id,
    source_position_id,
    source_kind,
    source_odometer_semantic,
    source_recorded_at,
    source_received_at,
    reported_odometer_km,
    previous_odometer_km,
    resulting_odometer_km,
    promotion_kind,
    outcome,
    bootstrap_mode,
    odometer_entry_id,
    sync_run_id,
    authorized_by,
    reason
  ) values (
    current_company_id,
    new_authority.id,
    vehicle_row.id,
    source_position.id,
    source_position.source_kind,
    source_position.odometer_source_semantic,
    source_position.recorded_at,
    source_position.received_at,
    source_position.odometer_km,
    vehicle_row.current_odometer_km,
    source_odometer_km,
    'baseline',
    baseline_outcome,
    p_bootstrap_mode,
    new_entry.id,
    source_position.sync_run_id,
    current_actor_id,
    normalized_reason
  ) returning * into new_promotion;

  if source_odometer_km is distinct from vehicle_row.current_odometer_km then
    perform set_config('rt.gps_odometer_write', 'enabled', true);
    update public.vehicles vehicle
    set current_odometer_km = source_odometer_km
    where vehicle.company_id = current_company_id
      and vehicle.id = vehicle_row.id;
    perform set_config('rt.gps_odometer_write', 'disabled', true);
  end if;

  perform private.write_audit(
    current_company_id,
    'GPS_ODOMETER_AUTHORITY_ENROLLED',
    'gps_odometer_authority',
    new_authority.id,
    null,
    jsonb_build_object(
      'vehicle_id', vehicle_row.id,
      'baseline_position_id', source_position.id,
      'promotion_id', new_promotion.id,
      'bootstrap_mode', p_bootstrap_mode::text,
      'source_kind', source_position.source_kind::text,
      'source_odometer_semantic', source_position.odometer_source_semantic::text,
      'reported_odometer_km', source_position.odometer_km,
      'previous_odometer_km', vehicle_row.current_odometer_km,
      'resulting_odometer_km', source_odometer_km,
      'recorded_at', source_position.recorded_at,
      'received_at', source_position.received_at
    ),
    normalized_reason
  );
  if baseline_outcome = 'test_placeholder_replaced' then
    perform private.write_audit(
      current_company_id,
      'VEHICLE_ODOMETER_TEST_PLACEHOLDER_REPLACED',
      'vehicle',
      vehicle_row.id,
      jsonb_build_object('current_odometer_km', vehicle_row.current_odometer_km),
      jsonb_build_object(
        'current_odometer_km', source_odometer_km,
        'promotion_id', new_promotion.id,
        'authority_id', new_authority.id
      ),
      normalized_reason
    );
  end if;
  return new_promotion;
end;
$$;

create function private.promote_authoritative_gps_odometer_from_sync(
  p_run_id uuid,
  p_position_id uuid
)
returns public.gps_odometer_promotion_outcome
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  sync_run public.gps_sync_runs;
  source_position public.gps_positions;
  latest_position public.vehicle_latest_positions;
  authority_row public.gps_odometer_authorities;
  vehicle_row public.vehicles;
  plausibility_policy public.gps_odometer_plausibility_policies;
  last_accepted_promotion public.gps_odometer_promotions;
  existing_promotion public.gps_odometer_promotions;
  new_promotion public.gps_odometer_promotions;
  new_entry public.odometer_entries;
  source_odometer_km numeric(14,2);
  advance_km numeric(14,2);
  elapsed_hours numeric;
  quarantine_reason text;
  promotion_outcome public.gps_odometer_promotion_outcome;
  canonical_reason constant text := 'Validated Goldcar odometer synchronization';
begin
  select * into sync_run
  from public.gps_sync_runs run
  where run.id = p_run_id
  for share;
  if not found or sync_run.initiated_by is null then
    raise exception using errcode = 'P0002', message = 'GPS synchronization authorizer not found';
  end if;

  select * into source_position
  from public.gps_positions position
  where position.id = p_position_id
    and position.company_id = sync_run.company_id
    and position.sync_run_id = sync_run.id;
  if not found then
    raise exception using errcode = 'P0002', message = 'GPS synchronization evidence not found';
  end if;
  if source_position.odometer_km is null then
    return null;
  end if;
  if source_position.odometer_km = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'GPS odometer evidence is not finite';
  end if;
  if sync_run.provider_kind <> 'GOLDCAR_PORTAL_RPA'
    or source_position.provider_kind <> 'GOLDCAR_PORTAL_RPA'
    or source_position.source_kind <> 'goldcar_detail_html'
    or source_position.odometer_source_semantic <> 'vehicle_odometer' then
    -- Generic snapshot/CSV evidence remains in telemetry but is never an
    -- authoritative odometer candidate.
    return null;
  end if;
  select * into latest_position
  from public.vehicle_latest_positions latest
  where latest.company_id = source_position.company_id
    and latest.vehicle_id = source_position.vehicle_id
  for update;
  if not found or latest_position.position_id is distinct from source_position.id then
    -- Late evidence is retained by the telemetry contract, but an older
    -- observation must never become an authoritative odometer side effect.
    return null;
  end if;

  select * into existing_promotion
  from public.gps_odometer_promotions promotion
  where promotion.company_id = sync_run.company_id
    and promotion.source_position_id = source_position.id;
  if found then
    return existing_promotion.outcome;
  end if;

  select authority.* into authority_row
  from public.gps_odometer_authorities authority
  join public.gps_provider_vehicle_links link
    on link.company_id = authority.company_id
    and link.id = authority.provider_link_id
  where authority.company_id = sync_run.company_id
    and authority.status = 'active'
    and authority.provider_link_id = source_position.provider_link_id
    and authority.vehicle_id = source_position.vehicle_id
    and link.active
    and link.provider_kind = 'GOLDCAR_PORTAL_RPA'
    and link.vehicle_id = source_position.vehicle_id
  for update of authority;
  if not found then
    return null;
  end if;

  select * into vehicle_row
  from public.vehicles vehicle
  where vehicle.company_id = sync_run.company_id
    and vehicle.id = source_position.vehicle_id
    and vehicle.active
  for update;
  if not found then
    return null;
  end if;

  -- Re-read after the authority/vehicle locks. The first row lock normally
  -- serializes legacy ingestion; this explicit revalidation also fails closed
  -- if an older writer replaced the projection before that lock was acquired.
  select * into latest_position
  from public.vehicle_latest_positions latest
  where latest.company_id = source_position.company_id
    and latest.vehicle_id = source_position.vehicle_id
  for update;
  if not found or latest_position.position_id is distinct from source_position.id then
    return null;
  end if;
  if vehicle_row.current_odometer_km = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'Vehicle master odometer is not finite';
  end if;
  source_odometer_km := round(source_position.odometer_km, 2);
  if source_position.recorded_at > clock_timestamp() then
    new_entry := null;
    promotion_outcome := 'requires_review';
    quarantine_reason := 'GPS odometer evidence is recorded in the future';
  elsif source_odometer_km > vehicle_row.current_odometer_km then
    select * into plausibility_policy
    from public.gps_odometer_plausibility_policies policy
    where policy.company_id = sync_run.company_id
    for share;
    if not found then
      promotion_outcome := 'requires_review';
      quarantine_reason := 'No management-approved GPS odometer plausibility policy exists';
    else
      select promotion.* into last_accepted_promotion
      from public.gps_odometer_promotions promotion
      left join public.gps_odometer_promotion_reviews review
        on review.company_id = promotion.company_id
        and review.promotion_id = promotion.id
        and review.decision = 'approved'
      where promotion.company_id = sync_run.company_id
        and promotion.authority_id = authority_row.id
        and (
          promotion.outcome in ('advanced', 'confirmed', 'test_placeholder_replaced')
          or review.id is not null
        )
      order by promotion.source_recorded_at desc,
               promotion.source_received_at desc,
               promotion.created_at desc
      limit 1;
      advance_km := source_odometer_km - vehicle_row.current_odometer_km;
      if not found
        or source_position.recorded_at <= last_accepted_promotion.source_recorded_at then
        promotion_outcome := 'requires_review';
        quarantine_reason := 'GPS odometer advance has no positive elapsed source time';
      else
        elapsed_hours := extract(epoch from (
          source_position.recorded_at - last_accepted_promotion.source_recorded_at
        ))::numeric / 3600;
        if advance_km > plausibility_policy.max_auto_advance_km
          or advance_km / elapsed_hours > plausibility_policy.max_average_speed_kmh then
          promotion_outcome := 'requires_review';
          quarantine_reason := 'GPS odometer advance exceeds the approved plausibility policy';
        else
          promotion_outcome := 'advanced';
        end if;
      end if;
    end if;

    if promotion_outcome = 'advanced' then
      insert into public.odometer_entries (
        company_id,
        vehicle_id,
        trip_id,
        reading_km,
        reading_at,
        reading_type,
        source,
        recorded_by,
        idempotency_key
      ) values (
        sync_run.company_id,
        vehicle_row.id,
        null,
        source_odometer_km,
        source_position.recorded_at,
        'gps_sync',
        'goldcar',
        sync_run.initiated_by,
        gen_random_uuid()
      ) returning * into new_entry;
    else
      new_entry := null;
    end if;
  elsif source_odometer_km = vehicle_row.current_odometer_km then
    new_entry := null;
    promotion_outcome := 'confirmed';
  else
    new_entry := null;
    promotion_outcome := 'regression';
  end if;

  insert into public.gps_odometer_promotions (
    company_id,
    authority_id,
    vehicle_id,
    source_position_id,
    source_kind,
    source_odometer_semantic,
    source_recorded_at,
    source_received_at,
    reported_odometer_km,
    previous_odometer_km,
    resulting_odometer_km,
    promotion_kind,
    outcome,
    odometer_entry_id,
    sync_run_id,
    authorized_by,
    reason
  ) values (
    sync_run.company_id,
    authority_row.id,
    vehicle_row.id,
    source_position.id,
    source_position.source_kind,
    source_position.odometer_source_semantic,
    source_position.recorded_at,
    source_position.received_at,
    source_position.odometer_km,
    vehicle_row.current_odometer_km,
    case
      when promotion_outcome = 'advanced' then source_odometer_km
      else vehicle_row.current_odometer_km
    end,
    'sync',
    promotion_outcome,
    new_entry.id,
    sync_run.id,
    sync_run.initiated_by,
    canonical_reason
  ) returning * into new_promotion;

  if promotion_outcome = 'advanced' then
    perform set_config('rt.gps_odometer_write', 'enabled', true);
    update public.vehicles vehicle
    set current_odometer_km = source_odometer_km
    where vehicle.company_id = sync_run.company_id
      and vehicle.id = vehicle_row.id;
    perform set_config('rt.gps_odometer_write', 'disabled', true);
  end if;

  insert into public.audit_events (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  ) values (
    sync_run.company_id,
    sync_run.initiated_by,
    case
      when promotion_outcome = 'advanced' then 'GPS_ODOMETER_PROMOTED'
      when promotion_outcome = 'confirmed' then 'GPS_ODOMETER_CONFIRMED'
      when promotion_outcome = 'requires_review' then 'GPS_ODOMETER_ADVANCE_QUARANTINED'
      else 'GPS_ODOMETER_REGRESSION_DETECTED'
    end,
    'vehicle',
    vehicle_row.id,
    jsonb_build_object('current_odometer_km', vehicle_row.current_odometer_km),
    jsonb_build_object(
      'current_odometer_km', case
        when promotion_outcome = 'advanced' then source_odometer_km
        else vehicle_row.current_odometer_km
      end,
      'promotion_id', new_promotion.id,
      'authority_id', authority_row.id,
      'source_kind', source_position.source_kind::text,
      'source_odometer_semantic', source_position.odometer_source_semantic::text,
      'reported_odometer_km', source_position.odometer_km,
      'recorded_at', source_position.recorded_at,
      'received_at', source_position.received_at,
      'quarantine_reason', quarantine_reason,
      'plausibility_policy_version', plausibility_policy.version
    ),
    coalesce(quarantine_reason, canonical_reason)
  );
  return promotion_outcome;
end;
$$;

-- Preserve the established Stage 3 generic return contract. Its snapshots
-- remain telemetry evidence only; only the distinct Goldcar-detail endpoint
-- below can mark a source eligible for authoritative odometer handling.
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
    or p_odometer_km is not null and (
      p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric
    ) then
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
    company_id, provider_link_id, vehicle_id, sync_run_id, provider_kind, source_kind, odometer_source_semantic, external_asset_id,
    provider_event_id, observation_key, recorded_at, received_at, latitude, longitude,
    speed_kmh, heading_degrees, altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.id, link_row.vehicle_id, sync_run.id, provider_kind_normalized,
    'snapshot_csv', 'unverified', external_asset_id_normalized, nullif(trim(p_provider_event_id), ''), observation_key_normalized,
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

  perform private.promote_authoritative_gps_odometer_from_sync(sync_run.id, persisted_position_id);
  position_id := persisted_position_id;
  disposition := 'persisted';
  return next;
end;
$$;

-- This is the only server-only path permitted to mark a reading as a value
-- extracted from Goldcar's vehicle-detail screen.  The generic sync endpoint
-- deliberately hard-codes snapshot_csv, so a CSV/snapshot cannot be
-- relabeled by a caller-provided flag.
create function public.ingest_goldcar_detail_position_for_sync(
  p_run_id uuid,
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
  provider_kind_normalized constant text := 'GOLDCAR_PORTAL_RPA';
  external_asset_id_normalized text := trim(p_external_asset_id);
  observation_key_normalized text := trim(p_observation_key);
  sync_run public.gps_sync_runs;
  link_row public.gps_provider_vehicle_links;
  persisted_position_id uuid;
  existing_position public.gps_positions;
begin
  if p_run_id is null
    or coalesce(length(external_asset_id_normalized) not between 1 and 255, true)
    or coalesce(length(observation_key_normalized) not between 1 and 512, true) then
    raise exception using errcode = '23514', message = 'Invalid Goldcar detail synchronization evidence identity';
  end if;
  if p_recorded_at is null or p_received_at is null
    or p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180
    or p_speed_kmh is not null and p_speed_kmh < 0
    or p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360)
    or p_odometer_km is not null and (
      p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric
    ) then
    raise exception using errcode = '23514', message = 'Invalid Goldcar detail synchronization evidence';
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
    raise exception using errcode = '55P03', message = 'Goldcar detail synchronization run does not hold an active lease';
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
    company_id, provider_link_id, vehicle_id, sync_run_id, provider_kind, source_kind, odometer_source_semantic, external_asset_id,
    provider_event_id, observation_key, recorded_at, received_at, latitude, longitude,
    speed_kmh, heading_degrees, altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.id, link_row.vehicle_id, sync_run.id, provider_kind_normalized,
    'goldcar_detail_html', 'vehicle_odometer', external_asset_id_normalized, nullif(trim(p_provider_event_id), ''), observation_key_normalized,
    p_recorded_at, p_received_at, p_latitude, p_longitude, p_speed_kmh, p_heading_degrees,
    p_altitude_meters, p_ignition, p_odometer_km
  ) on conflict (company_id, provider_kind, observation_key) do nothing
  returning id into persisted_position_id;

  if persisted_position_id is null then
    select position.* into existing_position
    from public.gps_positions position
    where position.company_id = link_row.company_id
      and position.provider_kind = provider_kind_normalized
      and position.observation_key = observation_key_normalized;
    if existing_position.source_kind <> 'goldcar_detail_html'
      or existing_position.odometer_source_semantic <> 'vehicle_odometer'
      or existing_position.provider_link_id is distinct from link_row.id
      or existing_position.vehicle_id is distinct from link_row.vehicle_id then
      raise exception using errcode = '23505', message = 'Goldcar detail observation key already belongs to incompatible GPS evidence';
    end if;
    persisted_position_id := existing_position.id;
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

  perform private.promote_authoritative_gps_odometer_from_sync(sync_run.id, persisted_position_id);
  position_id := persisted_position_id;
  disposition := 'persisted';
  return next;
end;
$$;

-- Keep the legacy server-only ingestion endpoint finite as well. It remains
-- snapshot_csv telemetry and is never eligible for authoritative enrollment.
create or replace function public.ingest_gps_position(
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
    or p_odometer_km is not null and (
      p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric
    ) then
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
    company_id, provider_link_id, vehicle_id, provider_kind, source_kind, odometer_source_semantic, external_asset_id, provider_event_id,
    observation_key, recorded_at, received_at, latitude, longitude, speed_kmh, heading_degrees,
    altitude_meters, ignition, odometer_km
  ) values (
    link_row.company_id, link_row.id, link_row.vehicle_id, provider_kind_normalized, 'snapshot_csv', 'unverified', external_asset_id_normalized,
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

create or replace function public.unlink_gps_vehicle(p_link_id uuid, p_reason text)
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
  old_authority public.gps_odometer_authorities;
  new_authority public.gps_odometer_authorities;
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
  select * into old_authority
  from public.gps_odometer_authorities authority
  where authority.company_id = current_company_id
    and authority.provider_link_id = old_link.id
    and authority.status = 'active'
  for update;
  if found then
    update public.gps_odometer_authorities authority
    set status = 'suspended',
        suspended_by = auth.uid(),
        suspended_at = now(),
        suspension_reason = normalized_reason
    where authority.id = old_authority.id
    returning * into new_authority;
    perform private.write_audit(
      current_company_id,
      'GPS_ODOMETER_AUTHORITY_SUSPENDED',
      'gps_odometer_authority',
      new_authority.id,
      jsonb_build_object('status', old_authority.status::text),
      jsonb_build_object('status', new_authority.status::text),
      normalized_reason
    );
  end if;
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

revoke all on function public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_authoritative_gps_odometer_update()
  from public, anon, authenticated, service_role;
revoke all on function private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.unlink_gps_vehicle(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)
  to authenticated;
grant execute on function private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)
  to service_role;
grant execute on function public.unlink_gps_vehicle(uuid,text)
  to authenticated;
grant execute on function public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
grant execute on function public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;

-- This candidate surface is intentionally online-only and narrower than raw
-- telemetry: it gives Gerencia exactly the current evidence needed to decide
-- an enrollment, never coordinates, provider IDs, labels, payloads or history.
create or replace view public.vehicle_gps_odometer_candidate
with (security_invoker = true)
as
select
  position.id as position_id,
  vehicle.id as vehicle_id,
  position.provider_kind,
  position.recorded_at,
  position.received_at,
  position.odometer_km,
  vehicle.current_odometer_km,
  authority.status as authority_status
from public.vehicle_latest_positions latest
join public.gps_positions position
  on position.company_id = latest.company_id
  and position.vehicle_id = latest.vehicle_id
  and position.id = latest.position_id
join public.gps_provider_vehicle_links link
  on link.company_id = position.company_id
  and link.id = position.provider_link_id
  and link.active
join public.vehicles vehicle
  on vehicle.company_id = position.company_id
  and vehicle.id = position.vehicle_id
left join lateral (
  select authority_row.status
  from public.gps_odometer_authorities authority_row
  where authority_row.company_id = position.company_id
    and authority_row.vehicle_id = position.vehicle_id
  order by authority_row.activated_at desc, authority_row.id desc
  limit 1
) authority on true
where position.odometer_km is not null
  and position.provider_kind = 'GOLDCAR_PORTAL_RPA'
  and position.source_kind = 'goldcar_detail_html'
  and position.odometer_source_semantic = 'vehicle_odometer'
  and (select private.current_app_role()) = 'management';

revoke all on table public.vehicle_gps_odometer_candidate from public, anon, authenticated;
grant select on table public.vehicle_gps_odometer_candidate to authenticated;

comment on table public.gps_odometer_authorities is
  'Management-approved GPS source authority for a vehicle master odometer; suspension never silently restores manual master updates.';
comment on table public.gps_odometer_promotions is
  'Durable, non-location provenance for Goldcar detail-field odometer baselines, promotions and regressions after raw telemetry retention expires.';

-- Manual records remain business evidence after GPS authority is enrolled.
-- Their ordinary master projection is retained only for vehicles that have
-- never had an authority; the vehicle trigger then provides a second guard
-- against a race with enrollment/suspension.
create or replace function public.start_trip(
  p_trip_id uuid,
  p_odometer_km numeric,
  p_expected_version integer,
  p_idempotency_key uuid
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
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  if p_odometer_km is null
    or p_odometer_km = 'NaN'::numeric
    or p_odometer_km < 0 then
    raise exception using errcode = '23514', message = 'Trip start odometer must be finite and non-negative';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version
     or old_trip.operational_status <> 'loading'
     or old_trip.vehicle_id is null
     or old_trip.driver_id is null then
    raise exception using errcode = '40001', message = 'Trip changed or is not ready to start';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) and not private.has_gps_odometer_authority(current_company_id, old_trip.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'in_transit',
      started_at = coalesce(t.started_at, now()),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'in_trip',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'in_trip'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_start', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text,
    new_trip.operational_status::text, auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'TRIP_STARTED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$$;

create or replace function public.complete_trip(
  p_trip_id uuid,
  p_odometer_km numeric,
  p_expected_version integer,
  p_idempotency_key uuid,
  p_cargo_delivered boolean
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
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  if p_odometer_km is null
    or p_odometer_km = 'NaN'::numeric
    or p_odometer_km < 0 then
    raise exception using errcode = '23514', message = 'Trip completion odometer must be finite and non-negative';
  end if;
  if p_cargo_delivered is distinct from true then
    raise exception using errcode = '23514', message = 'Cargo delivery must be confirmed';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'unloading' then
    raise exception using errcode = '40001', message = 'Trip changed or cannot be completed';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) and not private.has_gps_odometer_authority(current_company_id, old_trip.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'completed',
      administrative_status = 'settlement_pending',
      operational_finished_at = now(),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'available',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'available'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_finish', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values
    (current_company_id, p_trip_id, 'operational', old_trip.operational_status::text, 'completed', auth.uid()),
    (current_company_id, p_trip_id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', auth.uid());
  insert into public.settlements (company_id, trip_id, driver_id)
  values (current_company_id, p_trip_id, old_trip.driver_id)
  on conflict (company_id, trip_id) do nothing;
  perform private.write_audit(
    current_company_id, 'TRIP_COMPLETED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$$;

create or replace function public.complete_work_order(
  work_order_id uuid,
  final_mileage numeric,
  labour_cost numeric,
  parts_cost numeric
)
returns public.work_orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.work_orders;
  new_row public.work_orders;
  vehicle_mileage numeric;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 is null or $3 is null or $4 is null
    or $2 = 'NaN'::numeric or $3 = 'NaN'::numeric or $4 = 'NaN'::numeric
    or $2 < 0 or $3 < 0 or $4 < 0 then
    raise exception using errcode = '23514', message = 'Mileage and costs must be finite and non-negative';
  end if;
  select * into old_row
  from public.work_orders w
  where w.id = $1 and w.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;
  if old_row.status = 'finished' then
    return old_row;
  end if;
  if old_row.status = 'cancelled' then
    raise exception using errcode = '23514', message = 'Cancelled work order cannot be completed';
  end if;
  select v.current_odometer_km into vehicle_mileage
  from public.vehicles v
  where v.id = old_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $2 < vehicle_mileage
    and not private.has_gps_odometer_authority(current_company_id, old_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.work_orders w
  set status = 'finished',
      finished_at = coalesce(w.finished_at, now()),
      odometer_km = $2,
      labor_cost = $3,
      parts_cost = $4
  where w.id = $1 and w.company_id = current_company_id
  returning * into new_row;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $2),
      current_status = 'available'
  where v.id = old_row.vehicle_id and v.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'WORK_ORDER_COMPLETED', 'work_order', $1,
    to_jsonb(old_row), to_jsonb(new_row)
  );
  return new_row;
end;
$$;

create or replace function public.record_odometer_entry(
  p_id uuid,
  p_trip_id uuid,
  p_reading_km numeric,
  p_reading_at timestamptz,
  p_reading_type text,
  p_source_device_id text,
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
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $7 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if $3 is null or $3 = 'NaN'::numeric or $3 < 0 then
    raise exception using errcode = '23514', message = 'Odometer reading must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':odometer:' || $7::text, 0)
  );
  select * into result
  from public.odometer_entries o
  where o.company_id = current_company_id and o.idempotency_key = $7;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.reading_km is distinct from $3::numeric(14,2)
      or result.reading_at is distinct from $4
      or result.reading_type is distinct from $5
      or result.source is distinct from 'driver_app'
      or result.recorded_by is distinct from current_actor_id
      or result.source_device_id is distinct from $6 then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  if $3 < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  ) and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.odometer_entries (
    id, company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, trip_row.vehicle_id, $2, $3, $4, $5,
    'driver_app', current_actor_id, $6, $7
  ) returning * into result;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $3)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  return result;
end;
$$;

create or replace function public.record_fuel_entry(
  p_id uuid,
  p_trip_id uuid,
  p_supplier_id uuid,
  p_fueled_at timestamptz,
  p_location text,
  p_odometer_km numeric,
  p_quantity numeric,
  p_volume_unit text,
  p_unit_price numeric,
  p_total_amount numeric,
  p_currency char(3),
  p_payment_method text,
  p_receipt_type text,
  p_receipt_number text,
  p_receipt_file_id uuid,
  p_source_device_id text,
  p_idempotency_key uuid
)
returns public.fuel_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.fuel_entries;
  effective_driver_id uuid;
  current_vehicle_odometer numeric(14,2);
  normalized_currency char(3) := upper($11::text)::char(3);
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if $6 is null or $6 = 'NaN'::numeric or $6 < 0 then
    raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':fuel:' || $17::text, 0)
  );
  select * into result
  from public.fuel_entries f
  where f.company_id = current_company_id and f.idempotency_key = $17;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.supplier_id is distinct from $3
      or result.fueled_at is distinct from $4
      or result.location is distinct from $5
      or result.odometer_km is distinct from $6::numeric(14,2)
      or result.quantity is distinct from $7::numeric(14,3)
      or result.volume_unit is distinct from $8
      or result.unit_price is distinct from $9::numeric(14,4)
      or result.total_amount is distinct from $10::numeric(14,2)
      or result.currency is distinct from normalized_currency
      or result.payment_method is distinct from $12
      or result.receipt_type is distinct from $13
      or result.receipt_number is distinct from $14
      or result.receipt_file_id is distinct from $15
      or result.created_by is distinct from current_actor_id
      or result.source_device_id is distinct from $16 then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  effective_driver_id := case
    when private.current_app_role() = 'driver' then private.current_driver_id()
    else trip_row.driver_id
  end;
  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $6 < current_vehicle_odometer
    and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, effective_driver_id,
    $3, $4, $5, $6, $7, $8, $9, $10, normalized_currency, $12, $13,
    $14, $15, 'pending_review', current_actor_id, $16, $17
  ) returning * into result;
  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    current_company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'driver_app', current_actor_id, $16, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  return result;
end;
$$;

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
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  current_driver_id uuid := private.current_driver_id();
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
  if $4 is not null and ($4 = 'NaN'::numeric or $4 < 0) then
    raise exception using errcode = '23514', message = 'Transition odometer must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-transition:' || $1::text, 0)
  );

  select * into existing_request
  from public.trip_transition_requests r
  where r.id = $1 and r.company_id = current_company_id;
  if found then
    if existing_request.actor_id is distinct from current_actor_id
      or existing_request.trip_id is distinct from $2
      or existing_request.requested_action is distinct from $3
      or existing_request.odometer_km is distinct from $4::numeric(14,2)
      or existing_request.cargo_delivered is distinct from coalesce($5, false)
      or existing_request.occurred_at is distinct from $6
      or existing_request.source_device_id is distinct from normalized_device_id then
      raise exception using errcode = '23505', message = 'Transition ID was already used';
    end if;
    select * into trip_row
    from public.trips t
    where t.id = existing_request.trip_id and t.company_id = current_company_id;
    return trip_row;
  end if;

  if $6 > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from current_driver_id then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  old_trip := trip_row;

  if $3 = 'start' then
    if $4 is null or coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Start requires mileage only';
    end if;
    if trip_row.operational_status not in ('scheduled','loading')
       or trip_row.vehicle_id is null
       or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer
      and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;

    update public.trips t
    set operational_status = 'in_transit',
        started_at = $6,
        version = t.version + case
          when trip_row.operational_status = 'scheduled' then 2
          else 1
        end,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'in_trip',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;

    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values
        (current_company_id, old_trip.id, 'operational', 'scheduled', 'loading', $6, 'Offline driver request', current_actor_id),
        (current_company_id, old_trip.id, 'operational', 'loading', 'in_transit', $6, 'Offline driver request', current_actor_id);
    else
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values (
        current_company_id, old_trip.id, 'operational', 'loading', 'in_transit',
        $6, 'Offline driver request', current_actor_id
      );
    end if;
    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_start', 'command', current_actor_id, normalized_device_id, $1
    );
    perform private.write_audit(
      current_company_id, 'TRIP_STARTED', 'trip', old_trip.id,
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
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values (
      current_company_id, old_trip.id, 'operational', 'in_transit', 'unloading',
      $6, 'Offline driver request', current_actor_id
    );
    perform private.write_audit(
      current_company_id, 'TRIP_ARRIVED', 'trip', old_trip.id,
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
    where e.company_id = current_company_id
      and e.trip_id = trip_row.id
      and e.dimension = 'operational'
      and e.new_status = 'unloading';
    if arrival_at is null or $6 <= arrival_at or $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer
      and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1
      from public.odometer_entries o
      where o.company_id = current_company_id
        and o.trip_id = trip_row.id
        and o.reading_at > $6
      union all
      select 1
      from public.expenses e
      where e.company_id = current_company_id
        and e.trip_id = trip_row.id
        and e.incurred_at > $6
      union all
      select 1
      from public.fuel_entries f
      where f.company_id = current_company_id
        and f.trip_id = trip_row.id
        and f.fueled_at > $6
      union all
      select 1
      from public.incidents i
      where i.company_id = current_company_id
        and i.trip_id = trip_row.id
        and i.occurred_at > $6
    ) then
      raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity';
    end if;

    update public.trips t
    set operational_status = 'completed',
        administrative_status = 'settlement_pending',
        operational_finished_at = $6,
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'available',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_finish', 'command', current_actor_id, normalized_device_id, $1
    );
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values
      (current_company_id, old_trip.id, 'operational', 'unloading', 'completed', $6, 'Offline driver request', current_actor_id),
      (current_company_id, old_trip.id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', $6, 'Offline driver request', current_actor_id);
    insert into public.settlements (company_id, trip_id, driver_id, started_at)
    values (current_company_id, old_trip.id, old_trip.driver_id, $6)
    on conflict (company_id, trip_id) do nothing;
    perform private.write_audit(
      current_company_id, 'TRIP_COMPLETED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );
  else
    raise exception using errcode = '22023', message = 'Unsupported transition action';
  end if;

  insert into public.trip_transition_requests (
    id, company_id, trip_id, requested_action, odometer_km,
    cargo_delivered, occurred_at, source_device_id, actor_id, applied_at
  ) values (
    $1, current_company_id, $2, $3, $4, coalesce($5, false), $6,
    normalized_device_id, current_actor_id, now()
  );
  return trip_row;
end;
$$;

create function public.review_gps_odometer_promotion(
  p_promotion_id uuid,
  p_decision public.gps_odometer_review_decision,
  p_reason text,
  p_idempotency_key uuid
)
returns public.gps_odometer_promotion_reviews
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  normalized_reason text := trim(p_reason);
  existing_review public.gps_odometer_promotion_reviews;
  promotion public.gps_odometer_promotions;
  authority_row public.gps_odometer_authorities;
  source_position public.gps_positions;
  vehicle_row public.vehicles;
  new_entry public.odometer_entries;
  new_review public.gps_odometer_promotion_reviews;
  source_odometer_km numeric(14,2);
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_promotion_id is null
    or p_decision is null
    or p_idempotency_key is null
    or coalesce(length(normalized_reason) not between 1 and 500, true) then
    raise exception using errcode = '23514', message = 'Invalid GPS odometer promotion review';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':gps-odometer-review:' || p_promotion_id::text, 0)
  );
  select * into existing_review
  from public.gps_odometer_promotion_reviews review
  where review.company_id = current_company_id
    and review.idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing_review.promotion_id is distinct from p_promotion_id
      or existing_review.decision is distinct from p_decision
      or existing_review.reviewed_by is distinct from current_actor_id
      or existing_review.reason is distinct from normalized_reason then
      raise exception using errcode = '23505', message = 'GPS odometer review idempotency key was already used';
    end if;
    return existing_review;
  end if;

  select * into promotion
  from public.gps_odometer_promotions candidate
  where candidate.company_id = current_company_id
    and candidate.id = p_promotion_id
  for update;
  if not found
    or promotion.promotion_kind <> 'sync'
    or promotion.outcome <> 'requires_review' then
    raise exception using errcode = '23514', message = 'Only a quarantined GPS odometer promotion may be reviewed';
  end if;
  if promotion.source_kind <> 'goldcar_detail_html'
    or promotion.source_odometer_semantic <> 'vehicle_odometer' then
    raise exception using errcode = '23514', message = 'Only Goldcar detail-field odometer evidence may be reviewed';
  end if;
  select * into existing_review
  from public.gps_odometer_promotion_reviews review
  where review.company_id = current_company_id
    and review.promotion_id = promotion.id
  for update;
  if found then
    raise exception using errcode = '23505', message = 'GPS odometer promotion was already reviewed';
  end if;

  if p_decision = 'rejected' then
    insert into public.gps_odometer_promotion_reviews (
      company_id,
      promotion_id,
      authority_id,
      vehicle_id,
      decision,
      previous_odometer_km,
      resulting_odometer_km,
      odometer_entry_id,
      reviewed_by,
      reason,
      idempotency_key
    ) values (
      current_company_id,
      promotion.id,
      promotion.authority_id,
      promotion.vehicle_id,
      'rejected',
      promotion.previous_odometer_km,
      promotion.previous_odometer_km,
      null,
      current_actor_id,
      normalized_reason,
      p_idempotency_key
    ) returning * into new_review;
    perform private.write_audit(
      current_company_id,
      'GPS_ODOMETER_QUARANTINE_REJECTED',
      'gps_odometer_promotion',
      promotion.id,
      jsonb_build_object('current_odometer_km', promotion.previous_odometer_km),
      jsonb_build_object(
        'current_odometer_km', promotion.previous_odometer_km,
        'review_id', new_review.id,
        'authority_id', promotion.authority_id
      ),
      normalized_reason
    );
    return new_review;
  end if;

  select position.* into source_position
  from public.gps_positions position
  join public.vehicle_latest_positions latest
    on latest.company_id = position.company_id
    and latest.vehicle_id = position.vehicle_id
    and latest.position_id = position.id
  where position.company_id = current_company_id
    and position.id = promotion.source_position_id
    and position.vehicle_id = promotion.vehicle_id
    and position.provider_kind = 'GOLDCAR_PORTAL_RPA'
    and position.source_kind = 'goldcar_detail_html'
    and position.odometer_source_semantic = 'vehicle_odometer'
    and position.odometer_km is not null
  for update of latest;
  if not found then
    raise exception using errcode = '40001', message = 'Quarantined GPS promotion is no longer the current linked position';
  end if;
  if source_position.odometer_km = 'NaN'::numeric
    or source_position.odometer_km is distinct from promotion.reported_odometer_km then
    raise exception using errcode = '23514', message = 'Quarantined GPS odometer evidence is not valid';
  end if;
  if source_position.recorded_at > clock_timestamp() then
    raise exception using errcode = '23514', message = 'Quarantined GPS odometer evidence is recorded in the future';
  end if;
  source_odometer_km := round(source_position.odometer_km, 2);
  select authority.* into authority_row
  from public.gps_odometer_authorities authority
  join public.gps_provider_vehicle_links link
    on link.company_id = authority.company_id
    and link.id = authority.provider_link_id
  where authority.company_id = current_company_id
    and authority.id = promotion.authority_id
    and authority.vehicle_id = promotion.vehicle_id
    and authority.status = 'active'
    and link.active
    and link.provider_kind = 'GOLDCAR_PORTAL_RPA'
    and link.vehicle_id = promotion.vehicle_id
    and source_position.provider_link_id = authority.provider_link_id
  for update of authority;
  if not found then
    raise exception using errcode = '23514', message = 'Quarantined GPS promotion authority is no longer active';
  end if;
  select * into vehicle_row
  from public.vehicles vehicle
  where vehicle.company_id = current_company_id
    and vehicle.id = promotion.vehicle_id
    and vehicle.active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active promotion vehicle not found';
  end if;
  if vehicle_row.current_odometer_km = 'NaN'::numeric then
    raise exception using errcode = '23514', message = 'Vehicle master odometer is not finite';
  end if;
  if vehicle_row.current_odometer_km is distinct from promotion.previous_odometer_km then
    raise exception using errcode = '40001', message = 'Vehicle odometer changed before GPS quarantine review';
  end if;
  if source_odometer_km <= vehicle_row.current_odometer_km then
    raise exception using errcode = '23514', message = 'Quarantined GPS odometer no longer advances the official master';
  end if;

  insert into public.odometer_entries (
    company_id,
    vehicle_id,
    trip_id,
    reading_km,
    reading_at,
    reading_type,
    source,
    recorded_by,
    idempotency_key
  ) values (
    current_company_id,
    vehicle_row.id,
    null,
    source_odometer_km,
    source_position.recorded_at,
    'gps_review',
    'goldcar',
    current_actor_id,
    p_idempotency_key
  ) returning * into new_entry;
  perform set_config('rt.gps_odometer_write', 'enabled', true);
  update public.vehicles vehicle
  set current_odometer_km = source_odometer_km
  where vehicle.company_id = current_company_id
    and vehicle.id = vehicle_row.id;
  perform set_config('rt.gps_odometer_write', 'disabled', true);
  insert into public.gps_odometer_promotion_reviews (
    company_id,
    promotion_id,
    authority_id,
    vehicle_id,
    decision,
    previous_odometer_km,
    resulting_odometer_km,
    odometer_entry_id,
    reviewed_by,
    reason,
    idempotency_key
  ) values (
    current_company_id,
    promotion.id,
    authority_row.id,
    vehicle_row.id,
    'approved',
    vehicle_row.current_odometer_km,
    source_odometer_km,
    new_entry.id,
    current_actor_id,
    normalized_reason,
    p_idempotency_key
  ) returning * into new_review;
  perform private.write_audit(
    current_company_id,
    'GPS_ODOMETER_QUARANTINE_APPROVED',
    'vehicle',
    vehicle_row.id,
    jsonb_build_object('current_odometer_km', vehicle_row.current_odometer_km),
    jsonb_build_object(
      'current_odometer_km', source_odometer_km,
      'review_id', new_review.id,
      'promotion_id', promotion.id,
      'authority_id', authority_row.id,
      'source_kind', source_position.source_kind::text,
      'source_odometer_semantic', source_position.odometer_source_semantic::text,
      'reported_odometer_km', source_position.odometer_km,
      'recorded_at', source_position.recorded_at,
      'received_at', source_position.received_at
    ),
    normalized_reason
  );
  return new_review;
end;
$$;

-- Re-state the complete callable boundary after the final overrides. In
-- particular, service_role receives only the server-only ingestion/promotion
-- primitives and explicit schema USAGE needed by the private helper.
grant usage on schema private to service_role;

revoke all on function private.has_gps_odometer_authority(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text)
  from public, anon, authenticated, service_role;
revoke all on function public.suspend_gps_odometer_authority(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_gps_odometer_promotion(uuid,public.gps_odometer_review_decision,text,uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.start_trip(uuid,numeric,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_trip(uuid,numeric,integer,uuid,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_work_order(uuid,numeric,numeric,numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text)
  to authenticated;
grant execute on function public.suspend_gps_odometer_authority(uuid,text)
  to authenticated;
grant execute on function public.review_gps_odometer_promotion(uuid,public.gps_odometer_review_decision,text,uuid)
  to authenticated;

grant execute on function public.start_trip(uuid,numeric,integer,uuid)
  to authenticated;
grant execute on function public.complete_trip(uuid,numeric,integer,uuid,boolean)
  to authenticated;
grant execute on function public.complete_work_order(uuid,numeric,numeric,numeric)
  to authenticated;
grant execute on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid)
  to authenticated;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)
  to authenticated;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text)
  to authenticated;
grant execute on function public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
grant execute on function public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)
  to service_role;
