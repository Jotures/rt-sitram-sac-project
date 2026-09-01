-- Keep the idempotent public contract introduced in 20260822182449 while
-- removing an unused PL/pgSQL record variable reported by remote db lint.
-- The insert's FOUND flag is the intended concurrency boundary.
create or replace function public.configure_gps_odometer_plausibility_policy(
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

  -- The unique insert is the concurrency boundary. A concurrent replay waits
  -- for the original transaction and then returns its immutable snapshot.
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
  ) on conflict (company_id, idempotency_key) do nothing;

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

revoke all on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)
  to authenticated;
