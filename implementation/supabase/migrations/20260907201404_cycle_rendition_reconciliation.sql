-- DEC-048: reconciliation keeps the original sheet totals and adds only explicit differences.
alter table public.fuel_entries add column approved_amount numeric(14,2)
  check (approved_amount is null or (approved_amount >= 0 and approved_amount <= total_amount));
create table public.cycle_rendition_summaries (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  cycle_id uuid not null,
  lines jsonb not null default '[]',
  baseline text not null,
  status text not null check(status in ('draft','submitted','approved','observed')),
  version integer not null default 1,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  foreign key(company_id,id) references public.settlements(company_id,id),
  foreign key(company_id,cycle_id) references public.operational_cycles(company_id,id),
  foreign key(company_id,updated_by) references public.profiles(company_id,id)
);
create table public.cycle_balance_payments (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  settlement_id uuid not null,
  direction text not null check(direction in ('DRIVER_RETURNS','COMPANY_REIMBURSES')),
  amount numeric(14,2) not null check(amount > 0 and amount <> 'NaN'),
  method text not null check(length(trim(method)) > 0),
  reference text,
  occurred_at timestamptz not null,
  actor_id uuid not null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  foreign key(company_id,settlement_id) references public.settlements(company_id,id),
  foreign key(company_id,actor_id) references public.profiles(company_id,id)
);
create index cycle_balance_payments_scope_idx on public.cycle_balance_payments(company_id,settlement_id);

create function private.guard_cycle_financial_write() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.operational_cycles; payload jsonb:=to_jsonb(new); occurred timestamptz;
begin
 if new.cycle_id is null then return new; end if;
 select * into c from public.operational_cycles where id=new.cycle_id and company_id=new.company_id for update;
 if not found or c.status='cancelled' then raise exception using errcode='23514',message='La salida no está disponible para movimientos.'; end if;
 if exists(select 1 from public.settlements where cycle_id=c.id and company_id=c.company_id and status='closed') then
 raise exception using errcode='23514',message='Reabre la rendición antes de corregir o añadir movimientos.'; end if;
 if tg_op='UPDATE' and (old.cycle_id,old.company_id,old.driver_id) is distinct from (new.cycle_id,new.company_id,new.driver_id) then
 raise exception using errcode='23514',message='No se puede transferir un movimiento a otra cuenta.'; end if;
 if new.driver_id is distinct from c.primary_driver_id or new.currency<>'PEN' then raise exception using errcode='23514',message='Revisa el conductor y la moneda de esta cuenta.'; end if;
 if (payload->>'amount')::numeric='NaN' or (payload->>'total_amount')::numeric='NaN' or (payload->>'quantity')::numeric='NaN' or (payload->>'unit_price')::numeric='NaN' then
 raise exception using errcode='23514',message='Los importes deben ser números válidos.'; end if;
 if private.current_app_role()='driver' and (c.primary_driver_id is distinct from private.current_driver_id() or c.capture_channel<>'driver_app') then
 raise exception using errcode='42501',message='La captura de esta salida está a cargo de oficina.'; end if;
 occurred:=coalesce((payload->>'incurred_at')::timestamptz,(payload->>'fueled_at')::timestamptz,(payload->>'delivered_at')::timestamptz);
 if occurred>now()+interval '5 minutes' then raise exception using errcode='23514',message='El movimiento no puede tener una fecha futura.'; end if;
 return new;
end; $$;
revoke all on function private.guard_cycle_financial_write() from public,anon,authenticated;
create trigger cycle_expense_integrity before insert or update on public.expenses for each row execute function private.guard_cycle_financial_write();
create trigger cycle_fuel_integrity before insert or update on public.fuel_entries for each row execute function private.guard_cycle_financial_write();
create trigger cycle_advance_integrity before insert or update on public.advances for each row execute function private.guard_cycle_financial_write();
alter table public.cycle_rendition_summaries enable row level security;
alter table public.cycle_balance_payments enable row level security;
revoke all on public.cycle_rendition_summaries,public.cycle_balance_payments from public,anon,authenticated,service_role;
grant select on public.cycle_rendition_summaries,public.cycle_balance_payments to authenticated;
create policy cycle_summary_read on public.cycle_rendition_summaries for select to authenticated
using(company_id=(select private.current_company_id()) and private.can_access_operational_cycle(cycle_id));
create policy cycle_payment_read on public.cycle_balance_payments for select to authenticated
using(company_id=(select private.current_company_id()) and exists(select 1 from public.settlements s
 where s.id=settlement_id and s.company_id=cycle_balance_payments.company_id and private.can_access_operational_cycle(s.cycle_id)));

