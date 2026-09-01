begin;
set local search_path = extensions, public, auth;
select plan(37);

select has_table('public', 'gps_sync_runs', 'GPS sync-run table remains the controlled synchronization log');
select has_column('public', 'gps_positions', 'sync_run_id', 'GPS evidence records its Stage 3 sync run');
select has_column('public', 'gps_sync_runs', 'request_id', 'sync runs have an idempotent request key');
select has_column('public', 'gps_sync_runs', 'initiated_by', 'sync runs record their management authorizer');
select has_column('public', 'gps_sync_runs', 'lease_expires_at', 'sync runs have a durable lease');
select has_column('public', 'gps_sync_runs', 'deadline_at', 'sync runs have a bounded deadline');
select has_column('public', 'gps_sync_runs', 'heartbeat_at', 'sync runs record lease heartbeats');
select has_column('public', 'gps_sync_runs', 'provider_checkpoint_at', 'sync runs retain only a diagnostic provider checkpoint');
select has_column('public', 'gps_sync_runs', 'source_attempts', 'sync runs retain the bounded source attempt count');
select has_function('public', 'begin_gps_sync_run', array['uuid','text','uuid','uuid','integer','integer'], 'server-only GPS sync begin contract exists');
select has_function('public', 'heartbeat_gps_sync_run', array['uuid','integer'], 'server-only GPS sync heartbeat contract exists');
select has_function('public', 'finish_gps_sync_run', array['uuid','gps_sync_run_status','integer','integer','integer','integer','integer','integer','timestamp with time zone','text'], 'server-only GPS sync finish contract exists');
select has_function('public', 'ingest_gps_position_for_sync', array['uuid','text','text','text','text','timestamp with time zone','timestamp with time zone','numeric','numeric','numeric','numeric','numeric','boolean','numeric'], 'GPS sync ingestion outcome contract exists');
select ok(
  not has_function_privilege('authenticated', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE'),
  'only service role receives the Stage 3 GPS synchronization contracts'
);

insert into public.companies (id, legal_name) values
  ('c1000000-0000-0000-0000-000000000001', 'GPS SYNC COMPANY A'),
  ('d1000000-0000-0000-0000-000000000002', 'GPS SYNC COMPANY B');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('c1100000-0000-0000-0000-000000000001', 'gps-sync-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('c1200000-0000-0000-0000-000000000002', 'gps-sync-admin-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('c1300000-0000-0000-0000-000000000003', 'gps-sync-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('d1100000-0000-0000-0000-000000000001', 'gps-sync-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role) values
  ('c1100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'GPS Sync Management A', 'management'),
  ('c1200000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'GPS Sync Admin A', 'administration'),
  ('c1300000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'GPS Sync Driver A', 'driver'),
  ('d1100000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'GPS Sync Management B', 'management');
insert into public.vehicles (id, company_id, plate) values
  ('c1400000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'GPS-SYNC-A-001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1100000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.link_gps_vehicle('GOLDCAR_PORTAL_RPA', 'portal-name:GPS-SYNC-A-001', 'Unidad GPS Sync', 'c1400000-0000-0000-0000-000000000004')$$,
  'management approves the source asset before any sync can begin'
);
select lives_ok(
  $$select public.configure_gps_telemetry_retention(30)$$,
  'management approves telemetry retention before persistence can begin'
);

reset role;
set local role service_role;
create temporary table gps_sync_control_state (
  first_run_id uuid,
  second_run_id uuid,
  third_run_id uuid
);
insert into gps_sync_control_state default values;
update gps_sync_control_state
set first_run_id = (public.begin_gps_sync_run(
  'c1000000-0000-0000-0000-000000000001', 'GOLDCAR_PORTAL_RPA',
  'c1500000-0000-4000-8000-000000000005', 'c1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select is(
  (select status::text from public.gps_sync_runs where id = (select first_run_id from gps_sync_control_state)),
  'started',
  'manual sync starts with an active durable lease'
);
select is(
  (select initiated_by from public.gps_sync_runs where id = (select first_run_id from gps_sync_control_state)),
  'c1100000-0000-0000-0000-000000000001'::uuid,
  'manual sync records the authorizing management profile'
);
select throws_ok(
  $$select public.begin_gps_sync_run(
    'c1000000-0000-0000-0000-000000000001', 'GOLDCAR_PORTAL_RPA',
    'c1600000-0000-4000-8000-000000000006', 'c1100000-0000-0000-0000-000000000001', 120, 240
  )$$,
  '55P03', null,
  'a second manual request cannot overlap an active provider lease'
);
select is(
  (select disposition from public.ingest_gps_position_for_sync(
    (select first_run_id from gps_sync_control_state),
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-SYNC-A-001', 'stage3-linked', null,
    now() - interval '1 minute', now(), -13.5, -71.9, null, null, null, null, null
  )),
  'persisted',
  'a linked snapshot position is persisted with an explicit outcome'
);
select is(
  (select sync_run_id from public.gps_positions where observation_key = 'stage3-linked'),
  (select first_run_id from gps_sync_control_state),
  'persisted evidence is traceable to its synchronization run'
);
select is(
  (select disposition from public.ingest_gps_position_for_sync(
    (select first_run_id from gps_sync_control_state),
    'GOLDCAR_PORTAL_RPA', 'portal-name:GPS-SYNC-A-001', 'stage3-linked', null,
    now() - interval '1 minute', now(), -13.5, -71.9, null, null, null, null, null
  )),
  'deduplicated',
  'a replay returns a deduplicated outcome instead of duplicating evidence'
);
update public.gps_sync_runs
set deadline_at = now() + interval '10 seconds',
    lease_expires_at = now() + interval '5 seconds'
where id = (select first_run_id from gps_sync_control_state);
select cmp_ok(
  (select lease_expires_at from public.heartbeat_gps_sync_run((select first_run_id from gps_sync_control_state), 120)),
  '<=',
  (select deadline_at from public.gps_sync_runs where id = (select first_run_id from gps_sync_control_state)),
  'a heartbeat cannot extend a lease beyond the run deadline'
);
select is(
  (public.finish_gps_sync_run(
    (select first_run_id from gps_sync_control_state), 'succeeded',
    1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'a bounded successful run releases its lease with honest counters'
);
select is(
  (public.finish_gps_sync_run(
    (select first_run_id from gps_sync_control_state), 'succeeded',
    1, 1, 1, 0, 0, 1, now(), null
  )).status::text,
  'succeeded',
  'repeating an identical finish request is idempotent'
);

update gps_sync_control_state
set second_run_id = (public.begin_gps_sync_run(
  'c1000000-0000-0000-0000-000000000001', 'GOLDCAR_PORTAL_RPA',
  'c1700000-0000-4000-8000-000000000007', 'c1100000-0000-0000-0000-000000000001', 120, 240
)).id;
update public.gps_sync_runs
set lease_expires_at = now() - interval '1 second'
where id = (select second_run_id from gps_sync_control_state);
update gps_sync_control_state
set third_run_id = (public.begin_gps_sync_run(
  'c1000000-0000-0000-0000-000000000001', 'GOLDCAR_PORTAL_RPA',
  'c1800000-0000-4000-8000-000000000008', 'c1100000-0000-0000-0000-000000000001', 120, 240
)).id;
select is(
  (select status::text from public.gps_sync_runs where id = (select third_run_id from gps_sync_control_state)),
  'started',
  'an expired lease permits a new manual synchronization run'
);
select is(
  (select status::text from public.gps_sync_runs where id = (select second_run_id from gps_sync_control_state)),
  'failed',
  'the superseded expired run is closed as failed'
);
select is(
  (select error_code from public.gps_sync_runs where id = (select second_run_id from gps_sync_control_state)),
  'LEASE_EXPIRED',
  'lease recovery records only a canonical error code'
);
select is(
  (select disposition from public.ingest_gps_position_for_sync(
    (select third_run_id from gps_sync_control_state),
    'GOLDCAR_PORTAL_RPA', 'portal-name:UNKNOWN', 'stage3-unlinked', null,
    now(), now(), -13.5, -71.9, null, null, null, null, null
  )),
  'unlinked',
  'an unknown source asset is counted without being implicitly mapped'
);
select is(
  (select count(*)::integer from public.gps_positions where observation_key = 'stage3-unlinked'),
  0,
  'an unlinked source asset does not write GPS evidence'
);
select throws_ok(
  $$select public.finish_gps_sync_run(
    (select third_run_id from gps_sync_control_state), 'succeeded',
    1, 1, 0, 0, 1, 1, now(), null
  )$$,
  '23514', null,
  'a run with an unlinked asset cannot be reported as successful'
);
select is(
  (public.finish_gps_sync_run(
    (select third_run_id from gps_sync_control_state), 'failed',
    1, 1, 0, 0, 1, 1, now(), 'UNLINKED_ASSET'
  )).status::text,
  'failed',
  'an unlinked asset closes the run with a visible failed outcome'
);
select ok(
  (select error_message like '%sin un vínculo aprobado%'
    from public.gps_sync_runs where id = (select third_run_id from gps_sync_control_state)),
  'the persisted failure message is canonical rather than caller-provided text'
);
select throws_ok(
  $$select public.begin_gps_sync_run(
    'd1000000-0000-0000-0000-000000000002', 'GOLDCAR_PORTAL_RPA',
    'd1500000-0000-4000-8000-000000000005', 'd1100000-0000-0000-0000-000000000001', 120, 240
  )$$,
  'P0002', null,
  'a manual sync cannot begin without retention and an approved source mapping'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1100000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.gps_sync_runs), 3, 'management can read its company sync summaries');
select set_config('request.jwt.claim.sub', 'c1300000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.gps_sync_runs), 0, 'driver cannot read GPS sync summaries');
select set_config('request.jwt.claim.sub', 'd1100000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.gps_sync_runs), 0, 'another company cannot read GPS sync summaries');

select * from finish(true);
rollback;
