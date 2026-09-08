CREATE OR REPLACE FUNCTION public.register_payment(p_payment_id uuid, p_invoice_id uuid, p_paid_at timestamp with time zone, p_amount numeric, p_payment_method text, p_reference text, p_idempotency_key uuid)
 RETURNS payments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  invoice_row public.invoices;
  payment_row public.payments;
  paid_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_payment_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Payment and idempotency IDs are required';
  end if;
  select * into payment_row
  from public.payments p
  where p.company_id = current_company_id and p.idempotency_key = p_idempotency_key;
  if found then
    if (payment_row.id,payment_row.invoice_id,payment_row.paid_at,payment_row.amount,payment_row.payment_method,payment_row.reference,payment_row.created_by)
      is distinct from (p_payment_id,p_invoice_id,p_paid_at,p_amount,p_payment_method,p_reference,auth.uid()) then
      raise exception using errcode='23505',message='El identificador del pago ya se utilizó con otros datos.';
    end if;
    return payment_row;
  end if;
  if p_amount is null or p_amount='NaN' or p_amount <= 0 or p_paid_at is null or p_paid_at>now()+interval '5 minutes' or nullif(trim(p_payment_method),'') is null then
    raise exception using errcode = '23514', message = 'Payment amount must be positive';
  end if;
  select * into invoice_row
  from public.invoices i
  where i.id = p_invoice_id and i.company_id = current_company_id
  for update;
  if not found or invoice_row.status in ('draft','cancelled') then
    raise exception using errcode = '23514', message = 'Invoice cannot receive payments';
  end if;
  select coalesce(sum(p.amount), 0)
  into paid_total
  from public.payments p
  where p.company_id = current_company_id
    and p.invoice_id = p_invoice_id
    and p.cancelled_at is null;
  if paid_total + p_amount > invoice_row.total then
    raise exception using errcode = '23514', message = 'Payment exceeds invoice balance';
  end if;

  insert into public.payments (
    id, company_id, invoice_id, client_id, paid_at, amount, currency,
    payment_method, reference, created_by, idempotency_key
  ) values (
    p_payment_id, current_company_id, p_invoice_id, invoice_row.client_id,
    p_paid_at, p_amount, invoice_row.currency, p_payment_method, p_reference,
    auth.uid(), p_idempotency_key
  ) returning * into payment_row;
  paid_total := paid_total + p_amount;
  update public.invoices i
  set status = case
    when paid_total = i.total then 'paid'::public.invoice_status
    else 'partial'::public.invoice_status
  end
  where i.id = p_invoice_id and i.company_id = current_company_id;
  update public.trips t
  set financial_status = case
        when paid_total = invoice_row.total then 'paid'::public.trip_financial_status
        else 'partially_paid'::public.trip_financial_status
      end,
      version = t.version + 1
  where t.id = invoice_row.trip_id and t.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'PAYMENT_CREATED', 'payment', p_payment_id,
    null, to_jsonb(payment_row)
  );
  return payment_row;
