begin;
set local search_path = extensions, public, auth;
select plan(82);

select has_function('public', 'approve_trip', array['uuid'], 'approve_trip contract exists');
select has_function('public', 'schedule_trip', array['uuid','uuid','uuid'], 'schedule_trip contract exists');
select has_function('public', 'start_trip', array['uuid','numeric'], 'start_trip contract exists');
select has_function('public', 'complete_trip', array['uuid','numeric','boolean'], 'complete_trip contract exists');
select has_function('public', 'complete_trip', array['uuid','numeric','integer','uuid','boolean'], 'authoritative complete_trip requires delivery confirmation');
select has_function('public', 'issue_trip_advance', array['uuid','uuid','numeric','text'], 'issue_trip_advance contract exists');
select has_function('public', 'issue_trip_advance', array['uuid','uuid','timestamp with time zone','numeric','text','text','uuid'], 'idempotent advance administration contract exists');
select has_function('public', 'close_settlement', array['uuid','text','text','text'], 'traceable settlement closure contract exists');
select has_function('public', 'reopen_settlement', array['uuid','text'], 'reopen_settlement contract exists');
select has_function('public', 'complete_work_order', array['uuid','numeric','numeric','numeric'], 'complete_work_order contract exists');
select has_function('public', 'create_work_order', array['uuid','uuid','uuid','text','text','timestamp with time zone','boolean','text','uuid'], 'audited work order creation contract exists');
select has_function('public', 'update_work_order_progress', array['uuid','uuid','work_order_status','timestamp with time zone','timestamp with time zone','text','text','text','boolean'], 'audited work order progress contract exists');
select has_function('public', 'record_work_order_part', array['uuid','uuid','uuid','uuid','numeric','numeric','timestamp with time zone','numeric','text','uuid'], 'idempotent work order part contract exists');
select has_function('public', 'attach_work_order_evidence', array['uuid','uuid','uuid','text','uuid'], 'private work order evidence contract exists');
select has_function('public', 'create_trip_invoice', array['uuid','uuid','text','text','timestamp with time zone','timestamp with time zone','numeric'], 'create_trip_invoice contract exists');
select has_function('public', 'create_trip_invoice', array['uuid','uuid','text','text','date','date','numeric','numeric'], 'tax-aware invoice administration contract exists');
select has_function('public', 'register_invoice_payment', array['uuid','timestamp with time zone','numeric','text','text'], 'register_invoice_payment contract exists');
select has_function('public', 'resolve_alert', array['uuid','text'], 'resolve_alert contract exists');
select has_function('public', 'record_odometer_entry', array['uuid','uuid','numeric','timestamp with time zone','text','text','uuid'], 'record_odometer_entry contract exists');
select has_function('public', 'record_fuel_entry', array['uuid','uuid','uuid','timestamp with time zone','text','numeric','numeric','text','numeric','numeric','character','text','text','text','uuid','text','uuid'], 'record_fuel_entry contract exists');
select has_function('public', 'record_expense', array['uuid','uuid','uuid','uuid','timestamp with time zone','numeric','character','text','text','uuid','text','text','uuid'], 'record_expense contract exists');
select has_function('public', 'record_staff_trip_expense', array['uuid','uuid','uuid','uuid','timestamp with time zone','numeric','character','text','text','uuid','text','text','uuid'], 'staff trip expense representation contract exists');
select has_function('public', 'record_staff_trip_fuel_entry', array['uuid','uuid','uuid','timestamp with time zone','text','numeric','numeric','text','numeric','numeric','character','text','text','text','uuid','text','uuid'], 'staff trip fuel representation contract exists');
select has_function('public', 'create_operational_cycle', array['uuid','text','uuid','uuid','return_status','text','uuid'], 'operational cycle creation contract exists');
select has_function('public', 'update_operational_cycle', array['uuid','integer','operational_cycle_status','return_status','text'], 'operational cycle update contract exists');
select has_function('public', 'add_trip_to_operational_cycle', array['uuid','uuid','operational_cycle_leg_kind','integer'], 'operational cycle trip assignment contract exists');
select has_function('public', 'remove_trip_from_operational_cycle', array['uuid','uuid','integer','text'], 'operational cycle trip removal contract exists');
select has_function('public', 'report_incident', array['uuid','uuid','timestamp with time zone','text','text','incident_severity','text','text','numeric','uuid','text','uuid'], 'report_incident contract exists');
select has_function('public', 'attach_trip_file', array['text','uuid','uuid'], 'attach_trip_file contract exists');
select has_function('public', 'refresh_operational_alerts', array[]::text[], 'refresh_operational_alerts contract exists');
select has_function('public', 'apply_driver_trip_transition', array['uuid','uuid','text','numeric','boolean','timestamp with time zone','text'], 'offline driver transition contract exists');
select has_function('public', 'review_expense', array['uuid','validation_status','numeric','text'], 'audited expense review contract exists');
select has_function('public', 'link_driver_profile', array['uuid','uuid'], 'driver profile link contract exists');
select has_function('public', 'create_trip_with_load', array['uuid','text','text','timestamp with time zone','numeric','text','numeric'], 'atomic trip and initial load contract exists');
select has_function('public', 'create_trip_with_load', array['uuid','text','text','timestamp with time zone','numeric','text','numeric','freight_pricing_mode','numeric'], 'per-ton trip capture contract exists');
select has_function('public', 'update_client_master', array['uuid','timestamp with time zone','text','text','text','text','text','integer','client_relationship_type','boolean','text'], 'audited client master update contract exists');
select has_function('public', 'update_vehicle_master', array['uuid','timestamp with time zone','text','text','text','integer','numeric','vehicle_ownership_type','text','boolean','text'], 'audited vehicle master update contract exists');
select has_function('public', 'update_driver_master', array['uuid','timestamp with time zone','text','text','text','text','text','date','text','date','date','uuid','boolean','text'], 'audited driver master update contract exists');
select has_function('public', 'set_driver_availability', array['uuid','timestamp with time zone','driver_status','text'], 'controlled driver availability contract exists');
select has_function('public', 'create_supplier', array['text','text','text','text','text','text','text'], 'audited supplier creation contract exists');
select has_function('public', 'update_supplier_master', array['uuid','timestamp with time zone','text','text','text','text','text','text','boolean','text'], 'audited supplier master update contract exists');
select has_function('public', 'attach_document_file', array['uuid','uuid','timestamp with time zone'], 'audited document attachment contract exists');
select has_function('public', 'create_trip_evaluation_policy', array['text','text','character','trip_evaluation_margin_basis','trip_evaluation_tax_basis','numeric','numeric','numeric','jsonb','timestamp with time zone','timestamp with time zone'], 'versioned trip evaluation policy contract exists');
select has_function('public', 'save_trip_evaluation', array['uuid','jsonb','uuid','uuid','uuid','text','integer','uuid'], 'server-calculated trip evaluation save contract exists');
select has_function('public', 'fix_trip_evaluation', array['uuid'], 'trip evaluation fixation contract exists');
select has_function('public', 'approve_trip_evaluation_exception', array['uuid','text'], 'management trip evaluation exception approval contract exists');
select has_function('public', 'link_gps_vehicle', array['text','text','text','uuid'], 'audited GPS vehicle-link command exists');
select has_function('public', 'unlink_gps_vehicle', array['uuid','text'], 'audited GPS vehicle-unlink command exists');
select has_function('public', 'configure_gps_telemetry_retention', array['integer'], 'GPS retention configuration command exists');
select has_function('public', 'activate_gps_odometer_authority', array['uuid','uuid','numeric','gps_odometer_bootstrap_mode','text','uuid'], 'management GPS odometer authority enrollment contract exists');
select has_function('public', 'configure_gps_odometer_plausibility_policy', array['numeric','numeric','text','uuid'], 'idempotent management GPS odometer plausibility-policy contract exists');
select ok(
  to_regprocedure('public.configure_gps_odometer_plausibility_policy(numeric,numeric,text)') is null,
  'legacy non-idempotent GPS odometer plausibility-policy contract does not remain callable'
);
select has_function('public', 'suspend_gps_odometer_authority', array['uuid','text'], 'management GPS odometer authority suspension contract exists');
select has_function('public', 'review_gps_odometer_promotion', array['uuid','gps_odometer_review_decision','text','uuid'], 'management GPS odometer quarantine-review contract exists');
select has_function('public', 'ingest_gps_position', array['text','text','text','text','timestamp with time zone','timestamp with time zone','numeric','numeric','numeric','numeric','numeric','boolean','numeric'], 'server-only GPS ingestion contract exists');
select has_function('public', 'purge_expired_gps_positions', array['uuid'], 'server-only GPS retention purge contract exists');
select has_function('public', 'begin_gps_sync_run', array['uuid','text','uuid','uuid','integer','integer'], 'server-only controlled GPS sync begin contract exists');
select has_function('public', 'heartbeat_gps_sync_run', array['uuid','integer'], 'server-only controlled GPS sync heartbeat contract exists');
select has_function('public', 'finish_gps_sync_run', array['uuid','gps_sync_run_status','integer','integer','integer','integer','integer','integer','timestamp with time zone','text'], 'server-only controlled GPS sync finish contract exists');
select has_function('public', 'ingest_gps_position_for_sync', array['uuid','text','text','text','text','timestamp with time zone','timestamp with time zone','numeric','numeric','numeric','numeric','numeric','boolean','numeric'], 'server-only GPS sync ingestion outcome contract exists');
select has_function('public', 'ingest_goldcar_detail_position_for_sync', array['uuid','text','text','text','timestamp with time zone','timestamp with time zone','numeric','numeric','numeric','numeric','numeric','boolean','numeric'], 'server-only Goldcar detail ingestion contract exists');
select has_column('public', 'gps_positions', 'source_kind', 'GPS evidence retains immutable source provenance');
select has_column('public', 'gps_positions', 'odometer_source_semantic', 'GPS evidence retains the reported-kilometer semantic');

