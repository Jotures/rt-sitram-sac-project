-- A policy update is a management command, not an eventually consistent UI
-- preference.  Persist the request identity and the exact resulting policy so
-- a timeout/replay cannot increment a version or append a second audit event.
-- The key is scoped to a company: the same UUID may safely occur in another
-- tenant, but cannot be re-bound to a different management action within one.
create table public.gps_odometer_plausibility_policy_requests (
  company_id uuid not null references public.companies (id) on delete restrict,
  idempotency_key uuid not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  max_auto_advance_km numeric(14,2) not null
    check (max_auto_advance_km > 0 and max_auto_advance_km <> 'NaN'::numeric),
  max_average_speed_kmh numeric(10,2) not null
    check (max_average_speed_kmh > 0 and max_average_speed_kmh <> 'NaN'::numeric),
  reason text not null check (length(trim(reason)) between 1 and 500),
  resulting_policy_version integer,
  resulting_policy_configured_at timestamptz,
  primary key (company_id, idempotency_key),
  constraint gps_odometer_policy_requests_actor_fk
    foreign key (company_id, requested_by)
    references public.profiles (company_id, id)
    on delete restrict,
  constraint gps_odometer_policy_requests_result_shape check (
    (resulting_policy_version is null and resulting_policy_configured_at is null)
    or (
      resulting_policy_version > 0
      and resulting_policy_configured_at is not null
    )
  )
);

alter table public.gps_odometer_plausibility_policy_requests enable row level security;
alter table public.gps_odometer_plausibility_policy_requests force row level security;
revoke all on table public.gps_odometer_plausibility_policy_requests from public, anon, authenticated;
grant all on table public.gps_odometer_plausibility_policy_requests to service_role;

comment on table public.gps_odometer_plausibility_policy_requests is
  'Internal idempotency ledger for management GPS odometer plausibility-policy commands; not a client-readable policy history.';

-- The prior three-argument variant admitted a second route that could not
-- prove retries. Remove it rather than keeping a compatibility bypass.
revoke all on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text)
  from public, anon, authenticated, service_role;
drop function if exists public.configure_gps_odometer_plausibility_policy(numeric,numeric,text);

create function public.configure_gps_odometer_plausibility_policy(
  p_max_auto_advance_km numeric,
  p_max_average_speed_kmh numeric,
  p_reason text,
  p_idempotency_key uuid
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
  created_request public.gps_odometer_plausibility_policy_requests;
  existing_request public.gps_odometer_plausibility_policy_requests;
  old_policy public.gps_odometer_plausibility_policies;
  new_policy public.gps_odometer_plausibility_policies;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if current_company_id is null then
    raise exception using errcode = '42501', message = 'No active company context';
  end if;
  if p_idempotency_key is null
    or p_max_auto_advance_km is null
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

  -- The unique insert is the concurrency boundary.  A concurrent replay
  -- waits for the original transaction to commit, then returns its immutable
  -- policy snapshot without touching the policy row or audit ledger.
  insert into public.gps_odometer_plausibility_policy_requests (
    company_id,
    idempotency_key,
    requested_by,
    max_auto_advance_km,
    max_average_speed_kmh,
    reason
  ) values (
    current_company_id,
    p_idempotency_key,
    current_actor_id,
    p_max_auto_advance_km,
    p_max_average_speed_kmh,
    normalized_reason
  ) on conflict (company_id, idempotency_key) do nothing
  returning * into created_request;

  if not found then
    select * into existing_request
    from public.gps_odometer_plausibility_policy_requests request
    where request.company_id = current_company_id
      and request.idempotency_key = p_idempotency_key
    for key share;
    if not found then
      raise exception using errcode = 'P0001', message = 'GPS odometer plausibility policy request could not be recovered';
    end if;
    if existing_request.requested_by is distinct from current_actor_id
      or existing_request.max_auto_advance_km is distinct from p_max_auto_advance_km::numeric(14,2)
      or existing_request.max_average_speed_kmh is distinct from p_max_average_speed_kmh::numeric(10,2)
      or existing_request.reason is distinct from normalized_reason then
      raise exception using errcode = '23505', message = 'GPS odometer plausibility policy idempotency key was already used';
    end if;
    if existing_request.resulting_policy_version is null
      or existing_request.resulting_policy_configured_at is null then
      raise exception using errcode = 'P0001', message = 'GPS odometer plausibility policy request is incomplete';
    end if;
    return row(
      existing_request.company_id,
      existing_request.max_auto_advance_km,
      existing_request.max_average_speed_kmh,
      existing_request.requested_by,
      existing_request.resulting_policy_configured_at,
      existing_request.reason,
      existing_request.resulting_policy_version
    )::public.gps_odometer_plausibility_policies;
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

  update public.gps_odometer_plausibility_policy_requests request
  set resulting_policy_version = new_policy.version,
      resulting_policy_configured_at = new_policy.configured_at
  where request.company_id = current_company_id
    and request.idempotency_key = p_idempotency_key;

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

-- Correct the enum assignment explicitly. PostgreSQL otherwise relies on an
-- implicit text-to-enum coercion inside CASE, which is weaker and can vary
-- under strict function validation.
create or replace function public.activate_gps_odometer_authority(
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
    baseline_outcome := (
      case
        when source_odometer_km > vehicle_row.current_odometer_km then 'advanced'
        else 'confirmed'
      end
    )::public.gps_odometer_promotion_outcome;
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

-- These transitional overloads were never adopted by the PWA and are absent
-- from the authenticated command allowlist. Keep them non-callable instead of
-- accidentally exposing a second operational transition API.
revoke all on function public.start_trip(uuid,numeric,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_trip(uuid,numeric,integer,uuid,boolean)
  from public, anon, authenticated, service_role;

revoke all on function public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)
  to authenticated;

revoke all on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)
  to authenticated;