-- Changes to source records make the sheet review stale; closure requires a fresh reconciliation.
create function private.cycle_financial_baseline(p_cycle uuid) returns text language sql stable security definer set search_path='' as $$
select md5(jsonb_build_object(
 'expenses',coalesce((select jsonb_agg(jsonb_build_array(id,category_id,amount,approved_amount,validation_status) order by id)
   from public.expenses where cycle_id=p_cycle),'[]'),
 'fuel',coalesce((select jsonb_agg(jsonb_build_array(id,total_amount,approved_amount,validation_status,payment_source) order by id)
   from public.fuel_entries where cycle_id=p_cycle),'[]'))::text);
$$;
revoke all on function private.cycle_financial_baseline(uuid) from public,anon,authenticated;

create function public.get_cycle_rendition(p_cycle_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
 return jsonb_build_object('cycle',to_jsonb(c),'settlement',to_jsonb(s),'summary',to_jsonb(summary),
 'baseline',private.cycle_financial_baseline(c.id),'total_advances',funds,'expense_total',costs+additions,
 'driver_fuel',driver_fuel,'company_fuel',company_fuel,'balance',balance,'paid',paid,'remaining',balance-paid,
 'advances_list',coalesce((select jsonb_agg(to_jsonb(a) order by a.delivered_at) from public.advances a where a.company_id=company and a.cycle_id=c.id),'[]'),
 'expenses',coalesce((select jsonb_agg(to_jsonb(e) order by e.incurred_at) from public.expenses e where e.company_id=company and e.cycle_id=c.id),'[]'),
 'fuel',coalesce((select jsonb_agg(to_jsonb(f) order by f.fueled_at) from public.fuel_entries f where f.company_id=company and f.cycle_id=c.id),'[]'),
 'categories',coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from public.expense_categories e where e.company_id=company and e.active),'[]'),
 'evidence',coalesce((select jsonb_agg(to_jsonb(e)) from public.settlement_evidence e where e.company_id=company and e.settlement_id=s.id),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.occurred_at) from public.cycle_balance_payments p where p.company_id=company and p.settlement_id=s.id),'[]'));
end; $$;

