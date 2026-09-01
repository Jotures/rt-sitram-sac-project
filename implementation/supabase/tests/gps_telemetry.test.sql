begin;
set local search_path = extensions, public, auth;
select plan(41);

select has_table('public', 'gps_provider_vehicle_links', 'GPS vehicle-link table exists');
select has_table('public', 'gps_positions', 'GPS history table exists');
select has_table('public', 'vehicle_latest_positions', 'GPS latest-position projection exists');
select has_table('public', 'gps_telemetry_retention_policies', 'GPS retention-policy table exists');
select has_table('public', 'gps_sync_runs', 'GPS sync-run audit table exists');
select has_view('public', 'vehicle_gps_context', 'minimal GPS context view exists');
select ok(
  'security_invoker=true' = any(
    coalesce(
      (select reloptions from pg_class where oid = 'public.vehicle_gps_context'::regclass),
      array[]::text[]
    )
  ),
  'GPS context view preserves the caller RLS policies'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_gps_context'
      and column_name in ('latitude', 'longitude', 'external_asset_id', 'external_display_name')
  ),
  'GPS context view excludes coordinates and provider asset identifiers'
);
select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.gps_provider_vehicle_links'::regclass,
      'public.gps_positions'::regclass,
      'public.vehicle_latest_positions'::regclass,
      'public.gps_telemetry_retention_policies'::regclass,
      'public.gps_sync_runs'::regclass
    )
  ),
  'GPS tables enable and force RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.gps_provider_vehicle_links', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gps_positions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.vehicle_latest_positions', 'UPDATE'),
  'authenticated users cannot write GPS data directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE'),
  'only service role receives the GPS ingestion contract'
);

insert into public.companies (id, legal_name) values
  ('a1000000-0000-0000-0000-000000000001', 'GPS COMPANY A'),
  ('b1000000-0000-0000-0000-000000000002', 'GPS COMPANY B');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('a1100000-0000-0000-0000-000000000001', 'gps-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1200000-0000-0000-0000-000000000002', 'gps-admin-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1300000-0000-0000-0000-000000000003', 'gps-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1500000-0000-0000-0000-000000000005', 'gps-accounting-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b1100000-0000-0000-0000-000000000001', 'gps-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role) values
  ('a1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'GPS Management A', 'management'),
  ('a1200000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'GPS Admin A', 'administration'),
  ('a1300000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'GPS Driver A', 'driver'),
  ('a1500000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'GPS Accounting A', 'accounting'),
  ('b1100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'GPS Management B', 'management');
insert into public.vehicles (id, company_id, plate) values
  ('a1400000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'GPS-A-001'),
  ('b1400000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'GPS-B-001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'Unidad de prueba', 'a1400000-0000-0000-0000-000000000004')$$,
  'management approves the provider asset to internal vehicle mapping'
);
select ok(
  exists (
    select 1 from public.audit_events
    where company_id = 'a1000000-0000-0000-0000-000000000001'
      and action = 'GPS_VEHICLE_LINKED'
      and actor_id = 'a1100000-0000-0000-0000-000000000001'
  ),
  'GPS mapping approval is attributed and audited'
);
select set_config('request.jwt.claim.sub', 'a1200000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-OTHER', null, 'a1400000-0000-0000-0000-000000000004')$$,
  '42501', null,
  'administration cannot approve GPS mappings'
);

reset role;
set local role service_role;
select lives_ok(
  $$select public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'sample-old', null,
    now() - interval '2 days', now() - interval '2 days', -13.5, -71.9, 10, 180, null, true, 1000
  )$$,
  'server ingestion resolves company and vehicle from the approved mapping'
);
select is(
  (select company_id from public.gps_positions where observation_key = 'sample-old'),
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'ingestion never accepts a company identifier from the provider payload'
);
select is(
  (select vehicle_id from public.gps_positions where observation_key = 'sample-old'),
  'a1400000-0000-0000-0000-000000000004'::uuid,
  'ingestion derives the internal vehicle from the approved mapping'
);
select is(
  public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'sample-old', null,
    now() - interval '2 days', now() - interval '2 days', -13.5, -71.9, 10, 180, null, true, 1000
  ),
  (select id from public.gps_positions where observation_key = 'sample-old'),
  'exact GPS replay returns the original immutable evidence row'
);
select is(
  (select count(*)::integer from public.gps_positions where observation_key = 'sample-old'),
  1,
  'exact GPS replay does not duplicate historical evidence'
);
select lives_ok(
  $$select public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'sample-current', null,
    now() - interval '1 hour', now() - interval '1 hour', -13.4, -71.8, null, null, null, null, null
  )$$,
  'newer GPS evidence updates the latest-position projection'
);
select lives_ok(
  $$select public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'sample-late', null,
    now() - interval '3 days', now(), -13.6, -72.0, null, null, null, null, null
  )$$,
  'late GPS evidence is retained in immutable history'
);
select is(
  (select observation_key from public.gps_positions position
    where position.id = (
      select position_id
      from public.vehicle_latest_positions
      where company_id = 'a1000000-0000-0000-0000-000000000001'
        and vehicle_id = 'a1400000-0000-0000-0000-000000000004'
    )),
  'sample-current',
  'late GPS evidence cannot make the latest-position projection move backward'
);
select throws_ok(
  $$select public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:UNKNOWN', 'sample-unknown', null,
    now(), now(), -13.5, -71.9
  )$$,
  '23503', null,
  'unknown provider assets cannot be implicitly mapped during ingestion'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.vehicle_gps_context), 1, 'management can read its company GPS context');
