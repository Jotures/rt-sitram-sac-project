begin;
set local search_path = extensions, public, auth;
select plan(155);

select has_table('public', 'gps_odometer_authorities', 'GPS odometer authorities are stored explicitly');
select has_table('public', 'gps_odometer_promotions', 'GPS odometer promotions retain durable provenance');
select has_table('public', 'gps_odometer_plausibility_policies', 'GPS odometer plausibility policies require explicit management configuration');
select has_table('public', 'gps_odometer_plausibility_policy_requests', 'GPS odometer plausibility policy commands retain idempotency evidence');
select has_table('public', 'gps_odometer_promotion_reviews', 'GPS odometer quarantine reviews retain the management decision');
select has_column('public', 'gps_positions', 'source_kind', 'GPS evidence records its immutable ingestion provenance');
select has_column('public', 'gps_positions', 'odometer_source_semantic', 'GPS evidence records the immutable kilometer semantic');
select has_view('public', 'vehicle_gps_odometer_candidate', 'management has a narrow GPS odometer candidate view');
select has_function(
  'public',
  'activate_gps_odometer_authority',
  array['uuid','uuid','numeric','gps_odometer_bootstrap_mode','text','uuid'],
  'management GPS odometer authority enrollment contract exists'
);
select has_function(
  'public',
  'configure_gps_odometer_plausibility_policy',
  array['numeric','numeric','text','uuid'],
  'management configures GPS odometer plausibility through an idempotent command'
);
select ok(
  to_regprocedure('public.configure_gps_odometer_plausibility_policy(numeric,numeric,text)') is null,
  'legacy non-idempotent GPS odometer plausibility policy signature no longer exists'
);
select has_function(
  'public',
  'suspend_gps_odometer_authority',
  array['uuid','text'],
  'management can suspend odometer authority without unlinking GPS'
);
select has_function(
  'public',
  'review_gps_odometer_promotion',
  array['uuid','gps_odometer_review_decision','text','uuid'],
  'management can approve or reject quarantined GPS odometer promotion'
);
select has_function(
  'public',
  'ingest_goldcar_detail_position_for_sync',
  array['uuid','text','text','text','timestamp with time zone','timestamp with time zone','numeric','numeric','numeric','numeric','numeric','boolean','numeric'],
  'server-only Goldcar detail ingestion marks authority-eligible evidence'
);
select has_column('public', 'gps_odometer_promotions', 'source_position_id', 'promotion records the internal source evidence ID');
select ok(
  not has_table_privilege('authenticated', 'public.gps_odometer_authorities', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gps_odometer_promotions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gps_odometer_plausibility_policies', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gps_odometer_plausibility_policy_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.gps_odometer_plausibility_policy_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.gps_odometer_promotion_reviews', 'INSERT'),
  'authenticated users cannot read or write GPS authority, policy-request, promotion or review rows directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.vehicles', 'current_odometer_km', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.vehicles', 'notes', 'UPDATE'),
  'vehicle masters use audited commands; direct writes cannot change either odometer or notes'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.suspend_gps_odometer_authority(uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.review_gps_odometer_promotion(uuid,public.gps_odometer_review_decision,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.suspend_gps_odometer_authority(uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.review_gps_odometer_promotion(uuid,public.gps_odometer_review_decision,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.start_trip(uuid,numeric,integer,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.complete_trip(uuid,numeric,integer,uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.start_trip(uuid,numeric,integer,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.complete_trip(uuid,numeric,integer,uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)',
    'EXECUTE'
  )
  and has_schema_privilege('service_role', 'private', 'USAGE')
  and not has_function_privilege(
    'authenticated',
    'private.has_gps_odometer_authority(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.has_gps_odometer_authority(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)',
    'EXECUTE'
  ),
  'management commands stay authenticated-only, retired trip overloads stay non-callable, and the service-only helper has its required private-schema usage'
);
select ok(
  not exists (
    select 1
    from unnest(array[
      'public.start_trip(uuid,numeric,integer,uuid)'::regprocedure,
      'public.complete_trip(uuid,numeric,integer,uuid,boolean)'::regprocedure,
      'public.complete_work_order(uuid,numeric,numeric,numeric)'::regprocedure,
      'public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid)'::regprocedure,
      'public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)'::regprocedure,
      'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)'::regprocedure,
      'public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text)'::regprocedure
    ]) command(oid)
    where position('private.has_gps_odometer_authority' in pg_get_functiondef(command.oid)) = 0
  ),
  'every final manual-odometer command remains evidence-capable under GPS authority'
);

insert into public.companies (id, legal_name) values
  ('e1000000-0000-0000-0000-000000000001', 'GPS ODOMETER COMPANY A'),
  ('f1000000-0000-0000-0000-000000000002', 'GPS ODOMETER COMPANY B');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('e1100000-0000-0000-0000-000000000001', 'gps-odo-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('e1200000-0000-0000-0000-000000000002', 'gps-odo-admin-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('e1300000-0000-0000-0000-000000000003', 'gps-odo-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('e1500000-0000-0000-0000-000000000005', 'gps-odo-accounting-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('f1100000-0000-0000-0000-000000000001', 'gps-odo-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role) values
  ('e1100000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'GPS Odometer Management A', 'management'),
  ('e1200000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'GPS Odometer Administration A', 'administration'),
  ('e1300000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', 'GPS Odometer Driver A', 'driver'),
  ('e1500000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000001', 'GPS Odometer Accounting A', 'accounting'),
  ('f1100000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'GPS Odometer Management B', 'management');
insert into public.vehicles (id, company_id, plate, current_odometer_km) values
  ('e1400000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', 'VDR-768', 141601),
  ('f1400000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000002', 'ODO-TEST-002', 0);

create temporary table gps_odometer_state (
  first_link_id uuid,
  second_link_id uuid,
  replacement_link_id uuid,
  baseline_run_id uuid,
  second_run_id uuid,
  second_future_run_id uuid,
  unconfigured_run_id uuid,
  advanced_run_id uuid,
  confirmed_run_id uuid,
  regression_run_id uuid,
  anomalous_run_id uuid,
  suspended_run_id uuid,
  rebaseline_run_id uuid,
  replacement_run_id uuid,
  baseline_promotion_id uuid,
  baseline_position_id uuid,
  initial_authority_id uuid,
  anomalous_promotion_id uuid,
  rebaseline_promotion_id uuid
);
insert into gps_odometer_state default values;
-- The test switches effective roles to exercise real ACL/RLS boundaries. Keep
-- this session-local fixture readable and mutable to those two test roles only;
-- it grants no production-table capability.
grant select, update on table gps_odometer_state to authenticated, service_role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:ODO-TEST-001', 'Odometer test vehicle', 'e1400000-0000-0000-0000-000000000004')$$,
  'management creates the approved Goldcar link before odometer enrollment'
);
update gps_odometer_state
set first_link_id = (
  select id
  from public.gps_provider_vehicle_links
  where company_id = 'e1000000-0000-0000-0000-000000000001'
    and external_asset_id = 'portal-name:ODO-TEST-001'
);
select lives_ok(
  $$select public.configure_gps_telemetry_retention(30)$$,
  'management configures retention before controlled GPS evidence is persisted'
);

-- The exceptional bootstrap is deliberately restricted to the one confirmed
-- VDR-768 / 141601 km correction.  Build a separate non-VDR fixture so the
-- rejection exercises the actual enrollment boundary rather than only a
-- stale-master precondition.
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:ODO-TEST-002', 'Non-VDR restriction fixture', 'f1400000-0000-0000-0000-000000000004')$$,
  'management creates a separate approved non-VDR Goldcar link for the exception guard'
);
update gps_odometer_state
set second_link_id = (
  select id
  from public.gps_provider_vehicle_links
  where company_id = 'f1000000-0000-0000-0000-000000000002'
    and external_asset_id = 'portal-name:ODO-TEST-002'
);
select lives_ok(
  $$select public.configure_gps_telemetry_retention(30)$$,
  'second-company management configures controlled GPS evidence retention'
);

reset role;
set local role service_role;
update public.vehicles
set current_odometer_km = 141601
where id = 'f1400000-0000-0000-0000-000000000004';
update gps_odometer_state
set second_run_id = (public.begin_gps_sync_run(
  'f1000000-0000-0000-0000-000000000002',
  'GOLDCAR_PORTAL_RPA', 'f1600000-0000-4000-8000-000000000006',
  'f1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select throws_ok(
  $$select public.ingest_gps_position_for_sync(
    (select second_run_id from gps_odometer_state),
    'GOLDCAR_PORTAL_RPA', 'portal-name:ODO-TEST-002', 'odometer-snapshot-nan', null,
    now(), now(), -13.5, -71.9, null, null, null, null, 'NaN'::numeric
  )$$,
  '23514', null,
  'generic snapshot ingestion rejects numeric NaN before it becomes telemetry evidence'
);
select is(
  (select disposition from public.ingest_gps_position_for_sync(
    (select second_run_id from gps_odometer_state),
    'GOLDCAR_PORTAL_RPA', 'portal-name:ODO-TEST-002', 'odometer-non-vdr-snapshot', null,
    now() - interval '12 minutes', now() - interval '12 minutes', -13.5, -71.9,
    null, null, null, null, 12874
  )),
  'persisted',
  'generic snapshot evidence is retained but carries no detail-field provenance'
);
select is(
  (select source_kind::text from public.gps_positions where observation_key = 'odometer-non-vdr-snapshot'),
  'snapshot_csv',
  'the legacy generic synchronization contract always records snapshot provenance'
);
select is(
  (select odometer_source_semantic::text from public.gps_positions where observation_key = 'odometer-non-vdr-snapshot'),
  'unverified',
  'the legacy generic synchronization contract cannot claim a Goldcar odometer semantic'
);
select throws_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select second_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-002', 'odometer-non-vdr-snapshot', null,
    now() - interval '11 minutes', now() - interval '11 minutes', -13.5, -71.9,
    null, null, null, null, 12874
  )$$,
  '23505', 'Goldcar detail observation key already belongs to incompatible GPS evidence',
  'detail ingestion fails closed rather than treating an existing generic snapshot as validated odometer evidence'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.vehicle_gps_odometer_candidate),
  0,
  'the enrollment candidate view excludes a current generic snapshot/CSV reading'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select second_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-non-vdr-snapshot'),
    141601, 'standard', 'Un CSV no puede convertirse en evidencia de detalle.', 'f1610000-0000-4000-8000-000000000006'
  )$$,
  '23514', 'GPS odometer enrollment requires current Goldcar detail-field evidence',
  'generic Goldcar snapshot evidence is ineligible for authoritative enrollment'
);

reset role;
set local role service_role;
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select second_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-002', 'odometer-non-vdr-placeholder', null,
    now() - interval '11 minutes', now() - interval '11 minutes', -13.5, -71.9,
    null, null, null, null, 12874
  )),
  'persisted',
  'the distinct Goldcar detail path writes current detail-field evidence'
);
select is(
  (select source_kind::text from public.gps_positions where observation_key = 'odometer-non-vdr-placeholder'),
  'goldcar_detail_html',
  'only the Goldcar detail path can mark detail-field odometer provenance'
);
select is(
  (select odometer_source_semantic::text from public.gps_positions where observation_key = 'odometer-non-vdr-placeholder'),
  'vehicle_odometer',
  'only the Goldcar detail path marks the value as the vehicle odometer rather than cumulative distance'
);
select throws_ok(
  $$update public.gps_positions
    set source_kind = 'snapshot_csv'
    where observation_key = 'odometer-non-vdr-placeholder'$$,
  '23514', 'GPS evidence source provenance is immutable',
  'stored GPS source provenance cannot be relabeled after ingestion'
);
select throws_ok(
  $$update public.gps_positions
    set odometer_source_semantic = 'unverified'
    where observation_key = 'odometer-non-vdr-placeholder'$$,
  '23514', 'GPS evidence source provenance is immutable',
  'stored GPS odometer semantics cannot be relabeled after ingestion'
);
select is(
  (public.finish_gps_sync_run(
    (select second_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'non-VDR restriction fixture synchronization completes'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select second_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-non-vdr-placeholder'),
    141601, 'test_placeholder', 'La excepción no puede aplicarse a una placa distinta.', 'f1700000-0000-4000-8000-000000000007'
  )$$,
  '23514', null,
  'test-placeholder bootstrap rejects every non-VDR-768 vehicle even at 141601 km'
);

reset role;
set local role service_role;
update public.vehicles
set current_odometer_km = 0
where id = 'f1400000-0000-0000-0000-000000000004';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.activate_gps_odometer_authority(
    (select second_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-non-vdr-placeholder'),
    0, 'standard', 'Gerencia establece una línea base estándar para probar evidencia futura.', 'f1800000-0000-4000-8000-000000000008'
  )$$,
  'a non-VDR vehicle can still receive a normal upward GPS baseline'
);
select lives_ok(
  $$select public.link_gps_vehicle('OTHER_GPS_PROVIDER', 'other-provider:ODO-TEST-002', 'Other provider restriction fixture', 'f1400000-0000-0000-0000-000000000004')$$,
  'management can map a different GPS provider without making it odometer-authoritative'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select id from public.gps_provider_vehicle_links where company_id = 'f1000000-0000-0000-0000-000000000002' and external_asset_id = 'other-provider:ODO-TEST-002'),
    (select id from public.gps_positions where observation_key = 'odometer-non-vdr-placeholder'),
    12874, 'standard', 'Un proveedor distinto no puede ser maestro de odómetro.', 'f1810000-0000-4000-8000-000000000008'
  )$$,
  '23514', 'GPS odometer authority requires a Goldcar portal detail mapping',
  'GPS odometer authority rejects every non-Goldcar provider mapping'
);
select lives_ok(
  $$select public.configure_gps_odometer_plausibility_policy(
    10, 120, 'Política explícita para probar que una fecha futura jamás se promueve.',
    'e1aa0000-0000-4000-8000-000000000001'
  )$$,
  'management configures the second-company plausibility policy with a request UUID that remains company-scoped'
);

reset role;
set local role service_role;
update gps_odometer_state
set second_future_run_id = (public.begin_gps_sync_run(
  'f1000000-0000-0000-0000-000000000002',
  'GOLDCAR_PORTAL_RPA', 'f1900000-0000-4000-8000-000000000009',
  'f1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select second_future_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-002', 'odometer-future', null,
    now() + interval '5 minutes', now() + interval '5 minutes', -13.5, -71.9,
    null, null, null, null, 12875
  )),
  'persisted',
  'future-dated GPS evidence remains retained for investigation'
);
select is(
  (select outcome::text from public.gps_odometer_promotions where sync_run_id = (select second_future_run_id from gps_odometer_state)),
  'requires_review',
  'future-dated GPS evidence is quarantined even with an approved plausibility policy'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'f1400000-0000-0000-0000-000000000004'),
  12874::numeric,
  'future-dated GPS evidence cannot advance the official master'
);
select is(
  (public.finish_gps_sync_run(
    (select second_future_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'future-evidence synchronization completes with the quarantine intact'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.review_gps_odometer_promotion(
    (select id from public.gps_odometer_promotions where sync_run_id = (select second_future_run_id from gps_odometer_state)),
    'approved', 'Gerencia no puede aprobar evidencia con marca futura.', 'f1a00000-0000-4000-8000-000000000010'
  )$$,
  '23514', null,
  'management review refuses to approve a future-dated GPS odometer source'
);
select is(
  (select count(*)::integer from public.gps_odometer_promotion_reviews where company_id = 'f1000000-0000-0000-0000-000000000002'),
  0,
  'future evidence remains unreviewed after the refused approval attempt'
);

reset role;
set local role service_role;
update gps_odometer_state
set baseline_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA',
  'e1600000-0000-4000-8000-000000000006',
  'e1100000-0000-0000-0000-000000000001',
  120,
  240
)).id;
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select baseline_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-baseline-old', null,
    now() - interval '12 minutes', now() - interval '12 minutes', -13.5, -71.9,
    null, null, null, null, 12873
  )),
  'persisted',
  'a pre-enrollment GPS observation is stored as evidence only'
);
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select baseline_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-baseline-current', null,
    now() - interval '11 minutes', now() - interval '11 minutes', -13.5, -71.9,
    null, null, null, null, 12874
  )),
  'persisted',
  'the newest validated GPS odometer observation is persisted'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  141601::numeric,
  'raw GPS evidence cannot alter the placeholder master before management enrollment'
);
update gps_odometer_state
set baseline_position_id = (
  select id
  from public.gps_positions
  where observation_key = 'odometer-baseline-current'
);
select is(
  (public.finish_gps_sync_run(
    (select baseline_run_id from gps_odometer_state),
    'succeeded', 2, 2, 2, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'baseline evidence run is completed before management reviews it'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.vehicle_gps_odometer_candidate),
  1,
  'management can read the single narrow current odometer candidate'
);
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_gps_odometer_candidate'
      and column_name in ('latitude', 'longitude', 'external_asset_id', 'external_display_name', 'observation_key')
  ),
  'the candidate view exposes no location, external identity or raw observation key'
);
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::integer from public.vehicle_gps_odometer_candidate),
  0,
  'administration cannot read a management-only odometer enrollment candidate'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
    141601, 'test_placeholder', 'Administracion no puede declarar marcador de prueba', 'e1700000-0000-4000-8000-000000000007'
  )$$,
  '42501', null,
  'administration cannot enroll GPS odometer authority'
);
select throws_ok(
  $$select public.configure_gps_odometer_plausibility_policy(
    10, 120, 'Administracion no puede definir la política de kilometraje GPS',
    'e1ab0000-0000-4000-8000-000000000002'
  )$$,
  '42501', null,
  'administration cannot configure GPS odometer plausibility policy'
);