create function public.save_cycle_rendition(p_settlement_id uuid,p_lines jsonb,p_baseline text,p_status text,p_expected_version integer,p_reason text)
returns public.cycle_rendition_summaries language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); s public.settlements; previous public.cycle_rendition_summaries;
 result public.cycle_rendition_summaries; line jsonb; normalized jsonb:='[]'; category uuid; declared numeric; recognized numeric;
 captured numeric; acknowledged numeric; ids jsonb; seen uuid[]:='{}';
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 select * into s from public.settlements where id=p_settlement_id and company_id=company and cycle_id is not null for update;
 if not found then raise exception using errcode='P0002',message='Rendición no encontrada.'; end if;
 if s.status='closed' then raise exception using errcode='23514',message='Reabre la rendición antes de corregirla.'; end if;
 perform 1 from public.operational_cycles where id=s.cycle_id for update;
 select * into previous from public.cycle_rendition_summaries where id=s.id for update;
 if coalesce(previous.version,0)<>p_expected_version then raise exception using errcode='40001',message='La hoja cambió. Recarga antes de guardar.'; end if;
 if previous.status='approved' and nullif(trim(p_reason),'') is null then raise exception using errcode='23514',message='Indica el motivo de la corrección.'; end if;
 if p_status not in ('draft','submitted','approved','observed') or jsonb_typeof(p_lines) is distinct from 'array' then
 raise exception using errcode='23514',message='Resumen no válido.'; end if;
 if p_baseline is distinct from private.cycle_financial_baseline(s.cycle_id) then
 raise exception using errcode='40001',message='Hay gastos o combustible nuevos o corregidos. Revisa la conciliación.'; end if;
 if p_status in ('submitted','approved') and not exists(select 1 from public.settlement_evidence where settlement_id=s.id and company_id=company) then
 raise exception using errcode='23514',message='Sincroniza las hojas antes de presentar la rendición.'; end if;
 if p_status='approved' and (exists(select 1 from public.expenses where cycle_id=s.cycle_id and validation_status in ('pending_review','observed'))
 or exists(select 1 from public.fuel_entries where cycle_id=s.cycle_id and validation_status in ('pending_review','observed'))) then
 raise exception using errcode='23514',message='Revisa los gastos y abastecimientos pendientes antes de aprobar el resumen.'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 category:=(line->>'category_id')::uuid; declared:=(line->>'declared')::numeric; recognized:=(line->>'recognized')::numeric;
 if category is null or category=any(seen) or not exists(select 1 from public.expense_categories where id=category and company_id=company and active) then
 raise exception using errcode='23514',message='Categoría repetida o no disponible.'; end if;
 seen:=array_append(seen,category);
 select coalesce(sum(amount),0),coalesce(sum(coalesce(approved_amount,amount)) filter(where validation_status='validated'),0),coalesce(jsonb_agg(id order by id),'[]')
 into captured,acknowledged,ids from public.expenses where cycle_id=s.cycle_id and category_id=category and validation_status<>'rejected';
 if declared is null or recognized is null or declared='NaN' or recognized='NaN' or declared<captured or recognized<acknowledged or recognized>declared
 or recognized-acknowledged>declared-captured then
 raise exception using errcode='23514',message='Los totales de la hoja deben incluir lo ya registrado. Corrige el gasto original si necesitas reducirlo.'; end if;
 if declared>captured and nullif(trim(line->>'description'),'') is null then
 raise exception using errcode='23514',message='Describe los importes adicionales de la hoja.'; end if;
 normalized:=normalized||jsonb_build_array(line||jsonb_build_object('expense_ids',ids,'captured',captured,'captured_recognized',acknowledged,
 'additional_declared',declared-captured,'additional_recognized',recognized-acknowledged));
 end loop;
 insert into public.cycle_rendition_summaries(id,company_id,cycle_id,lines,baseline,status,updated_by)
 values(s.id,company,s.cycle_id,normalized,p_baseline,p_status,auth.uid())
 on conflict(id) do update set lines=excluded.lines,baseline=excluded.baseline,status=excluded.status,
 version=cycle_rendition_summaries.version+1,updated_by=auth.uid(),updated_at=now() returning * into result;
 perform private.write_audit(company,'CYCLE_SHEET_RECONCILED','settlement',s.id,to_jsonb(previous),to_jsonb(result),p_reason);
 return result;
end; $$;

create function public.review_cycle_fuel(p_id uuid,p_status public.validation_status,p_amount numeric,p_expected_updated_at timestamptz,p_reason text)
returns public.fuel_entries language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); old_row public.fuel_entries; result public.fuel_entries;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 select * into old_row from public.fuel_entries where id=p_id and company_id=company and cycle_id is not null;
 if not found then raise exception using errcode='P0002',message='Abastecimiento no encontrado.'; end if;
 perform 1 from public.operational_cycles where id=old_row.cycle_id for update;
 select * into old_row from public.fuel_entries where id=p_id for update;
 if old_row.updated_at is distinct from p_expected_updated_at then raise exception using errcode='40001',message='El abastecimiento cambió. Recarga antes de revisar.'; end if;
 if exists(select 1 from public.settlements where cycle_id=old_row.cycle_id and status='closed') then
 raise exception using errcode='23514',message='Reabre la rendición antes de corregir el combustible.'; end if;
 if p_status not in ('validated','observed','rejected') or (p_status='validated' and (p_amount is null or p_amount='NaN' or p_amount<0 or p_amount>old_row.total_amount)) then
 raise exception using errcode='23514',message='Revisa el importe reconocido.'; end if;
 if (p_status<>'validated' or p_amount<>old_row.total_amount or old_row.validation_status='validated') and nullif(trim(p_reason),'') is null then
 raise exception using errcode='23514',message='Indica el motivo de la observación o corrección.'; end if;
 update public.fuel_entries set validation_status=p_status,approved_amount=case when p_status='validated' then p_amount else null end,updated_at=now()
 where id=p_id returning * into result;
 perform private.write_audit(company,'CYCLE_FUEL_REVIEWED','fuel_entry',p_id,to_jsonb(old_row),to_jsonb(result),p_reason);
 return result;
