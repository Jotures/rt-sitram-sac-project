import { spawnSync } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const implementationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validation = `
do $acl_validation$
declare
  public_authenticated_count integer;
  private_authenticated_count integer;
  public_acl_matches boolean;
  private_acl_matches boolean;
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'anon security-definer function remains executable';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname in ('public','private')
      and p.prosecdef
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC security-definer EXECUTE grant remains';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.prosecdef
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) then
    raise exception 'service_role can execute an auth-bound security-definer function';
  end if;

  select count(*)::integer into public_authenticated_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if public_authenticated_count <> 44 then
    raise exception 'authenticated public ACL count is %, expected 44', public_authenticated_count;
  end if;

  with intended(oid) as (
    select unnest(array[
      'public.approve_trip(uuid)'::regprocedure,
      'public.schedule_trip(uuid,uuid,uuid)'::regprocedure,
      'public.transition_trip_operational(uuid,public.trip_operational_status,integer,text)'::regprocedure,
      'public.start_trip(uuid,numeric)'::regprocedure,
      'public.complete_trip(uuid,numeric,boolean)'::regprocedure,
      'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric)'::regprocedure,
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
      'public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,character,text,text,uuid,text,text,uuid)'::regprocedure,
      'public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,character,text,text,text,uuid,text,uuid)'::regprocedure,
      'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,character,text,text,text,uuid,text,uuid)'::regprocedure,
      'public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid)'::regprocedure,
      'public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text)'::regprocedure,
      'public.create_operational_cycle(uuid,text,uuid,uuid,public.return_status,text,uuid)'::regprocedure,
      'public.update_operational_cycle(uuid,integer,public.operational_cycle_status,public.return_status,text)'::regprocedure,
      'public.add_trip_to_operational_cycle(uuid,uuid,public.operational_cycle_leg_kind,integer)'::regprocedure,
      'public.remove_trip_from_operational_cycle(uuid,uuid,integer,text)'::regprocedure,
      'public.attach_trip_file(text,uuid,uuid)'::regprocedure,
      'public.create_trip_evaluation_policy(text,text,char,public.trip_evaluation_margin_basis,public.trip_evaluation_tax_basis,numeric,numeric,numeric,jsonb,timestamptz,timestamptz)'::regprocedure,
      'public.save_trip_evaluation(uuid,jsonb,uuid,uuid,uuid,text,integer,uuid)'::regprocedure,
      'public.fix_trip_evaluation(uuid)'::regprocedure,
        'public.approve_trip_evaluation_exception(uuid,text)'::regprocedure,
        'public.link_gps_vehicle(text,text,text,uuid)'::regprocedure,
        'public.unlink_gps_vehicle(uuid,text)'::regprocedure,
        'public.configure_gps_telemetry_retention(integer)'::regprocedure,
        'public.configure_gps_odometer_plausibility_policy(numeric,numeric,text,uuid)'::regprocedure,
        'public.suspend_gps_odometer_authority(uuid,text)'::regprocedure,
        'public.activate_gps_odometer_authority(uuid,uuid,numeric,public.gps_odometer_bootstrap_mode,text,uuid)'::regprocedure,
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
  select count(*) = 0 into public_acl_matches
  from (
    (select oid from actual except select oid from intended)
    union all
    (select oid from intended except select oid from actual)
  ) mismatch;
  if not public_acl_matches then
    raise exception 'authenticated public ACL differs from the command allowlist';
  end if;

  select count(*)::integer into private_authenticated_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if private_authenticated_count <> 8 then
    raise exception 'authenticated private ACL count is %, expected 8', private_authenticated_count;
  end if;

  with intended(oid) as (
    select unnest(array[
      'private.current_company_id()'::regprocedure,
      'private.current_app_role()'::regprocedure,
      'private.is_staff()'::regprocedure,
      'private.current_driver_id()'::regprocedure,
      'private.is_accounting()'::regprocedure,
      'private.can_access_trip(uuid)'::regprocedure,
      'private.can_write_trip_activity(uuid)'::regprocedure,
      'private.can_access_file(text)'::regprocedure
    ])
  ), actual(oid) as (
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
  select count(*) = 0 into private_acl_matches
  from (
    (select oid from actual except select oid from intended)
    union all
    (select oid from intended except select oid from actual)
  ) mismatch;
  if not private_acl_matches then
    raise exception 'authenticated private ACL differs from the RLS helper allowlist';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.refresh_operational_alerts()',
    'EXECUTE'
  ) then
    raise exception 'refresh_operational_alerts remains exposed';
  end if;

  if has_function_privilege('authenticated', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.begin_gps_sync_run(uuid,text,uuid,uuid,integer,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.heartbeat_gps_sync_run(uuid,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.finish_gps_sync_run(uuid,public.gps_sync_run_status,integer,integer,integer,integer,integer,integer,timestamptz,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.ingest_gps_position_for_sync(uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.ingest_goldcar_detail_position_for_sync(uuid,text,text,text,timestamptz,timestamptz,numeric,numeric,numeric,numeric,numeric,boolean,numeric)', 'EXECUTE') then
    raise exception 'Stage 3 GPS synchronization functions do not have the expected service-role-only ACL';
  end if;
  if has_function_privilege('authenticated', 'private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'private.promote_authoritative_gps_odometer_from_sync(uuid,uuid)', 'EXECUTE')
    or not has_schema_privilege('service_role', 'private', 'USAGE') then
    raise exception 'Goldcar odometer promotion helper does not have the expected service-only private ACL';
  end if;
end
$acl_validation$;
`;

// Validate the already deployed ACL surface. Replaying migrations here can
// temporarily revoke or recreate policies and therefore does not describe the
// database state that production clients actually receive.
const sql = `begin;\n${validation}\nrollback;`;
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "rt-sitram-acl-"));
const queryPath = path.join(temporaryDirectory, "verify.sql");
writeFileSync(queryPath, sql, "utf8");

let result;
try {
  result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/supabase-rt.ps1",
      "--",
      "db",
      "query",
      "--linked",
      "--file",
      queryPath,
    ],
    {
      cwd: implementationRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
} finally {
  unlinkSync(queryPath);
  rmdirSync(temporaryDirectory);
}

if (result.status !== 0) {
  process.stderr.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  throw result.error ?? new Error(`Function ACL verification exited with ${result.status}.`);
}

console.log("Function ACL verified in a rolled-back remote transaction.");