select set_config('request.jwt.claim.sub', 'a1200000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.vehicle_latest_positions), 1, 'administration can read its company latest GPS position');
select is((select count(*)::integer from public.gps_positions), 3, 'administration can read its company GPS history');
select is((select count(*)::integer from public.vehicle_gps_context), 1, 'administration can read its company GPS context');
select set_config('request.jwt.claim.sub', 'a1300000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.vehicle_latest_positions), 0, 'driver cannot read GPS positions');
select is((select count(*)::integer from public.vehicle_gps_context), 0, 'driver cannot read GPS context');
select set_config('request.jwt.claim.sub', 'a1500000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.vehicle_gps_context), 0, 'accounting cannot read GPS context');
select set_config('request.jwt.claim.sub', 'b1100000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.gps_positions), 0, 'another company cannot read GPS history');
select is((select count(*)::integer from public.vehicle_gps_context), 0, 'another company cannot read GPS context');

reset role;
set local role service_role;
insert into public.gps_odometer_authorities (
  company_id, provider_link_id, vehicle_id, bootstrap_mode, baseline_position_id, activation_request_id, activated_by
) values (
  'a1000000-0000-0000-0000-000000000001',
  (select id from public.gps_provider_vehicle_links where company_id = 'a1000000-0000-0000-0000-000000000001'),
  'a1400000-0000-0000-0000-000000000004',
  'standard',
  (select id from public.gps_positions where observation_key = 'sample-current'),
  'a1600000-0000-0000-0000-000000000006',
  'a1100000-0000-0000-0000-000000000001'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.suspend_gps_odometer_authority((select id from public.gps_odometer_authorities), 'Piloto suspendido')$$,
  'management can suspend its active GPS source'
);
select is((select count(*)::integer from public.vehicle_gps_context), 0, 'a suspended GPS source is absent from the operational context view');

select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.configure_gps_telemetry_retention(1)$$,
  'management explicitly configures a GPS retention period'
);
select is(
  (select historical_position_retention_days from public.gps_telemetry_retention_policies),
  1,
  'retention period is stored per company and never inferred from the provider'
);

reset role;
set local role service_role;
select is(
  public.purge_expired_gps_positions('a1000000-0000-0000-0000-000000000001'),
  2,
  'retention purge removes expired history but preserves the latest-position evidence'
);
select is(
  (
    select count(*)::integer
    from public.gps_positions
    where company_id = 'a1000000-0000-0000-0000-000000000001'
      and vehicle_id = 'a1400000-0000-0000-0000-000000000004'
  ),
  1,
  'purge leaves the latest-position evidence intact'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.unlink_gps_vehicle((select id from public.gps_provider_vehicle_links), 'Unidad reasignada')$$,
  'management unlinks a GPS mapping with an attributed reason'
);
select is((select count(*)::integer from public.vehicle_gps_context), 0, 'inactive mapping is absent from the GPS context view');

reset role;
set local role service_role;
select throws_ok(
  $$select public.ingest_gps_position(
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-A-001', 'sample-after-unlink', null,
    now(), now(), -13.5, -71.9
  )$$,
  '23503', null,
  'disabled GPS mapping blocks new evidence ingestion'
);

select * from finish(true);
rollback;
