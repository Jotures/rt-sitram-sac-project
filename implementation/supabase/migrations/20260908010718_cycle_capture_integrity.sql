CREATE OR REPLACE FUNCTION public.record_cycle_expense(p_id uuid, p_cycle_id uuid, p_driver_id uuid, p_category_id uuid, p_incurred_at timestamp with time zone, p_amount numeric, p_currency character, p_receipt_type text, p_receipt_number text, p_receipt_file_id uuid, p_description text, p_idempotency_key uuid)
 RETURNS expenses
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  result public.expenses;
  cycle_row public.operational_cycles;
  normalized_currency char(3) := upper(p_currency::text)::char(3);
normalized_description text := nullif(trim(coalesce(p_description, '')), '');
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_cycle_id is null or p_driver_id is null or p_category_id is null or p_amount is null or p_amount <= 0 or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Cycle, driver, category, positive amount and idempotency key are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':cycle-expense:' || p_idempotency_key::text, 0));
  select * into result from public.expenses e where e.company_id = current_company_id and e.idempotency_key = p_idempotency_key;
  if found then
 if (result.id,result.cycle_id,result.driver_id,result.category_id,result.incurred_at,result.amount,result.currency,result.description,result.created_by)
 is distinct from (p_id,p_cycle_id,p_driver_id,p_category_id,coalesce(p_incurred_at,result.incurred_at),p_amount,normalized_currency,normalized_description,auth.uid()) then
 raise exception using errcode='23505',message='El gasto ya fue recibido con otros datos.'; end if;
 return result; end if;
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then raise exception using errcode = '23514', message = 'Expense driver must be the cycle driver'; end if;
  if not private.is_staff() and p_driver_id is distinct from private.current_driver_id() then raise exception using errcode = '42501', message = 'Driver can only record activity for the authenticated cycle'; end if;
  if not exists (select 1 from public.expense_categories ec where ec.company_id = current_company_id and ec.id = p_category_id and ec.active) then raise exception using errcode = '23514', message = 'Expense category is not active in this company'; end if;
  insert into public.expenses (id, company_id, assignment_type, trip_id, cycle_id, vehicle_id, driver_id, category_id, incurred_at, amount, currency, receipt_type, receipt_number, receipt_file_id, description, source, validation_status, created_by, idempotency_key)
  values (p_id, current_company_id, 'trip', null, p_cycle_id, cycle_row.vehicle_id, p_driver_id, p_category_id, coalesce(p_incurred_at, now()), p_amount, normalized_currency, nullif(trim(coalesce(p_receipt_type, '')), ''), nullif(trim(coalesce(p_receipt_number, '')), ''), p_receipt_file_id, normalized_description, case when private.is_staff() then 'office_quick' else 'driver_mobile' end, 'pending_review', auth.uid(), p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id, 'CYCLE_EXPENSE_RECORDED', 'expense', result.id, null, to_jsonb(result), null);
  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.record_cycle_fuel_entry(p_id uuid, p_cycle_id uuid, p_driver_id uuid, p_fueled_at timestamp with time zone, p_location text, p_odometer_km numeric, p_quantity numeric, p_volume_unit text, p_unit_price numeric, p_total_amount numeric, p_currency character, p_payment_source text, p_payment_method text, p_supplier_id uuid, p_receipt_type text, p_receipt_number text, p_receipt_file_id uuid, p_idempotency_key uuid)
 RETURNS fuel_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  result public.fuel_entries;
  cycle_row public.operational_cycles;
  normalized_currency char(3) := upper(p_currency::text)::char(3);
  normalized_source text := lower(trim(coalesce(p_payment_source, '')));
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_cycle_id is null or p_driver_id is null or p_quantity is null or p_quantity <= 0 or p_unit_price is null or p_unit_price < 0 or p_total_amount is null or p_total_amount <= 0 or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Cycle, driver, positive fuel amounts and idempotency key are required';
  end if;
  if normalized_source not in ('company', 'driver_fund') then raise exception using errcode = '23514', message = 'Fuel payment source must be company or driver_fund'; end if;
  if p_odometer_km is not null and (p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric) then raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative'; end if;
  if abs(p_total_amount - round((p_quantity * p_unit_price)::numeric, 2)) > 0.05 then raise exception using errcode = '23514', message = 'Fuel total does not match quantity and unit price'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':cycle-fuel:' || p_idempotency_key::text, 0));
  select * into result from public.fuel_entries f where f.company_id = current_company_id and f.idempotency_key = p_idempotency_key;
  if found then
 if (result.id,result.cycle_id,result.driver_id,result.fueled_at,result.odometer_km,result.quantity,result.volume_unit,result.unit_price,result.total_amount,result.payment_source,result.created_by)
 is distinct from (p_id,p_cycle_id,p_driver_id,coalesce(p_fueled_at,result.fueled_at),p_odometer_km,p_quantity,p_volume_unit,p_unit_price,p_total_amount,normalized_source,auth.uid()) then
 raise exception using errcode='23505',message='El abastecimiento ya fue recibido con otros datos.'; end if;
 return result; end if;
  select * into cycle_row from public.operational_cycles c where c.company_id = current_company_id and c.id = p_cycle_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Operational cycle not found'; end if;
  if cycle_row.primary_driver_id is distinct from p_driver_id then raise exception using errcode = '23514', message = 'Fuel driver must be the cycle driver'; end if;
  if not private.is_staff() and p_driver_id is distinct from private.current_driver_id() then raise exception using errcode = '42501', message = 'Driver can only record activity for the authenticated cycle'; end if;
  insert into public.fuel_entries (id, company_id, trip_id, cycle_id, vehicle_id, driver_id, supplier_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, payment_source, payment_method, receipt_type, receipt_number, receipt_file_id, validation_status, created_by, idempotency_key)
  values (p_id, current_company_id, null, p_cycle_id, cycle_row.vehicle_id, p_driver_id, p_supplier_id, coalesce(p_fueled_at, now()), nullif(trim(coalesce(p_location, '')), ''), p_odometer_km, p_quantity, p_volume_unit, p_unit_price, p_total_amount, normalized_currency, normalized_source, nullif(trim(coalesce(p_payment_method, '')), ''), nullif(trim(coalesce(p_receipt_type, '')), ''), nullif(trim(coalesce(p_receipt_number, '')), ''), p_receipt_file_id, 'pending_review', auth.uid(), p_idempotency_key)
  returning * into result;
  if p_odometer_km is not null then
   insert into public.odometer_entries(company_id,vehicle_id,reading_km,reading_at,reading_type,source,recorded_by,idempotency_key)
   values(current_company_id,cycle_row.vehicle_id,p_odometer_km,result.fueled_at,'fuel',case when private.current_app_role()='driver' then 'driver_app' else 'manual' end,auth.uid(),p_idempotency_key);
  end if;
  perform private.write_audit(current_company_id, 'CYCLE_FUEL_RECORDED', 'fuel_entry', result.id, null, to_jsonb(result), null);
  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.apply_operation_command(p_id uuid, p_kind text, p_payload text, p_contract_version integer, p_dependency_id uuid, p_source_device_id text)
 RETURNS operation_commands
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  company uuid := private.current_company_id(); actor uuid := auth.uid();
  body jsonb := p_payload::jsonb; existing public.operation_commands; result public.operation_commands;
  c public.operational_cycles; old_cycle public.operational_cycles; t public.trips; old_trip public.trips;
  at_time timestamptz := (body->>'occurred_at')::timestamptz; result_id uuid;
  advance_data jsonb; fuel_data jsonb; service_data jsonb;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if private.current_app_role()='driver' and p_kind not in ('expense','fuel') then
    raise exception using errcode='42501',message='Esta acción corresponde a oficina.';
  end if;
  if p_id is null or p_contract_version is distinct from 1 or jsonb_typeof(body) is distinct from 'object' or at_time is null then
    raise exception using errcode='23514', message='La operación necesita identificador, fecha y una versión compatible.';
  end if;
  if at_time > now()+interval '5 minutes' and not (p_kind='departure' and body->>'status'='planned') then
    raise exception using errcode='23514', message='La fecha del hecho no puede estar en el futuro.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(company::text||':operation:'||p_id::text,0));
  select * into existing from public.operation_commands where id=p_id;
  if found then
    if existing.company_id=company and existing.actor_id=actor and existing.kind=p_kind and existing.payload::jsonb=body
      and existing.contract_version=p_contract_version and existing.dependency_id is not distinct from p_dependency_id
      and existing.source_device_id is not distinct from p_source_device_id then return existing; end if;
    raise exception using errcode='23505', message='Este identificador ya se confirmó con otro contenido.';
  end if;
  if p_kind='departure' then
    if p_dependency_id is not null then raise exception using errcode='23514',message='Una salida no depende de otra salida.'; end if;
    select * into c from public.create_quick_operational_cycle(p_id,(body->>'vehicle_id')::uuid,(body->>'driver_id')::uuid,
      at_time,(body->>'status')::public.operational_cycle_status,body->>'notes',p_id);
    if coalesce(body->>'capture_channel','office') not in ('office','driver_app') then raise exception using errcode='23514',message='Canal de captura no válido.'; end if;
    if body->>'capture_channel'='driver_app' and not exists(select 1 from public.drivers d join public.profiles p on p.id=d.profile_id and p.company_id=d.company_id
      where d.id=c.primary_driver_id and d.company_id=company and p.active and p.role='driver') then
      raise exception using errcode='23514',message='El conductor necesita una cuenta activa para capturar desde la aplicación.';
    end if;
    update public.operational_cycles set scheduled_at=at_time,capture_channel=coalesce(body->>'capture_channel','office') where id=c.id returning * into c;
    perform set_config('rt.initial_cycle_bundle',c.id::text,true);
    advance_data:=body->'advance'; fuel_data:=body->'fuel'; service_data:=body->'service';
    if advance_data is not null and advance_data<>'null'::jsonb then
      if exists(select 1 from public.advances where id=(advance_data->>'id')::uuid or idempotency_key=(advance_data->>'id')::uuid) then
        raise exception using errcode='23505',message='La entrega inicial ya pertenece a otra operación.';
      end if;
      perform public.issue_cycle_advance((advance_data->>'id')::uuid,c.id,c.primary_driver_id,at_time,
        (advance_data->>'amount')::numeric,advance_data->>'method',null,(advance_data->>'id')::uuid);
    end if;
    if service_data is not null and service_data<>'null'::jsonb then
      perform private.create_cycle_service(c,service_data,at_time,c.status='active');
    end if;
    result_id:=c.id;
  else
    if p_dependency_id is distinct from (body->>'cycle_id')::uuid then
      raise exception using errcode='23514',message='La dependencia del movimiento no coincide con su salida.';
    end if;
    select * into c from public.operational_cycles where id=p_dependency_id and company_id=company for update;
    if not found then raise exception using errcode='P0001',message='Primero debe confirmarse la salida. El movimiento debe conservarse para su recuperación.'; end if;
    if c.status='cancelled' then raise exception using errcode='23514',message='La salida está anulada.'; end if;
    old_cycle:=c;
    result_id:=c.id;
    if p_kind='service' then
      result_id:=private.create_cycle_service(c,body,at_time,c.status='active');
    elsif p_kind='advance' then
      perform public.issue_cycle_advance(p_id,c.id,c.primary_driver_id,at_time,(body->>'amount')::numeric,body->>'method',body->>'description',p_id);
      result_id:=p_id;
    elsif p_kind='expense' then
      if exists(select 1 from public.expense_categories e where e.id=(body->>'category_id')::uuid and e.company_id=company
        and e.code='OTHER' and nullif(trim(body->>'description'),'') is null) then
        raise exception using errcode='23514',message='Describe qué incluye Otros gastos.';
      end if;
      perform public.record_cycle_expense(p_id,c.id,c.primary_driver_id,(body->>'category_id')::uuid,at_time,
        (body->>'amount')::numeric,'PEN',null,null,null,body->>'description',p_id);
      result_id:=p_id;
    elsif p_kind='fuel' then
      if (body->>'id')::uuid is distinct from p_id then raise exception using errcode='23514',message='El identificador del abastecimiento no coincide.'; end if;
      fuel_data:=body; result_id:=p_id;
    elsif p_kind='start' then
      if c.status<>'planned' then raise exception using errcode='23514',message='La salida ya no está programada.'; end if;
      update public.operational_cycles set status='active',started_at=at_time,version=version+1,updated_at=now() where id=c.id returning * into c;
      insert into public.trip_status_events(company_id,trip_id,dimension,previous_status,new_status,occurred_at,actor_id)
      select company,id,'operational',operational_status::text,'in_transit',at_time,actor from public.trips where cycle_id=c.id and company_id=company and operational_status in ('scheduled','loading');
      update public.trips set operational_status='in_transit',started_at=at_time,version=version+1,updated_at=now()
        where cycle_id=c.id and company_id=company and operational_status in ('scheduled','loading');
      perform private.write_audit(company,'CYCLE_STARTED','operational_cycle',c.id,to_jsonb(old_cycle),to_jsonb(c),null);
    elsif p_kind='return' then
      if c.status<>'active' or c.returned_at is not null or at_time<c.started_at then
        raise exception using errcode='23514',message='Revisa el estado y la fecha del regreso de esta salida.';
      end if;
      update public.operational_cycles set returned_at=at_time,return_status='completed',version=version+1,updated_at=now() where id=c.id returning * into c;
      perform private.write_audit(company,'CYCLE_RETURNED_TO_CUSCO','operational_cycle',c.id,to_jsonb(old_cycle),to_jsonb(c),null);
    elsif p_kind='service_complete' then
      select * into t from public.trips where id=(body->>'trip_id')::uuid and company_id=company and cycle_id=c.id for update;
      if not found or t.operational_status not in ('in_transit','unloading') or body->>'cargo_delivered'<>'true' or at_time<t.started_at or (c.returned_at is not null and at_time>c.returned_at) then
        raise exception using errcode='23514',message='Confirma la entrega y la fecha real del servicio activo.';
      end if;
      old_trip:=t;
      update public.trips set operational_status='completed',operational_finished_at=at_time,version=version+1,updated_at=now()
        where id=t.id returning * into t;
      insert into public.trip_status_events(company_id,trip_id,dimension,previous_status,new_status,occurred_at,actor_id)
        values(company,t.id,'operational',old_trip.operational_status::text,'completed',at_time,actor);
      perform private.write_audit(company,'QUICK_SERVICE_DELIVERED','trip',t.id,to_jsonb(old_trip),to_jsonb(t),null);
      result_id:=t.id;
    else raise exception using errcode='23514',message='Tipo de operación no compatible.';
    end if;
  end if;
  if fuel_data is not null and fuel_data<>'null'::jsonb then
    if exists(select 1 from public.fuel_entries where id=(fuel_data->>'id')::uuid or idempotency_key=(fuel_data->>'id')::uuid) then
      raise exception using errcode='23505',message='El abastecimiento ya pertenece a otra operación.';
    end if;
    perform public.record_cycle_fuel_entry((fuel_data->>'id')::uuid,c.id,c.primary_driver_id,at_time,null,
      (fuel_data->>'odometer_km')::numeric,(fuel_data->>'quantity')::numeric,fuel_data->>'volume_unit',
      (fuel_data->>'unit_price')::numeric,(fuel_data->>'total_amount')::numeric,'PEN',fuel_data->>'payment_source',
      null,null,null,null,null,(fuel_data->>'id')::uuid);
  end if;
  perform set_config('rt.initial_cycle_bundle','',true);
  if c.status='active' and c.returned_at is not null and not exists(select 1 from public.trips t2
    where t2.company_id=company and t2.cycle_id=c.id and t2.operational_status not in ('completed','cancelled')) then
    old_cycle:=c;
    update public.operational_cycles set status='completed',ended_at=returned_at,version=version+1,updated_at=now() where id=c.id returning * into c;
    perform private.write_audit(company,'CYCLE_OPERATION_COMPLETED','operational_cycle',c.id,to_jsonb(old_cycle),to_jsonb(c),null);
  end if;
  insert into public.operation_commands(id,company_id,actor_id,kind,payload,contract_version,dependency_id,source_device_id,result_id)
    values(p_id,company,actor,p_kind,body::text,p_contract_version,p_dependency_id,p_source_device_id,result_id) returning * into result;
  perform private.write_audit(company,'OPERATION_COMMAND_CONFIRMED','operation_command',p_id,null,to_jsonb(result),null);
  return result;
end; $function$
;
CREATE OR REPLACE FUNCTION private.guard_cycle_financial_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if tg_op='INSERT' and tg_table_name in ('expenses','fuel_entries') and private.current_app_role()<>'driver' and c.capture_channel='driver_app'
 and current_setting('rt.initial_cycle_bundle',true) is distinct from c.id::text then
 raise exception using errcode='42501',message='El conductor está registrando esta salida. Confirma su dispositivo y cambia el canal antes de capturar desde oficina.'; end if;
 occurred:=coalesce((payload->>'incurred_at')::timestamptz,(payload->>'fueled_at')::timestamptz,(payload->>'delivered_at')::timestamptz);
 if occurred>now()+interval '5 minutes' then raise exception using errcode='23514',message='El movimiento no puede tener una fecha futura.'; end if;
 return new;
end; $function$
;
