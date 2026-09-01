-- A suspension is an operational visibility boundary: preserve the immutable
-- GPS evidence, but do not project it to staff surfaces as an active signal.
-- The predicate is SECURITY DEFINER because administration may read the narrow
-- context view but must not receive the authority-management table itself.

create or replace function private.is_gps_telemetry_visible(
  p_company_id uuid,
  p_provider_link_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_company_id = private.current_company_id()
    and coalesce(
      (
        select authority.status = 'active'::public.gps_odometer_authority_status
        from public.gps_odometer_authorities as authority
        where authority.company_id = p_company_id
          and authority.provider_link_id = p_provider_link_id
        order by authority.activated_at desc, authority.id desc
        limit 1
      ),
      true
    );
$$;

revoke all on function private.is_gps_telemetry_visible(uuid, uuid) from public;
grant execute on function private.is_gps_telemetry_visible(uuid, uuid) to authenticated;

create or replace view public.vehicle_gps_context
with (security_invoker = true)
as
select
  link.vehicle_id,
  link.provider_kind,
  latest.recorded_at,
  latest.received_at,
  latest.speed_kmh,
  latest.ignition,
  latest.odometer_km
from public.gps_provider_vehicle_links as link
left join public.vehicle_latest_positions as latest
  on latest.company_id = link.company_id
  and latest.vehicle_id = link.vehicle_id
  and latest.provider_kind = link.provider_kind
  and latest.external_asset_id = link.external_asset_id
where link.active
  and private.is_gps_telemetry_visible(link.company_id, link.id);

comment on view public.vehicle_gps_context is
  'Minimal GPS context for authorized online unit/trip views with an active source; no coordinates, provider asset identity, raw payload, or history.';