end; $$;

create function public.record_cycle_balance_payment(p_id uuid,p_settlement_id uuid,p_direction text,p_amount numeric,p_method text,p_reference text,p_occurred_at timestamptz,p_expected_remaining numeric)
returns public.cycle_balance_payments language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); s public.settlements; existing public.cycle_balance_payments; result public.cycle_balance_payments; snapshot jsonb; remaining numeric;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 perform pg_advisory_xact_lock(hashtextextended(company::text||':balance:'||p_id::text,0));
 select * into existing from public.cycle_balance_payments where id=p_id;
 if found then
 if (existing.company_id,existing.settlement_id,existing.direction,existing.amount,existing.method,existing.reference,existing.occurred_at,existing.actor_id)
 is not distinct from (company,p_settlement_id,p_direction,p_amount,p_method,p_reference,p_occurred_at,auth.uid()) then return existing; end if;
 raise exception using errcode='23505',message='Este pago ya se registró con otro contenido.'; end if;
 select * into s from public.settlements where id=p_settlement_id and company_id=company and cycle_id is not null for update;
 if not found then raise exception using errcode='P0002',message='Rendición no encontrada.'; end if;
 if s.status='closed' then raise exception using errcode='23514',message='La rendición ya está cerrada.'; end if;
 perform 1 from public.operational_cycles where id=s.cycle_id for update;
 snapshot:=public.get_cycle_rendition(s.cycle_id); remaining:=(snapshot->>'remaining')::numeric;
 if remaining is distinct from p_expected_remaining then raise exception using errcode='40001',message='El saldo cambió. Revisa la preliquidación.'; end if;
 if p_direction is distinct from (case when remaining>0 then 'DRIVER_RETURNS' else 'COMPANY_REIMBURSES' end)
 or p_amount is null or p_amount='NaN' or p_amount<=0 or p_amount>abs(remaining) or p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' then
 raise exception using errcode='23514',message='Revisa quién paga, el importe y la fecha real.'; end if;
 insert into public.cycle_balance_payments(id,company_id,settlement_id,direction,amount,method,reference,occurred_at,actor_id)
 values(p_id,company,s.id,p_direction,p_amount,p_method,p_reference,p_occurred_at,auth.uid()) returning * into result;
 perform private.write_audit(company,'CYCLE_BALANCE_PAYMENT_RECORDED','settlement',s.id,null,to_jsonb(result),null);
 return result;
end; $$;