select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-old'),
    141601, 'test_placeholder', 'La muestra antigua no es la evidencia actual', 'e1800000-0000-4000-8000-000000000008'
  )$$,
  '23514', null,
  'management cannot attach authority to a non-current GPS observation'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
    141600, 'standard', 'La pantalla debe acreditar el valor maestro exacto', 'e1900000-0000-4000-8000-000000000009'
  )$$,
  '40001', null,
  'management enrollment rejects a stale expected master value'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
    141600, 'test_placeholder', 'La excepción no puede declarar otro valor maestro.', 'e1910000-0000-4000-8000-000000000009'
  )$$,
  '23514', 'Test-placeholder GPS correction is restricted to VDR-768 at 141601 km',
  'test-placeholder bootstrap rejects any expected master other than the authorized 141601 km'
);
update gps_odometer_state
set baseline_promotion_id = (public.activate_gps_odometer_authority(
  first_link_id,
  (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
  141601,
  'test_placeholder',
  'Gerencia confirma que 141601 km es un marcador de prueba falso.',
  'e1a00000-0000-4000-8000-000000000010'
)).id;
update gps_odometer_state
set initial_authority_id = (
  select authority_id
  from public.gps_odometer_promotions
  where id = gps_odometer_state.baseline_promotion_id
);
select is(
  (select outcome::text from public.gps_odometer_promotions where id = (select baseline_promotion_id from gps_odometer_state)),
  'test_placeholder_replaced',
  'the explicit test-placeholder enrollment records its exceptional outcome'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12874::numeric,
  'the one-time validated Goldcar baseline replaces the known 141601 km test placeholder downward'
);
select is(
  (select count(*)::integer from public.odometer_entries where vehicle_id = 'e1400000-0000-0000-0000-000000000004' and reading_type = 'gps_baseline'),
  1,
  'baseline correction creates one official odometer entry'
);
select ok(
  exists (
    select 1
    from public.gps_odometer_promotions promotion
    where promotion.id = (select baseline_promotion_id from gps_odometer_state)
      and promotion.previous_odometer_km = 141601
      and promotion.resulting_odometer_km = 12874
      and promotion.bootstrap_mode = 'test_placeholder'
      and promotion.source_kind = 'goldcar_detail_html'
      and promotion.source_odometer_semantic = 'vehicle_odometer'
      and promotion.odometer_entry_id is not null
  ),
  'baseline provenance stores the before, after, source and official entry relationship'
);
select ok(
  exists (
    select 1
    from public.audit_events event
    where event.company_id = 'e1000000-0000-0000-0000-000000000001'
      and event.action = 'VEHICLE_ODOMETER_TEST_PLACEHOLDER_REPLACED'
      and event.entity_id = 'e1400000-0000-0000-0000-000000000004'
      and (event.before_data ->> 'current_odometer_km')::numeric = 141601
      and (event.after_data ->> 'current_odometer_km')::numeric = 12874
  ),
  'the downward placeholder correction is attributed with an auditable before and after'
);
select ok(
  not exists (
    select 1
    from public.audit_events event
    where event.action in ('GPS_ODOMETER_AUTHORITY_ENROLLED', 'VEHICLE_ODOMETER_TEST_PLACEHOLDER_REPLACED')
      and (
        event.before_data ? 'latitude'
        or event.before_data ? 'longitude'
        or event.after_data ? 'latitude'
        or event.after_data ? 'longitude'
        or event.after_data ? 'external_asset_id'
      )
  ),
  'GPS odometer enrollment audit omits coordinates and external asset identifiers'
);
select is(
  (public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
    141601, 'test_placeholder', 'Gerencia confirma que 141601 km es un marcador de prueba falso.', 'e1a00000-0000-4000-8000-000000000010'
  )).id,
  (select baseline_promotion_id from gps_odometer_state),
  'identical enrollment replay returns the original promotion'
);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-baseline-current'),
    141601, 'test_placeholder', 'Una solicitud idempotente no puede cambiar de motivo', 'e1a00000-0000-4000-8000-000000000010'
  )$$,
  '23505', null,
  'idempotency replay with different enrollment data fails closed'
);

