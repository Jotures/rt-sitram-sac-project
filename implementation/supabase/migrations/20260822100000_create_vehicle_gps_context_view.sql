-- Narrow, online-only read model for the administrative GPS context card.
-- It joins an active approved mapping to its matching latest evidence without
-- exposing coordinates, provider asset identifiers, raw payloads, or history.
-- SECURITY INVOKER is essential: callers retain the RLS policies of both
-- underlying telemetry tables.

create view public.vehicle_gps_context
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
where link.active;

comment on view public.vehicle_gps_context is
  'Minimal GPS context for authorized online unit/trip views; no coordinates, provider asset identity, raw payload, or history.';

revoke all on table public.vehicle_gps_context from public, anon, authenticated, service_role;
grant select on table public.vehicle_gps_context to authenticated;