-- No reference text can substitute for an actual settlement payment.
create or replace function public.close_cycle_settlement(p_settlement_id uuid,p_resolution_method text,p_resolution_reference text,p_resolution_note text)
returns public.settlements language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); s public.settlements; result public.settlements; snapshot jsonb; summary public.cycle_rendition_summaries;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 select * into s from public.settlements where id=p_settlement_id and company_id=company and cycle_id is not null for update;
 if not found then raise exception using errcode='P0002',message='Rendición no encontrada.'; end if;
 if s.status='closed' then return s; end if;
 perform 1 from public.operational_cycles where id=s.cycle_id and status='completed' for update;
 if not found then raise exception using errcode='23514',message='Registra el regreso y resuelve los servicios antes del cierre.'; end if;
 if exists(select 1 from public.expenses where cycle_id=s.cycle_id and validation_status in ('pending_review','observed'))
 or exists(select 1 from public.fuel_entries where cycle_id=s.cycle_id and validation_status in ('pending_review','observed')) then
 raise exception using errcode='23514',message='Hay gastos o combustible pendientes de revisión.'; end if;
 select * into summary from public.cycle_rendition_summaries where id=s.id;
 if found and (summary.status<>'approved' or summary.baseline is distinct from private.cycle_financial_baseline(s.cycle_id)
 or not exists(select 1 from public.settlement_evidence where settlement_id=s.id)) then
 raise exception using errcode='23514',message='Aprueba una conciliación actualizada y sincroniza sus hojas antes del cierre.'; end if;
 snapshot:=public.get_cycle_rendition(s.cycle_id);
 if (snapshot->>'remaining')::numeric<>0 then raise exception using errcode='23514',message='Aún hay una diferencia por devolver o reembolsar. Registra el pago real.'; end if;
 insert into public.settlement_expenses(company_id,settlement_id,expense_id,included_by)
 select company,s.id,e.id,auth.uid() from public.expenses e where e.cycle_id=s.cycle_id and e.validation_status='validated'
 on conflict do nothing;
 update public.settlements set status='closed',total_advances=(snapshot->>'total_advances')::numeric,
 total_expenses=(snapshot->>'expense_total')::numeric+(snapshot->>'driver_fuel')::numeric,balance=(snapshot->>'balance')::numeric,
 approved_at=now(),closed_at=now(),approved_by=auth.uid(),resolved_by=auth.uid(),resolved_at=now(),resolved_amount=abs((snapshot->>'balance')::numeric),
 resolution_direction=case when (snapshot->>'balance')::numeric>0 then 'DRIVER_RETURNS' when (snapshot->>'balance')::numeric<0 then 'COMPANY_REIMBURSES' else 'BALANCED' end,
 resolution_method=case when (snapshot->>'balance')::numeric=0 then 'AUTO_BALANCED' else 'RECORDED_PAYMENTS' end,
 resolution_note=p_resolution_note,version=version+1,updated_at=now() where id=s.id returning * into result;
 perform private.write_audit(company,'CYCLE_SETTLEMENT_CLOSED','settlement',s.id,to_jsonb(s),to_jsonb(result),p_resolution_note);
 return result;
end; $$;