reset role;
set local role service_role;
update public.vehicles
set current_odometer_km = 99999,
    current_status = 'preventive_maintenance'
where id = 'e1400000-0000-0000-0000-000000000004';
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12874::numeric,
  'authority trigger prevents every ordinary post-enrollment master odometer update'
);
select is(
  (select current_status::text from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  'preventive_maintenance',
  'authority trigger preserves unrelated operational status changes'
);

update gps_odometer_state
set unconfigured_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1aa0000-0000-4000-8000-000000000011',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select throws_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select unconfigured_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-nan', null,
    now(), now(), -13.5, -71.9, null, null, null, null, 'NaN'::numeric
  )$$,
  '23514', null,
  'GPS sync ingestion rejects numeric NaN before raw evidence or master promotion'
);
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select unconfigured_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-unconfigured', null,
    now() - interval '10 minutes', now() - interval '10 minutes', -13.5, -71.9, null, null, null, null, 12875
  )),
  'persisted',
  'higher GPS evidence persists before a plausibility policy is configured'
);
select is(
  (select outcome::text from public.gps_odometer_promotions where sync_run_id = (select unconfigured_run_id from gps_odometer_state)),
  'requires_review',
  'missing management policy quarantines rather than promotes a higher GPS reading'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12874::numeric,
  'an unconfigured GPS advance cannot change the official master'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where action = 'GPS_ODOMETER_ADVANCE_QUARANTINED'
      and (after_data ->> 'reported_odometer_km')::numeric = 12875
  ),
  'missing-policy quarantine is audited without a master change'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.review_gps_odometer_promotion(
    (select id from public.gps_odometer_promotions where sync_run_id = (select unconfigured_run_id from gps_odometer_state)),
    'rejected', 'Gerencia rechaza la lectura aislada sin política aprobada.', 'e1ab0000-0000-4000-8000-000000000011'
  )$$,
  'management can reject a quarantined GPS advance without changing the master'
);
select is(
  (select decision::text from public.gps_odometer_promotion_reviews where promotion_id = (
    select id from public.gps_odometer_promotions where sync_run_id = (select unconfigured_run_id from gps_odometer_state)
  )),
  'rejected',
  'rejected quarantine retains a durable management decision'
);
reset role;
set local role service_role;
select is(
  (public.finish_gps_sync_run(
    (select unconfigured_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'quarantined evidence does not fail the controlled synchronization'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.configure_gps_odometer_plausibility_policy(
    10, 120, 'Gerencia aprueba límites conservadores para el piloto de Goldcar.',
    'e1aa0000-0000-4000-8000-000000000001'
  )$$,
  'management explicitly configures the company GPS odometer plausibility policy using the same UUID already used by another company'
);
select is(
  (select max_auto_advance_km from public.gps_odometer_plausibility_policies),
  10::numeric,
  'configured plausibility policy is visible only to management'
);
select is(
  (select version from public.gps_odometer_plausibility_policies),
  1,
  'the first company policy request creates version one'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where company_id = 'e1000000-0000-0000-0000-000000000001'
      and action = 'GPS_ODOMETER_PLAUSIBILITY_POLICY_CONFIGURED'
  ),
  1,
  'the first company policy request writes one audit event'
);
select is(
  (
    public.configure_gps_odometer_plausibility_policy(
      10, 120, 'Gerencia aprueba límites conservadores para el piloto de Goldcar.',
      'e1aa0000-0000-4000-8000-000000000001'
    )
  ).version,
  1,
  'a matching retry returns the original policy snapshot'
);
select is(
  (select version from public.gps_odometer_plausibility_policies),
  1,
  'a matching retry does not increment the policy version'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where company_id = 'e1000000-0000-0000-0000-000000000001'
      and action = 'GPS_ODOMETER_PLAUSIBILITY_POLICY_CONFIGURED'
  ),
  1,
  'a matching retry does not append a duplicate policy audit event'
);
select throws_ok(
  $$select public.configure_gps_odometer_plausibility_policy(
    10, 120, 'Una solicitud reutilizada no puede cambiar su motivo.',
    'e1aa0000-0000-4000-8000-000000000001'
  )$$,
  '23505', 'GPS odometer plausibility policy idempotency key was already used',
  'a policy request UUID cannot be rebound to different command content'
);

reset role;
set local role service_role;
update gps_odometer_state
set advanced_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1b00000-0000-4000-8000-000000000011',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select advanced_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-advanced', null,
    now() - interval '9 minutes', now() - interval '9 minutes', -13.5, -71.9, null, null, null, null, 12875.25
  )),
  'persisted',
  'GPS sync return contract remains about persisted evidence'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12875.25::numeric,
  'a higher validated Goldcar reading advances the official master automatically'
);
select ok(
  exists (
    select 1
    from public.gps_odometer_promotions promotion
    join public.odometer_entries entry
      on entry.company_id = promotion.company_id
      and entry.id = promotion.odometer_entry_id
    where promotion.company_id = 'e1000000-0000-0000-0000-000000000001'
      and promotion.promotion_kind = 'sync'
      and promotion.outcome = 'advanced'
      and promotion.sync_run_id = (select advanced_run_id from gps_odometer_state)
      and entry.recorded_by = 'e1100000-0000-0000-0000-000000000001'
  ),
  'automatic promotion creates an attributed official entry using the sync authorizer'
);
select is(
  (public.finish_gps_sync_run(
    (select advanced_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'higher-odometer synchronization finalizes normally'
);

update gps_odometer_state
set confirmed_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1c00000-0000-4000-8000-000000000012',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select is(
  (select disposition from public.ingest_goldcar_detail_position_for_sync(
    (select confirmed_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-stale', null,
    now() - interval '9 minutes 30 seconds', now() - interval '9 minutes 30 seconds', -13.5, -71.9, null, null, null, null, 12900
  )),
  'persisted',
  'late higher GPS evidence remains persisted for telemetry reconciliation'
);
select ok(
  not exists (
    select 1
    from public.vehicle_latest_positions latest
    join public.gps_positions position
      on position.company_id = latest.company_id
      and position.id = latest.position_id
    where latest.company_id = 'e1000000-0000-0000-0000-000000000001'
      and latest.vehicle_id = 'e1400000-0000-0000-0000-000000000004'
      and position.observation_key = 'odometer-stale'
  ),
  'late GPS evidence does not replace the current vehicle projection'
);
select is(
  (select count(*)::integer from public.gps_odometer_promotions where sync_run_id = (select confirmed_run_id from gps_odometer_state)),
  0,
  'a non-current GPS position creates no authoritative promotion'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12875.25::numeric,
  'a non-current higher GPS position cannot advance the official master'
);
select ok(
  not exists (
    select 1
    from public.audit_events event
    where event.company_id = 'e1000000-0000-0000-0000-000000000001'
      and event.action in ('GPS_ODOMETER_PROMOTED', 'GPS_ODOMETER_CONFIRMED', 'GPS_ODOMETER_REGRESSION_DETECTED', 'GPS_ODOMETER_ADVANCE_QUARANTINED')
      and event.after_data ->> 'reported_odometer_km' = '12900'
  ),
  'a non-current GPS position creates no authoritative odometer audit'
);
select lives_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select confirmed_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-confirmed', null,
    now() - interval '8 minutes', now() - interval '8 minutes', -13.5, -71.9, null, null, null, null, 12875.25
  )$$,
  'equal Goldcar odometer evidence is persisted'
);
select is(
  (select count(*)::integer from public.odometer_entries where vehicle_id = 'e1400000-0000-0000-0000-000000000004' and source = 'goldcar'),
  2,
  'an equal GPS reading confirms but does not duplicate the official entry'
);
select is(
  (select outcome::text from public.gps_odometer_promotions where sync_run_id = (select confirmed_run_id from gps_odometer_state)),
  'confirmed',
  'equal GPS reading produces an explicit confirmation outcome'
);
select is(
  (public.finish_gps_sync_run(
    (select confirmed_run_id from gps_odometer_state), 'succeeded', 2, 2, 2, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'equal-odometer synchronization finalizes normally'
);

update gps_odometer_state
set regression_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1d00000-0000-4000-8000-000000000013',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select lives_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select regression_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-regression', null,
    now() - interval '7 minutes', now() - interval '7 minutes', -13.5, -71.9, null, null, null, null, 12870
  )$$,
  'regressive GPS evidence remains observable rather than failing the sync'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12875.25::numeric,
  'a lower post-enrollment GPS reading never decreases the official master'
);
select ok(
  exists (
    select 1
    from public.gps_odometer_promotions promotion
    join public.audit_events event
      on event.company_id = promotion.company_id
      and event.action = 'GPS_ODOMETER_REGRESSION_DETECTED'
    where promotion.sync_run_id = (select regression_run_id from gps_odometer_state)
      and promotion.outcome = 'regression'
      and promotion.odometer_entry_id is null
  ),
  'regressive GPS evidence leaves a durable promotion and reconciliation audit without a master entry'
);
select is(
  (public.finish_gps_sync_run(
    (select regression_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'regression evidence does not make the controlled synchronization fail'
);

update gps_odometer_state
set anomalous_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1da0000-0000-4000-8000-000000000014',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select lives_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select anomalous_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-anomalous', null,
    now() - interval '6 minutes', now() - interval '6 minutes', -13.5, -71.9, null, null, null, null, 12890
  )$$,
  'a higher GPS point beyond the approved step bound remains telemetry evidence'
);
update gps_odometer_state
set anomalous_promotion_id = (
  select id
  from public.gps_odometer_promotions
  where sync_run_id = gps_odometer_state.anomalous_run_id
);
select is(
  (select outcome::text from public.gps_odometer_promotions where id = (select anomalous_promotion_id from gps_odometer_state)),
  'requires_review',
  'a policy-exceeding GPS advance is quarantined rather than auto-promoted'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12875.25::numeric,
  'a policy-exceeding GPS advance leaves the official master unchanged'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where action = 'GPS_ODOMETER_ADVANCE_QUARANTINED'
      and after_data ->> 'promotion_id' = (select anomalous_promotion_id::text from gps_odometer_state)
  ),
  'a policy-exceeding GPS advance is independently audited for management review'
);
select is(
  (public.finish_gps_sync_run(
    (select anomalous_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'anomalous evidence does not fail the controlled synchronization'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.review_gps_odometer_promotion(
    (select anomalous_promotion_id from gps_odometer_state),
    'approved', 'Gerencia validó la lectura excepcional contra Goldcar.', 'e1db0000-0000-4000-8000-000000000014'
  )$$,
  'management can explicitly approve the current quarantined GPS advance'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12890::numeric,
  'approved quarantine advances the official master only through management review'
);
select ok(
  exists (
    select 1
    from public.gps_odometer_promotion_reviews review
    join public.odometer_entries entry
      on entry.company_id = review.company_id
      and entry.id = review.odometer_entry_id
    where review.promotion_id = (select anomalous_promotion_id from gps_odometer_state)
      and review.decision = 'approved'
      and review.previous_odometer_km = 12875.25
      and review.resulting_odometer_km = 12890
      and entry.reading_type = 'gps_review'
  ),
  'approval creates a durable review decision and attributed official GPS entry'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where action = 'GPS_ODOMETER_QUARANTINE_APPROVED'
      and after_data ->> 'promotion_id' = (select anomalous_promotion_id::text from gps_odometer_state)
  ),
  'approved quarantine is auditable without exposing location coordinates'
);
select is(
  (public.review_gps_odometer_promotion(
    (select anomalous_promotion_id from gps_odometer_state),
    'approved', 'Gerencia validó la lectura excepcional contra Goldcar.', 'e1db0000-0000-4000-8000-000000000014'
  )).decision::text,
  'approved',
  'identical quarantine-review retry is idempotent'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.gps_odometer_authorities),
  1,
  'management can read its company authority configuration'
);
select is(
  (select count(*)::integer from public.gps_odometer_promotions),
  6,
  'management can read its company baseline, quarantine and synchronization promotion ledger'
);
select is(
  (select count(*)::integer from public.gps_odometer_promotion_reviews),
  2,
  'management can read rejected and approved GPS quarantine decisions'
);
select set_config('request.jwt.claim.sub', 'e1200000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.gps_odometer_authorities), 0, 'administration cannot read authority configuration');
select is((select count(*)::integer from public.gps_odometer_promotions), 0, 'administration cannot read promotion ledger');
select is((select count(*)::integer from public.gps_odometer_plausibility_policies), 0, 'administration cannot read plausibility policy');
select is((select count(*)::integer from public.gps_odometer_promotion_reviews), 0, 'administration cannot read quarantine reviews');
select set_config('request.jwt.claim.sub', 'e1300000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-regression'),
    12875.25, 'standard', 'Conductor no puede cambiar la fuente oficial', 'e1e00000-0000-4000-8000-000000000014'
  )$$,
  '42501', null,
  'driver cannot enroll a GPS odometer authority'
);
select set_config('request.jwt.claim.sub', 'f1100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select first_link_id from gps_odometer_state),
    (select baseline_position_id from gps_odometer_state),
    12875.25, 'standard', 'Otra empresa no puede usar evidencia ajena', 'f1e00000-0000-4000-8000-000000000014'
  )$$,
  'P0002', null,
  'another company cannot enroll another company GPS evidence'
);

