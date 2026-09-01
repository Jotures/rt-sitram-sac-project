begin;
set local search_path = extensions, public, auth;
select plan(19);

select has_type('public', 'trip_load_state', 'explicit trip load state enum exists');
select has_table('public', 'trip_load_state_events', 'load-state events use an append-only fact table');
select has_column('public', 'trip_load_state_events', 'supersedes_event_id', 'corrections reference the original event');
select has_column('public', 'trip_load_state_events', 'correction_reason', 'corrections retain their reason');
select has_column('public', 'vehicle_status_history', 'source', 'status coverage records its source');
select has_column('public', 'work_orders', 'currency', 'maintenance cost declares its currency');

select has_function(
  'public', 'record_trip_load_state_event',
  array['uuid','uuid','trip_load_state','timestamp with time zone','numeric','text','uuid','uuid','text'],
  'append-only load-state command exists'
);
select has_function(
  'public', 'set_vehicle_operational_status',
  array['uuid','vehicle_status','text'],
  'manual status command exists'
);
select has_function(
  'public', 'get_report_snapshot',
  array['text','date','date','uuid','uuid','uuid','uuid'],
  'single snapshot command exists'
);
select has_function(
  'public', 'get_report_dossier_snapshot',
  array['text[]','date','date','uuid','uuid','uuid','uuid'],
  'single dossier snapshot command exists'
);
select has_function('public', 'record_report_export', array['text','text','jsonb'], 'audited export command exists');
select has_function('public', 'get_report_filter_options', array[]::text[], 'authorized filter option command exists');

select has_view('public', 'report_trip_facts', 'trip report facts view exists');
select has_view('public', 'report_fuel_facts', 'fuel report facts view exists');
select has_view('public', 'report_maintenance_facts', 'maintenance report facts view exists');
select has_view('public', 'report_collection_facts', 'collection report facts view exists');
select has_view('public', 'report_vehicle_status_intervals', 'vehicle interval report facts view exists');
select has_view('public', 'report_distance_segments', 'explicit distance segment facts view exists');

select ok(
  not has_table_privilege('authenticated', 'public.trip_load_state_events', 'INSERT')
  and has_function_privilege('authenticated', 'public.record_trip_load_state_event(uuid,uuid,public.trip_load_state,timestamptz,numeric,text,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.record_trip_load_state_event(uuid,uuid,public.trip_load_state,timestamptz,numeric,text,uuid,uuid,text)', 'EXECUTE'),
  'load-state capture can only use its authenticated authoritative command'
);

select * from finish();
rollback;