end;
$function$;
create function public.record_commercial_payment(p_payment_id uuid,p_invoice_id uuid,p_paid_at timestamptz,p_amount numeric,p_payment_method text,p_reference text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result public.payments;
begin
 result:=public.register_payment(p_payment_id,p_invoice_id,p_paid_at,p_amount,p_payment_method,p_reference,p_idempotency_key);
 return result.id;
end; $$;
revoke all on function public.record_commercial_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_commercial_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated;
-- Corrections retain the original obligation, payment history and actor.
alter table public.invoices add column version integer not null default 1;
alter table public.payments add column version integer not null default 1;
create trigger invoice_version before update on public.invoices for each row execute function private.increment_cycle_money_version();
create trigger payment_version before update on public.payments for each row execute function private.increment_cycle_money_version();

create function public.correct_commercial_record(p_request_id uuid,p_kind text,p_id uuid,p_expected_version integer,p_values jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); i public.invoices; p public.payments;
 before_row jsonb; body text; existing public.operation_commands; paid numeric; next_total numeric; cancel boolean;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 if p_request_id is null or p_id is null or p_expected_version is null or p_kind not in ('invoice','payment')
 or jsonb_typeof(p_values) is distinct from 'object' or nullif(trim(p_reason),'') is null then
 raise exception using errcode='23514',message='Indica el registro, su versión y el motivo de corrección.'; end if;
 body:=jsonb_build_object('kind',p_kind,'id',p_id,'version',p_expected_version,'values',p_values,'reason',p_reason)::text;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into existing from public.operation_commands where id=p_request_id;
 if found then
  if existing.company_id is distinct from company or existing.actor_id is distinct from auth.uid() or existing.kind<>'commercial_correction' or existing.payload::jsonb is distinct from body::jsonb then
   raise exception using errcode='23505',message='La solicitud ya se utilizó con otros datos.'; end if;
  return existing.result_id;
 end if;
 cancel:=coalesce((p_values->>'cancel')::boolean,false);
 if p_kind='invoice' then
  select * into i from public.invoices where id=p_id and company_id=company for update;
 else
  select * into p from public.payments where id=p_id and company_id=company;
  if not found then raise exception using errcode='P0002',message='Pago no encontrado.'; end if;
  select * into i from public.invoices where id=p.invoice_id and company_id=company for update;
  select * into p from public.payments where id=p_id and company_id=company for update;
 end if;
 if i.id is null then raise exception using errcode='P0002',message='Factura no encontrada.'; end if;
 if i.status='cancelled' then raise exception using errcode='23514',message='La factura está anulada.'; end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=i.id and company_id=company and cancelled_at is null;
 if p_kind='invoice' then
  before_row:=to_jsonb(i);
  if i.version is distinct from p_expected_version then raise exception using errcode='40001',message='La factura cambió. Recarga antes de corregir.'; end if;
  if cancel and paid<>0 then raise exception using errcode='23514',message='La factura tiene cobros vigentes. Resuelve sus pagos antes de anularla; no se borrará el dinero recibido.'; end if;
  if cancel then
   update public.invoices set status='cancelled',updated_at=now() where id=i.id;
  else
   next_total:=(p_values->>'subtotal')::numeric+(p_values->>'tax')::numeric;
   if next_total is null or next_total='NaN' or next_total<=0 or (p_values->>'subtotal')::numeric<0 or (p_values->>'tax')::numeric<0 or next_total<paid then
    raise exception using errcode='23514',message='El total debe ser válido y cubrir los cobros vigentes.'; end if;
   update public.invoices set subtotal=(p_values->>'subtotal')::numeric,tax=(p_values->>'tax')::numeric,total=next_total,updated_at=now() where id=i.id returning * into i;
  end if;
 else
  before_row:=to_jsonb(p);
  if p.version is distinct from p_expected_version then raise exception using errcode='40001',message='El pago cambió. Recarga antes de corregir.'; end if;
  if p.cancelled_at is not null then raise exception using errcode='23514',message='El pago ya está anulado.'; end if;
  if cancel then
   update public.payments set cancelled_at=now(),cancellation_reason=p_reason where id=p.id;
  else
   next_total:=(p_values->>'amount')::numeric;
   if next_total is null or next_total='NaN' or next_total<=0 or paid-p.amount+next_total>i.total then
    raise exception using errcode='23514',message='El pago debe ser positivo y no superar el saldo de la factura.'; end if;
   update public.payments set amount=next_total where id=p.id;
  end if;
 end if;
 select coalesce(sum(amount),0) into paid from public.payments where invoice_id=i.id and company_id=company and cancelled_at is null;
 if not (p_kind='invoice' and cancel) then
  update public.invoices set status=case when paid=0 then 'issued'::public.invoice_status when paid=total then 'paid'::public.invoice_status else 'partial'::public.invoice_status end,updated_at=now() where id=i.id;
 end if;
 update public.trips set financial_status=case when p_kind='invoice' and cancel then 'unbilled'::public.trip_financial_status
 when paid=0 then 'billed'::public.trip_financial_status when paid=i.total then 'paid'::public.trip_financial_status else 'partially_paid'::public.trip_financial_status end,version=version+1 where id=i.trip_id and company_id=company;
 perform private.write_audit(company,case when cancel then 'COMMERCIAL_RECORD_CANCELLED' else 'COMMERCIAL_RECORD_CORRECTED' end,p_kind,p_id,before_row,
 case when p_kind='invoice' then (select to_jsonb(r) from public.invoices r where id=p_id) else (select to_jsonb(r) from public.payments r where id=p_id) end,p_reason);
 insert into public.operation_commands(id,company_id,actor_id,kind,payload,contract_version,status,source_device_id,result_id,confirmed_at)
 values(p_request_id,company,auth.uid(),'commercial_correction',body,1,'confirmed','online',p_id,now());
 return p_id;
end; $$;
revoke all on function public.correct_commercial_record(uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.correct_commercial_record(uuid,text,uuid,integer,jsonb,text) to authenticated;

create function public.get_invoice_accounts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_role(array['management','administration','accounting']::public.app_role[]);
 return coalesce((select jsonb_agg(to_jsonb(r)) from (
 select i.*,c.legal_name client_name,t.code trip_code,coalesce(p.paid,0) paid_amount,
 case when i.status='cancelled' then 0 else i.total-coalesce(p.paid,0) end remaining,
 coalesce(p.rows,'[]'::jsonb) payments
 from public.invoices i join public.clients c on c.id=i.client_id and c.company_id=i.company_id
 join public.trips t on t.id=i.trip_id and t.company_id=i.company_id
 left join lateral (select sum(amount) filter(where cancelled_at is null) paid,jsonb_agg(to_jsonb(p) order by paid_at) rows from public.payments p where p.invoice_id=i.id and p.company_id=i.company_id) p on true
 where i.company_id=private.current_company_id() and not t.is_test order by i.issued_on desc limit 200) r),'[]'::jsonb);
end; $$;
revoke all on function public.get_invoice_accounts() from public,anon,authenticated,service_role;
grant execute on function public.get_invoice_accounts() to authenticated;

create function public.manage_expense_category(p_id uuid,p_name text,p_active boolean,p_expected_updated_at timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare company uuid:=private.current_company_id(); previous public.expense_categories; result public.expense_categories;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 if p_id is null or nullif(trim(p_name),'') is null or p_active is null then raise exception using errcode='23514',message='Indica el nombre de la categoría.'; end if;
 if lower(trim(p_name)) like '%combustible%' or lower(trim(p_name)) in ('diesel','diésel','gasolina') then raise exception using errcode='23514',message='Registra el combustible como abastecimiento para conservar su origen de pago.'; end if;
 select * into previous from public.expense_categories where id=p_id and company_id=company for update;
 if found then
  if previous.updated_at is distinct from p_expected_updated_at then raise exception using errcode='40001',message='La categoría cambió. Recarga antes de corregir.'; end if;
  if nullif(trim(p_reason),'') is null then raise exception using errcode='23514',message='Indica el motivo del cambio.'; end if;
  update public.expense_categories set name=trim(p_name),active=p_active,updated_at=now() where id=p_id returning * into result;
 else
  if p_expected_updated_at is not null then raise exception using errcode='P0002',message='Categoría no encontrada.'; end if;
  insert into public.expense_categories(id,company_id,code,name,active) values(p_id,company,'CAT-'||p_id::text,trim(p_name),p_active) returning * into result;
 end if;
 perform private.write_audit(company,'EXPENSE_CATEGORY_SAVED','expense_category',p_id,to_jsonb(previous),to_jsonb(result),p_reason);
 return p_id;
end; $$;
revoke all on function public.manage_expense_category(uuid,text,boolean,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.manage_expense_category(uuid,text,boolean,timestamptz,text) to authenticated;

create or replace function public.save_cycle_rendition(p_settlement_id uuid,p_lines jsonb,p_baseline text,p_status text,p_expected_version integer,p_reason text)
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
 if coalesce(previous.version,0) is distinct from p_expected_version then raise exception using errcode='40001',message='La hoja cambió. Recarga antes de guardar.'; end if;
 if previous.status='approved' and nullif(trim(p_reason),'') is null then raise exception using errcode='23514',message='Indica el motivo de la corrección.'; end if;
 if p_status is null or p_status not in ('draft','submitted','approved','observed') or jsonb_typeof(p_lines) is distinct from 'array' then
 raise exception using errcode='23514',message='Resumen no válido.'; end if;
 if p_baseline is distinct from private.cycle_financial_baseline(s.cycle_id) then
 raise exception using errcode='40001',message='Hay gastos o combustible nuevos o corregidos. Revisa la conciliación.'; end if;
 if p_status in ('submitted','approved') and not exists(select 1 from public.settlement_evidence where settlement_id=s.id and company_id=company) then
 raise exception using errcode='23514',message='Sincroniza las hojas antes de presentar la rendición.'; end if;
 if p_status='observed' and not exists(select 1 from jsonb_array_elements(p_lines) l where nullif(trim(l->>'description'),'') is not null) then raise exception using errcode='23514',message='Describe la observación en la categoría correspondiente.'; end if;
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