select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.suspend_gps_odometer_authority(
    (select initial_authority_id from gps_odometer_state),
    'Gerencia suspende la autoridad para revisar la fuente sin desconectar telemetría.'
  )$$,
  'management can suspend odometer authority without unlinking its GPS source'
);
select is(
  (select status::text from public.gps_odometer_authorities where id = (select initial_authority_id from gps_odometer_state)),
  'suspended',
  'explicit authority suspension is durable'
);
select is(
  (select active::text from public.gps_provider_vehicle_links where id = (select first_link_id from gps_odometer_state)),
  'true',
  'suspending odometer authority keeps the approved GPS mapping active'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where action = 'GPS_ODOMETER_AUTHORITY_SUSPENDED'
      and entity_type = 'gps_odometer_authority'
  ),
  'authority suspension is audited separately from GPS mapping lifecycle'
);

reset role;
set local role service_role;
update public.vehicles
set current_odometer_km = 99999
where id = 'e1400000-0000-0000-0000-000000000004';
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12890::numeric,
  'suspended authority still prevents silent manual takeover of the master'
);
update gps_odometer_state
set suspended_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1dc0000-0000-4000-8000-000000000015',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select lives_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select suspended_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001', 'odometer-while-suspended', null,
    now() - interval '5 minutes', now() - interval '5 minutes', -13.5, -71.9, null, null, null, null, 12891.5
  )$$,
  'GPS remains observable while odometer authority is suspended'
);
select is(
  (select count(*)::integer from public.gps_odometer_promotions where sync_run_id = (select suspended_run_id from gps_odometer_state)),
  0,
  'suspended authority cannot auto-promote even current GPS evidence'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12890::numeric,
  'suspended authority leaves the official master unchanged'
);
select is(
  (public.finish_gps_sync_run(
    (select suspended_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'suspended-authority synchronization finalizes normally'
);

insert into public.work_orders (
  id, company_id, code, vehicle_id, maintenance_type, source, created_by
) values (
  'e1d10000-0000-4000-8000-000000000015',
  'e1000000-0000-0000-0000-000000000001',
  'ODO-SUSPENDED-MANUAL-EVIDENCE',
  'e1400000-0000-0000-0000-000000000004',
  'inspection',
  'manual',
  'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.complete_work_order(
    'e1d10000-0000-4000-8000-000000000015', 12880, 0, 0
  )$$,
  'a lower manual work-order reading remains evidence while GPS authority is suspended'
);
select ok(
  (select odometer_km from public.work_orders where id = 'e1d10000-0000-4000-8000-000000000015') = 12880
  and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12890,
  'suspended GPS authority preserves lower manual work-order evidence without manual master takeover'
);
update gps_odometer_state
set rebaseline_promotion_id = (public.activate_gps_odometer_authority(
  first_link_id,
  (select id from public.gps_positions where observation_key = 'odometer-while-suspended'),
  12890,
  'standard',
  'Gerencia rebaselina la misma fuente Goldcar tras revisar la suspensión.',
  'e1dd0000-0000-4000-8000-000000000015'
)).id;
select is(
  (select outcome::text from public.gps_odometer_promotions where id = (select rebaseline_promotion_id from gps_odometer_state)),
  'advanced',
  'same active provider link may receive an explicit standard re-baseline after suspension'
);
select is(
  (select count(*)::integer from public.gps_odometer_authorities where vehicle_id = 'e1400000-0000-0000-0000-000000000004'),
  2,
  're-baseline preserves the suspended authority history and creates a new active authority'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12891.5::numeric,
  'explicit standard re-baseline advances the master from current validated evidence'
);

-- Exercise each final manual command as a real lower-reading workflow while
-- the re-baselined Goldcar authority is active.  Each command must retain its
-- business evidence, while the authoritative-master trigger leaves 12891.5
-- intact.
reset role;
set local role service_role;
insert into public.clients (id, company_id, legal_name) values (
  'e2010000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'GPS Odometer Manual Evidence Client'
);
insert into public.suppliers (id, company_id, legal_name, supplier_type) values (
  'e2020000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'GPS Odometer Manual Evidence Supplier',
  'fuel'
);
insert into public.drivers (id, company_id, profile_id, display_name) values (
  'e2030000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001',
  'e1300000-0000-0000-0000-000000000003',
  'GPS Odometer Driver A'
);
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, operational_status, created_by
) values (
  'e2040000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001', 'ODO-MANUAL-START',
  'e2010000-0000-4000-8000-000000000001', 'e1400000-0000-0000-0000-000000000004',
  'e2030000-0000-4000-8000-000000000001', 'Origen de prueba', 'Destino de prueba',
  now() - interval '2 hours', 'scheduled', 'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.start_trip('e2040000-0000-4000-8000-000000000001', 12880)$$,
  'start_trip records a lower manual reading under active GPS authority'
);
select ok(
  exists (
    select 1 from public.odometer_entries
    where trip_id = 'e2040000-0000-4000-8000-000000000001'
      and reading_km = 12880 and reading_type = 'trip_start'
  ) and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12891.5,
  'start_trip preserves lower evidence without replacing the Goldcar master'
);

reset role;
set local role service_role;
update public.trips
set operational_status = 'completed', administrative_status = 'settlement_pending'
where id = 'e2040000-0000-4000-8000-000000000001';
update public.drivers set current_status = 'available'
where id = 'e2030000-0000-4000-8000-000000000001';
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, started_at, operational_status, created_by
) values (
  'e2060000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001', 'ODO-MANUAL-COMPLETE',
  'e2010000-0000-4000-8000-000000000001', 'e1400000-0000-0000-0000-000000000004',
  'e2030000-0000-4000-8000-000000000001', 'Origen de prueba', 'Destino de prueba',
  now() - interval '3 hours', now() - interval '2 hours', 'unloading', 'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.complete_trip('e2060000-0000-4000-8000-000000000001', 12880, true)$$,
  'complete_trip records a lower manual reading under active GPS authority'
);
select ok(
  exists (
    select 1 from public.odometer_entries
    where trip_id = 'e2060000-0000-4000-8000-000000000001'
      and reading_km = 12880 and reading_type = 'trip_finish'
  ) and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12891.5,
  'complete_trip preserves lower evidence without replacing the Goldcar master'
);