select has_column('public', 'settlements', 'resolution_method', 'settlement resolution method is stored');
select has_column('public', 'settlements', 'resolution_reference', 'settlement resolution reference is stored');
select has_column('public', 'settlements', 'resolution_note', 'settlement resolution note is stored');
select has_column('public', 'settlements', 'resolution_direction', 'settlement resolution direction is stored');
select has_column('public', 'settlements', 'resolved_amount', 'settlement resolved amount is stored');
select has_column('public', 'settlements', 'resolved_by', 'settlement resolver is stored');
select has_column('public', 'settlements', 'resolved_at', 'settlement resolution time is stored');

select ok(
  to_regprocedure('public.close_settlement(uuid)') is null,
  'legacy one-argument settlement closure no longer exists'
);
select ok(
  not has_function_privilege('authenticated', 'public.close_settlement(uuid,integer)', 'EXECUTE'),
  'versioned settlement primitive is not executable by authenticated users'
);
select ok(
  not has_table_privilege('authenticated', 'public.trips', 'INSERT'),
  'authenticated users cannot insert incomplete trips directly'
);
select ok(
  has_function_privilege('authenticated', 'public.close_settlement(uuid,text,text,text)', 'EXECUTE'),
  'authenticated users enter settlement closure through the traceable contract'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname in ('public','private')
      and p.prosecdef
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute any application security-definer function'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon cannot execute any application security-definer function'
);
select ok(
  (
    with intended(oid) as (
      select unnest(array[
        'public.approve_trip(uuid)'::regprocedure,
        'public.schedule_trip(uuid,uuid,uuid)'::regprocedure,
        'public.transition_trip_operational(uuid,public.trip_operational_status,integer,text)'::regprocedure,
        'public.start_trip(uuid,numeric)'::regprocedure,
        'public.complete_trip(uuid,numeric,boolean)'::regprocedure,
        'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric)'::regprocedure,
        'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)'::regprocedure,
        'public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)'::regprocedure,
        'public.update_vehicle_master(uuid,timestamptz,text,text,text,integer,numeric,public.vehicle_ownership_type,text,boolean,text)'::regprocedure,
        'public.update_driver_master(uuid,timestamptz,text,text,text,text,text,date,text,date,date,uuid,boolean,text)'::regprocedure,
        'public.set_driver_availability(uuid,timestamptz,public.driver_status,text)'::regprocedure,
        'public.create_supplier(text,text,text,text,text,text,text)'::regprocedure,
        'public.update_supplier_master(uuid,timestamptz,text,text,text,text,text,text,boolean,text)'::regprocedure,
        'public.attach_document_file(uuid,uuid,timestamptz)'::regprocedure,
        'public.issue_trip_advance(uuid,uuid,numeric,text)'::regprocedure,
        'public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid)'::regprocedure,
        'public.review_expense(uuid,public.validation_status,numeric,text)'::regprocedure,
        'public.close_settlement(uuid,text,text,text)'::regprocedure,
        'public.reopen_settlement(uuid,text)'::regprocedure,
        'public.complete_work_order(uuid,numeric,numeric,numeric)'::regprocedure,
        'public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)'::regprocedure,
        'public.update_work_order_progress(uuid,uuid,public.work_order_status,timestamptz,timestamptz,text,text,text,boolean)'::regprocedure,
        'public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)'::regprocedure,
        'public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)'::regprocedure,
        'public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric)'::regprocedure,
        'public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric)'::regprocedure,
        'public.register_invoice_payment(uuid,timestamptz,numeric,text,text)'::regprocedure,
        'public.resolve_alert(uuid,text)'::regprocedure,
        'public.link_driver_profile(uuid,uuid)'::regprocedure,
        'public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid)'::regprocedure,
        'public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,character,text,text,uuid,text,text,uuid)'::regprocedure,
        'public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,character,text,text,text,uuid,text,uuid)'::regprocedure,
        'public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,character,text,text,uuid,text,text,uuid)'::regprocedure,
        'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,character,text,text,text,uuid,text,uuid)'::regprocedure,
        'public.create_operational_cycle(uuid,text,uuid,uuid,public.return_status,text,uuid)'::regprocedure,
        'public.update_operational_cycle(uuid,integer,public.operational_cycle_status,public.return_status,text)'::regprocedure,
        'public.add_trip_to_operational_cycle(uuid,uuid,public.operational_cycle_leg_kind,integer)'::regprocedure,
        'public.remove_trip_from_operational_cycle(uuid,uuid,integer,text)'::regprocedure,
        'public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid)'::regprocedure,
        'public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text)'::regprocedure,
        'public.attach_trip_file(text,uuid,uuid)'::regprocedure,
        'public.create_trip_evaluation_policy(text,text,char,public.trip_evaluation_margin_basis,public.trip_evaluation_tax_basis,numeric,numeric,numeric,jsonb,timestamptz,timestamptz)'::regprocedure,
        'public.save_trip_evaluation(uuid,jsonb,uuid,uuid,uuid,text,integer,uuid)'::regprocedure,
        'public.fix_trip_evaluation(uuid)'::regprocedure,
        'public.approve_trip_evaluation_exception(uuid,text)'::regprocedure,
        'public.link_gps_vehicle(text,text,text,uuid)'::regprocedure,
        'public.unlink_gps_vehicle(uuid,text)'::regprocedure,
        'public.configure_gps_telemetry_retention(integer)'::regprocedure,
        'public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)'::regprocedure,
        'public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)'::regprocedure,
        'public.suspend_gps_odometer_authority(uuid,text)'::regprocedure,
        'public.review_gps_odometer_promotion(uuid,public.gps_odometer_review_decision,text,uuid)'::regprocedure
      ])
    ), actual(oid) as (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    select not exists (
      (select oid from actual except select oid from intended)
      union all
      (select oid from intended except select oid from actual)
    )
  ),
  'authenticated public security-definer ACL matches the UI and PowerSync allowlist exactly'
);

select ok(
  (
    with intended(oid) as (
      select unnest(array[
        'private.current_company_id()'::regprocedure,
        'private.current_app_role()'::regprocedure,
        'private.is_staff()'::regprocedure,
        'private.current_driver_id()'::regprocedure,
        'private.is_accounting()'::regprocedure,
        'private.can_access_trip(uuid)'::regprocedure,
        'private.can_write_trip_activity(uuid)'::regprocedure,
        'private.can_access_file(text)'::regprocedure,
        'private.is_gps_telemetry_visible(uuid,uuid)'::regprocedure
      ])
    ), actual(oid) as (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.prosecdef
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    select not exists (
      (select oid from actual except select oid from intended)
      union all
      (select oid from intended except select oid from actual)
    )
  ),
  'authenticated private security-definer ACL contains only RLS and storage helpers'
);
select ok(
  (
    with intended(oid) as (
      select unnest(array[
        'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)'::regprocedure,
        'public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)'::regprocedure,
        'public.update_vehicle_master(uuid,timestamptz,text,text,text,integer,numeric,public.vehicle_ownership_type,text,boolean,text)'::regprocedure,
        'public.update_driver_master(uuid,timestamptz,text,text,text,text,text,date,text,date,date,uuid,boolean,text)'::regprocedure,
        'public.set_driver_availability(uuid,timestamptz,public.driver_status,text)'::regprocedure,
        'public.create_supplier(text,text,text,text,text,text,text)'::regprocedure,
        'public.update_supplier_master(uuid,timestamptz,text,text,text,text,text,text,boolean,text)'::regprocedure,
        'public.attach_document_file(uuid,uuid,timestamptz)'::regprocedure
      ])
    ), actual(oid) as (
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('service_role', p.oid, 'EXECUTE')
    )
    select not exists (select oid from intended except select oid from actual)
  ),
  'service role receives every explicit human-first command alongside its server-only work'
);

select ok(
  not has_function_privilege('authenticated', 'public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.ingest_gps_position(text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.purge_expired_gps_positions(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.purge_expired_gps_positions(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE'),
  'GPS and Goldcar-detail server-only commands are executable only by service role'
);
select ok(
  not has_function_privilege('authenticated', 'public.refresh_operational_alerts()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.refresh_operational_alerts()', 'EXECUTE'),
  'unwired alert refresh command is not exposed'
);
select ok(
  not has_function_privilege('authenticated', 'public.start_trip(uuid,numeric,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_trip(uuid,numeric,integer,uuid,boolean)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.start_trip(uuid,numeric,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.complete_trip(uuid,numeric,integer,uuid,boolean)', 'EXECUTE'),
  'retired GPS-authority trip overloads are outside the executable command surface'
);

select * from finish(true);
rollback;
