CREATE OR REPLACE FUNCTION public.get_cycle_rendition(p_cycle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare company uuid:=private.current_company_id(); c public.operational_cycles; s public.settlements;
 summary public.cycle_rendition_summaries; funds numeric; costs numeric; driver_fuel numeric; company_fuel numeric;
 additions numeric; paid numeric; balance numeric;
begin
 perform private.assert_role(array['management','administration','accounting']::public.app_role[]);
 select * into c from public.operational_cycles where id=p_cycle_id and company_id=company;
 if not found then raise exception using errcode='P0002',message='Salida no encontrada.'; end if;
 select * into s from public.settlements where cycle_id=c.id and company_id=company;
 select * into summary from public.cycle_rendition_summaries where id=s.id and company_id=company;
 select coalesce(sum(amount),0) into funds from public.advances where cycle_id=c.id and company_id=company and status<>'cancelled';
 select coalesce(sum(coalesce(approved_amount,amount)),0) into costs from public.expenses where cycle_id=c.id and company_id=company and validation_status='validated';
 select coalesce(sum(coalesce(approved_amount,total_amount)) filter(where payment_source='driver_fund'),0),
 coalesce(sum(coalesce(approved_amount,total_amount)) filter(where payment_source='company'),0)
 into driver_fuel,company_fuel from public.fuel_entries where cycle_id=c.id and company_id=company and validation_status='validated';
 select coalesce(sum((l->>'additional_recognized')::numeric),0) into additions from jsonb_array_elements(coalesce(summary.lines,'[]')) l where summary.status='approved';
 select coalesce(sum(case when direction='DRIVER_RETURNS' then amount else -amount end),0) into paid
 from public.cycle_balance_payments where settlement_id=s.id and company_id=company and cancelled_at is null;
 balance:=funds-costs-driver_fuel-additions;
 return jsonb_build_object('cycle',to_jsonb(c),'settlement',case when s.id is null then null else to_jsonb(s) end,'summary',case when summary.id is null then null else to_jsonb(summary) end,
 'baseline',private.cycle_financial_baseline(c.id),'total_advances',funds,'expense_total',costs+additions,
 'driver_fuel',driver_fuel,'company_fuel',company_fuel,'balance',balance,'paid',paid,'remaining',balance-paid,
 'advances_list',coalesce((select jsonb_agg(to_jsonb(a) order by a.delivered_at) from public.advances a where a.company_id=company and a.cycle_id=c.id),'[]'),
 'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.incurred_at) from public.expenses e where e.company_id=company and e.cycle_id=c.id),'[]'),
 'fuel',coalesce((select jsonb_agg(to_jsonb(f) order by f.fueled_at) from public.fuel_entries f where f.company_id=company and f.cycle_id=c.id),'[]'),
 'categories',coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from public.expense_categories e where e.company_id=company and e.active),'[]'),
 'evidence',coalesce((select jsonb_agg(to_jsonb(e)) from public.settlement_evidence e where e.company_id=company and e.settlement_id=s.id),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.occurred_at) from public.cycle_balance_payments p where p.company_id=company and p.settlement_id=s.id),'[]'));
end; $function$
;