reset role;
set local role service_role;
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, operational_status, created_by
) values (
  'e2080000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001', 'ODO-MANUAL-ENTRY',
  'e2010000-0000-4000-8000-000000000001', 'e1400000-0000-0000-0000-000000000004',
  'e2030000-0000-4000-8000-000000000001', 'Origen de prueba', 'Destino de prueba',
  now() - interval '2 hours', 'loading', 'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.record_odometer_entry(
    'e2090000-0000-4000-8000-000000000001', 'e2080000-0000-4000-8000-000000000001', 12880,
    now() - interval '30 minutes', 'manual_check', 'odo-device-a', 'e20a0000-0000-4000-8000-000000000001'
  )$$,
  'record_odometer_entry retains a lower manual reading under active GPS authority'
);
select ok(
  exists (
    select 1 from public.odometer_entries
    where id = 'e2090000-0000-4000-8000-000000000001'
      and reading_km = 12880 and source = 'driver_app'
  ) and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12891.5,
  'record_odometer_entry preserves lower evidence without replacing the Goldcar master'
);

reset role;
set local role service_role;
update public.trips
set operational_status = 'completed', administrative_status = 'settlement_pending'
where id = 'e2080000-0000-4000-8000-000000000001';
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, operational_status, created_by
) values (
  'e20b0000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001', 'ODO-MANUAL-FUEL',
  'e2010000-0000-4000-8000-000000000001', 'e1400000-0000-0000-0000-000000000004',
  'e2030000-0000-4000-8000-000000000001', 'Origen de prueba', 'Destino de prueba',
  now() - interval '2 hours', 'loading', 'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.record_staff_trip_fuel_entry(
    'e20c0000-0000-4000-8000-000000000001', 'e20b0000-0000-4000-8000-000000000001',
    'e2020000-0000-4000-8000-000000000001', now() - interval '20 minutes', 'Patio de prueba',
    12880, 10, 'gallon', 2, 20, 'PEN'::char(3), 'cash', 'ticket', 'ODO-FUEL-001', null,
    'Registro administrativo de la lectura manual', 'e20d0000-0000-4000-8000-000000000001'
  )$$,
  'staff fuel representation retains a lower manual odometer under active GPS authority'
);
select ok(
  exists (
    select 1 from public.fuel_entries
    where id = 'e20c0000-0000-4000-8000-000000000001'
      and odometer_km = 12880
  ) and exists (
    select 1 from public.odometer_entries
    where trip_id = 'e20b0000-0000-4000-8000-000000000001'
      and reading_km = 12880 and reading_type = 'fuel'
  ) and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12891.5,
  'staff fuel representation preserves its lower evidence without replacing the Goldcar master'
);

