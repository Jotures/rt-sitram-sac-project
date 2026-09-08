-- Corrections retain original rows, request payload and before/after audit evidence.
alter table public.expenses add column version integer not null default 1;
alter table public.fuel_entries add column version integer not null default 1;
alter table public.advances add column version integer not null default 1;
create function public.correct_cycle_money(p_request_id uuid,p_kind text,p_id uuid,p_expected_version integer,p_amount numeric,p_cancel boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); c uuid; previous jsonb; result jsonb; body jsonb;
 existing public.operation_commands; settlement uuid;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 if p_request_id is null or nullif(trim(p_reason),'') is null or p_cancel is null or
 (not p_cancel and (p_amount is null or p_amount='NaN' or p_amount<=0)) then
 raise exception using errcode='23514',message='Indica el motivo y un importe válido para corregir.'; end if;
 body:=jsonb_build_object('kind',p_kind,'id',p_id,'expected_version',p_expected_version,'amount',p_amount,'cancel',p_cancel,'reason',p_reason);
 perform pg_advisory_xact_lock(hashtextextended(company::text||':operation:'||p_request_id::text,0));
 select * into existing from public.operation_commands where id=p_request_id;
 if found then
 if existing.company_id=company and existing.actor_id=auth.uid() and existing.kind='money_correction' and existing.payload::jsonb=body then return body; end if;
 raise exception using errcode='23505',message='La solicitud ya fue confirmada con otro contenido.'; end if;
 if p_kind='advance' then select to_jsonb(a) into previous from public.advances a where id=p_id and company_id=company;
 elsif p_kind='expense' then select to_jsonb(e) into previous from public.expenses e where id=p_id and company_id=company;
 elsif p_kind='fuel' then select to_jsonb(f) into previous from public.fuel_entries f where id=p_id and company_id=company;
 elsif p_kind='balance_payment' then select to_jsonb(p) into previous from public.cycle_balance_payments p where id=p_id and company_id=company;
 else raise exception using errcode='23514',message='Tipo de movimiento no válido.'; end if;
 if previous is null or previous->>'is_test'='true' then raise exception using errcode='P0002',message='Movimiento no disponible.'; end if;
 c:=(previous->>'cycle_id')::uuid; settlement:=(previous->>'settlement_id')::uuid;
 if settlement is not null then select cycle_id into c from public.settlements where id=settlement and company_id=company; end if;
 if c is null then raise exception using errcode='23514',message='Utiliza el contrato histórico para este movimiento.'; end if;
 perform 1 from public.settlements where cycle_id=c and company_id=company for update;
 perform 1 from public.operational_cycles where id=c and company_id=company for update;
 if exists(select 1 from public.settlements where cycle_id=c and status='closed') then raise exception using errcode='23514',message='Reabre la rendición antes de corregir el movimiento.'; end if;
 if p_kind='balance_payment' then
 if not p_cancel then raise exception using errcode='23514',message='Anula el pago incorrecto y registra el importe real.'; end if;
 update public.cycle_balance_payments set cancelled_at=now(),cancellation_reason=p_reason where id=p_id and cancelled_at is null returning to_jsonb(cycle_balance_payments) into result;
 elsif p_kind='advance' then
 update public.advances set amount=case when p_cancel then amount else p_amount end,status=case when p_cancel then 'cancelled'::public.advance_status else status end,version=version+1
 where id=p_id and version=p_expected_version and status<>'cancelled' returning to_jsonb(advances) into result;
 elsif p_kind='expense' then
 update public.expenses set amount=case when p_cancel then amount else p_amount end,approved_amount=null,
 validation_status=case when p_cancel then 'rejected'::public.validation_status else 'pending_review'::public.validation_status end,version=version+1,updated_at=now()
 where id=p_id and version=p_expected_version returning to_jsonb(expenses) into result;
 else
 update public.fuel_entries set total_amount=case when p_cancel then total_amount else p_amount end,
 unit_price=case when p_cancel then unit_price else round(p_amount/quantity,4) end,approved_amount=null,
 validation_status=case when p_cancel then 'rejected'::public.validation_status else 'pending_review'::public.validation_status end,version=version+1,updated_at=now()
 where id=p_id and version=p_expected_version returning to_jsonb(fuel_entries) into result;
 end if;
 if result is null then raise exception using errcode='40001',message='El movimiento cambió o ya fue anulado. Actualiza la cuenta.'; end if;
 perform private.write_audit(company,case when p_cancel then 'CYCLE_MONEY_CANCELLED' else 'CYCLE_MONEY_CORRECTED' end,p_kind,p_id,previous,result,p_reason);
 insert into public.operation_commands(id,company_id,actor_id,kind,payload,contract_version,dependency_id,result_id)
 values(p_request_id,company,auth.uid(),'money_correction',body::text,1,c,p_id);
 return result;
end; $$;
revoke all on function public.correct_cycle_money(uuid,text,uuid,integer,numeric,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.correct_cycle_money(uuid,text,uuid,integer,numeric,boolean,text) to authenticated;

create function public.get_cycle_cost_report() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.operational_cycles; s jsonb; result jsonb:='[]'; revenue numeric; service_count integer;
begin
 perform private.assert_role(array['management','administration','accounting']::public.app_role[]);
 for c in select * from public.operational_cycles where company_id=private.current_company_id() and status<>'cancelled' order by created_at desc limit 200 loop
 s:=public.get_cycle_rendition(c.id);
 select coalesce(sum(freight_amount+coalesce(additional_amount,0)),0),count(*) into revenue,service_count
 from public.trips where cycle_id=c.id and operational_status<>'cancelled';
 result:=result||jsonb_build_array(jsonb_build_object('id',c.id,'code',c.code,'revenue',revenue,'services',service_count,
 'recognized_cost',(s->>'expense_total')::numeric+(s->>'driver_fuel')::numeric+(s->>'company_fuel')::numeric,
 'pending_cost',coalesce((select sum(amount) from public.expenses where cycle_id=c.id and validation_status in ('pending_review','observed')),0)
 +coalesce((select sum(total_amount) from public.fuel_entries where cycle_id=c.id and validation_status in ('pending_review','observed')),0),
 'freight_pending',exists(select 1 from public.trips where cycle_id=c.id and operational_status<>'cancelled' and freight_amount is null),
 'driver_remaining',s->'remaining'));
 end loop;
 return result;
end; $$;
revoke all on function public.get_cycle_cost_report() from public,anon,authenticated,service_role;
grant execute on function public.get_cycle_cost_report() to authenticated;
