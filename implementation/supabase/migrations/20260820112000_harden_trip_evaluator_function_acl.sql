-- The global ACL hardening migration predates the evaluator. Keep the new
-- command surface explicit and deliberately unavailable to anonymous and
-- service-role JWTs, which lack the actor/company context these commands need.

revoke all on function public.create_trip_evaluation_policy(text,text,char,public.trip_evaluation_margin_basis,public.trip_evaluation_tax_basis,numeric,numeric,numeric,jsonb,timestamptz,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.save_trip_evaluation(uuid,jsonb,uuid,uuid,uuid,text,integer,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.fix_trip_evaluation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.approve_trip_evaluation_exception(uuid,text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_trip_evaluation_policy(text,text,char,public.trip_evaluation_margin_basis,public.trip_evaluation_tax_basis,numeric,numeric,numeric,jsonb,timestamptz,timestamptz)
  to authenticated;
grant execute on function public.save_trip_evaluation(uuid,jsonb,uuid,uuid,uuid,text,integer,uuid)
  to authenticated;
grant execute on function public.fix_trip_evaluation(uuid)
  to authenticated;
grant execute on function public.approve_trip_evaluation_exception(uuid,text)
  to authenticated;