reset role;
set local role service_role;
update public.trips
set operational_status = 'completed', administrative_status = 'settlement_pending'
where id = 'e20b0000-0000-4000-8000-000000000001';
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, operational_status, created_by
) values (
  'e20e0000-0000-4000-8000-000000000001',
  'e1000000-0000-0000-0000-000000000001', 'ODO-MANUAL-OFFLINE',
  'e2010000-0000-4000-8000-000000000001', 'e1400000-0000-0000-0000-000000000004',
  'e2030000-0000-4000-8000-000000000001', 'Origen de prueba', 'Destino de prueba',
  now() - interval '2 hours', 'loading', 'e1100000-0000-0000-0000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1300000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    'e20f0000-0000-4000-8000-000000000001', 'e20e0000-0000-4000-8000-000000000001', 'start',
    12880, false, now() - interval '10 minutes', 'offline-device-a'
  )$$,
  'apply_driver_trip_transition retains a lower offline start reading under active GPS authority'
);
select ok(
  exists (
    select 1 from public.trip_transition_requests
    where id = 'e20f0000-0000-4000-8000-000000000001'
      and odometer_km = 12880
  ) and exists (
    select 1 from public.odometer_entries
    where trip_id = 'e20e0000-0000-4000-8000-000000000001'
      and reading_km = 12880 and reading_type = 'trip_start'
  ) and (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004') = 12891.5,
  'apply_driver_trip_transition preserves lower offline evidence without replacing the Goldcar master'
);

reset role;
set local role service_role;
update public.trips
set operational_status = 'completed', administrative_status = 'settlement_pending'
where id = 'e20e0000-0000-4000-8000-000000000001';
update public.drivers set current_status = 'available'
where id = 'e2030000-0000-4000-8000-000000000001';
insert into public.work_orders (
  id, company_id, code, vehicle_id, maintenance_type, source, created_by
) values (
  'e1de0000-0000-4000-8000-000000000015',
  'e1000000-0000-0000-0000-000000000001',
  'ODO-MANUAL-EVIDENCE',
  'e1400000-0000-0000-0000-000000000004',
  'inspection',
  'manual',
  'e1100000-0000-0000-0000-000000000001'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.complete_work_order(
    'e1de0000-0000-4000-8000-000000000015', 12880, 0, 0
  )$$,
  'a lower manual work-order reading remains recorded as evidence while GPS owns the master'
);
select is(
  (select odometer_km from public.work_orders where id = 'e1de0000-0000-4000-8000-000000000015'),
  12880::numeric,
  'manual lower work-order mileage is retained as its operational evidence'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12891.5::numeric,
  'manual work-order evidence never takes over the GPS official master'
);
select lives_ok(
  $$select public.unlink_gps_vehicle((select first_link_id from gps_odometer_state), 'Goldcar source replacement requires re-enrollment')$$,
  'unlinking the re-baselined source suspends its currently active authority'
);
select is(
  (select status::text from public.gps_odometer_authorities where id = (
    select authority_id from public.gps_odometer_promotions where id = (select rebaseline_promotion_id from gps_odometer_state)
  )),
  'suspended',
  'unlinking suspends the current re-baselined GPS odometer authority'
);
select lives_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:ODO-TEST-001-REPLACEMENT', 'Replacement source', 'e1400000-0000-0000-0000-000000000004')$$,
  'management may create a replacement link but it receives no automatic authority'
);
update gps_odometer_state
set replacement_link_id = (
  select id
  from public.gps_provider_vehicle_links
  where company_id = 'e1000000-0000-0000-0000-000000000001'
    and external_asset_id = 'portal-name:ODO-TEST-001-REPLACEMENT'
);