create function public.attach_settlement_file(p_entity_type text,p_entity_id uuid,p_file_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id();
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 if p_entity_type<>'settlement' or not exists(select 1 from public.settlements where id=p_entity_id and company_id=company and status<>'closed')
 or not exists(select 1 from public.files where id=p_file_id and company_id=company and uploaded_by=auth.uid()) then
 raise exception using errcode='42501',message='La rendición o el archivo no están disponibles para adjuntar.'; end if;
 insert into public.settlement_evidence(id,company_id,settlement_id,file_id,uploaded_by)
 values(p_file_id,company,p_entity_id,p_file_id,auth.uid()) on conflict(id) do nothing;
end; $$;

revoke all on function public.get_cycle_rendition(uuid),public.save_cycle_rendition(uuid,jsonb,text,text,integer,text),
 public.review_cycle_fuel(uuid,public.validation_status,numeric,timestamptz,text),
 public.record_cycle_balance_payment(uuid,uuid,text,numeric,text,text,timestamptz,numeric),public.attach_settlement_file(text,uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.get_cycle_rendition(uuid),public.save_cycle_rendition(uuid,jsonb,text,text,integer,text),
 public.review_cycle_fuel(uuid,public.validation_status,numeric,timestamptz,text),
 public.record_cycle_balance_payment(uuid,uuid,text,numeric,text,text,timestamptz,numeric),public.attach_settlement_file(text,uuid,uuid)
 to authenticated;

create function public.apply_rendition_command(p_id uuid,p_kind text,p_payload text,p_contract_version integer,p_dependency_id uuid,p_source_device_id text)
returns public.operation_commands language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); body jsonb:=p_payload::jsonb; existing public.operation_commands; result public.operation_commands;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 if p_id is null or p_kind is distinct from 'rendition' or p_contract_version is distinct from 1 or p_dependency_id is distinct from (body->>'cycle_id')::uuid
 or (body->>'occurred_at')::timestamptz is null then raise exception using errcode='23514',message='Comando de rendición no válido.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text||':operation:'||p_id::text,0));
 select * into existing from public.operation_commands where id=p_id;
 if found then
 if (existing.company_id,existing.actor_id,existing.kind,existing.payload::jsonb,existing.contract_version,existing.dependency_id,existing.source_device_id)
 is not distinct from (company,auth.uid(),p_kind,body,p_contract_version,p_dependency_id,p_source_device_id) then return existing; end if;
 raise exception using errcode='23505',message='Este registro ya se confirmó con otro contenido.'; end if;
 if not exists(select 1 from public.settlements where id=(body->>'settlement_id')::uuid and company_id=company and cycle_id=p_dependency_id) then
 raise exception using errcode='23514',message='La rendición no corresponde a esta salida.'; end if;
 perform public.save_cycle_rendition((body->>'settlement_id')::uuid,body->'lines',body->>'baseline','draft',(body->>'expected_version')::integer,body->>'reason');
 insert into public.operation_commands(id,company_id,actor_id,kind,payload,contract_version,dependency_id,source_device_id,result_id)
 values(p_id,company,auth.uid(),p_kind,body::text,1,p_dependency_id,p_source_device_id,(body->>'settlement_id')::uuid) returning * into result;
 return result;
end; $$;

create or replace function public.get_cycle_settlement_snapshot(p_cycle_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snapshot jsonb:=public.get_cycle_rendition(p_cycle_id);
begin
 return jsonb_build_object('cycle_id',p_cycle_id,'advances',snapshot->'total_advances','expenses',snapshot->'expense_total',
 'fuel_driver_fund',snapshot->'driver_fuel','fuel_company',snapshot->'company_fuel',
 'driver_fund_spent',(snapshot->>'expense_total')::numeric+(snapshot->>'driver_fuel')::numeric,
 'balance',snapshot->'remaining','original_balance',snapshot->'balance');
end; $$;
revoke all on function public.apply_rendition_command(uuid,text,text,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.apply_rendition_command(uuid,text,text,integer,uuid,text) to authenticated;
CREATE OR REPLACE FUNCTION public.review_expense(expense_id uuid, validation_status validation_status, approved_amount numeric, note text DEFAULT NULL::text)
 RETURNS expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.expenses;
  new_row public.expenses;
  settlement_status public.settlement_status;
  discovered_trip_id uuid;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 not in ('validated','observed','rejected') then
    raise exception using errcode = '23514', message = 'Unsupported expense review decision';
  end if;
  if $2 <> 'validated' and $3 is not null then
    raise exception using errcode = '23514', message = 'Only a validated expense can have an approved amount';
  end if;

  -- Discover the trip without locking the expense, then take the same leading
  -- settlement lock used by close/reopen to keep the lock order deterministic.
  select * into old_row
  from public.expenses e
  where e.id = $1 and e.company_id = current_company_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Expense not found';
  end if;
  discovered_trip_id := old_row.trip_id;

  if discovered_trip_id is not null then
    select s.status into settlement_status
    from public.settlements s
    where s.company_id = current_company_id and s.trip_id = discovered_trip_id
    for update;
    if found and settlement_status = 'closed' then
      raise exception using
        errcode = '55000',
        message = 'Expenses cannot be reviewed while their settlement is closed';
    end if;
  end if;

  select * into old_row
  from public.expenses e
  where e.id = $1 and e.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Expense not found';
  end if;
  if old_row.trip_id is distinct from discovered_trip_id then
    raise exception using
      errcode = '40001',
      message = 'Expense scope changed concurrently; retry the review';
  end if;
  if $2 = 'validated' and ($3 is null or $3 = 'NaN' or $3 < 0 or $3 > old_row.amount) then
    raise exception using
      errcode = '23514',
      message = 'Approved amount must be within the submitted expense amount';
  end if;

  if old_row.cycle_id is not null and ($2 <> 'validated' or $3 is distinct from old_row.amount or old_row.validation_status='validated') and nullif(trim($4),'') is null then
    raise exception using errcode='23514',message='Indica el motivo de la observación o corrección.';
  end if;
  update public.expenses e
  set validation_status = $2,
      approved_amount = $3,
      updated_at = now()
  where e.id = $1 and e.company_id = current_company_id
  returning * into new_row;

  perform private.write_audit(
    current_company_id, 'EXPENSE_REVIEWED', 'expense', $1,
    to_jsonb(old_row), to_jsonb(new_row), nullif(trim($4), '')
  );
  return new_row;
end;
$function$;
