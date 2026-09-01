-- Supabase exposes functions through the Data API and PostgreSQL grants
-- EXECUTE to PUBLIC by default. Reset both current and future function ACLs,
-- then expose only the auth-bound product commands and RLS helpers in use.

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

revoke execute on all functions in schema public
  from public, anon, authenticated, service_role;
revoke execute on all functions in schema private
  from public, anon, authenticated, service_role;

-- Private helpers are invoked by RLS/storage policy expressions. Trigger and
-- command-only helpers remain executable only by their owner.
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.current_driver_id() to authenticated;
grant execute on function private.is_accounting() to authenticated;
grant execute on function private.can_access_trip(uuid) to authenticated;
grant execute on function private.can_write_trip_activity(uuid) to authenticated;
grant execute on function private.can_access_file(text) to authenticated;

-- UI command surface.
grant execute on function public.approve_trip(uuid) to authenticated;
grant execute on function public.schedule_trip(uuid,uuid,uuid) to authenticated;
grant execute on function public.transition_trip_operational(uuid,public.trip_operational_status,integer,text) to authenticated;
grant execute on function public.start_trip(uuid,numeric) to authenticated;
grant execute on function public.complete_trip(uuid,numeric,boolean) to authenticated;
grant execute on function public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric) to authenticated;
grant execute on function public.issue_trip_advance(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated;
grant execute on function public.review_expense(uuid,public.validation_status,numeric,text) to authenticated;
grant execute on function public.close_settlement(uuid,text,text,text) to authenticated;
grant execute on function public.reopen_settlement(uuid,text) to authenticated;
grant execute on function public.complete_work_order(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric) to authenticated;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric) to authenticated;
grant execute on function public.register_invoice_payment(uuid,timestamptz,numeric,text,text) to authenticated;
grant execute on function public.resolve_alert(uuid,text) to authenticated;
grant execute on function public.link_driver_profile(uuid,uuid) to authenticated;

-- PowerSync upload and attachment workers execute with the signed-in user's
-- access token, preserving the auth.uid(), role, and company checks inside.
grant execute on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) to authenticated;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) to authenticated;
grant execute on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) to authenticated;
grant execute on function public.apply_driver_trip_transition(uuid,uuid,text,numeric,boolean,timestamptz,text) to authenticated;
grant execute on function public.attach_trip_file(text,uuid,uuid) to authenticated;

-- No current public command is valid under a bare service_role JWT: every
-- command derives company and actor from auth.uid(). Server-only maintenance
-- should receive a separate, explicitly scoped contract when introduced.