reset role;
set local role service_role;
update gps_odometer_state
set replacement_run_id = (public.begin_gps_sync_run(
  'e1000000-0000-0000-0000-000000000001',
  'GOLDCAR_PORTAL_RPA', 'e1f00000-0000-4000-8000-000000000015',
  'e1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select lives_ok(
  $$select public.ingest_goldcar_detail_position_for_sync(
    (select replacement_run_id from gps_odometer_state),
    'portal-name:ODO-TEST-001-REPLACEMENT', 'odometer-replacement', null,
    now() - interval '4 minutes', now() - interval '4 minutes', -13.5, -71.9, null, null, null, null, 12000
  )$$,
  'replacement-link GPS evidence is persisted without inheriting authority'
);
select is(
  (select current_odometer_km from public.vehicles where id = 'e1400000-0000-0000-0000-000000000004'),
  12891.5::numeric,
  'new GPS link cannot change the master before explicit new enrollment'
);
select is(
  (public.finish_gps_sync_run(
    (select replacement_run_id from gps_odometer_state), 'succeeded', 1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'replacement-link evidence run finalizes normally'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1100000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.activate_gps_odometer_authority(
    (select replacement_link_id from gps_odometer_state),
    (select id from public.gps_positions where observation_key = 'odometer-replacement'),
    12891.5, 'test_placeholder', 'La correccion de marcador de prueba no puede repetirse', 'e2000000-0000-4000-8000-000000000016'
  )$$,
  '23505', null,
  'one vehicle cannot use the test-placeholder downward correction a second time'
);

select * from finish(true);
rollback;
