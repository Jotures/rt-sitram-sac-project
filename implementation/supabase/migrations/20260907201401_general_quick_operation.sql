-- DEC-048: one global presentation preference, one authoritative operational account.
-- Old RPC signatures remain available for clients with pending work.
alter table public.operational_cycles add column scheduled_at timestamptz, add column returned_at timestamptz;
alter table public.operational_cycles add constraint cycle_return_after_start
  check (returned_at is null or (started_at is not null and returned_at >= started_at));

create table public.operation_commands (
  id uuid primary key,
  company_id uuid not null references public.companies(id),
  actor_id uuid not null,
  kind text not null,
  payload text not null check (jsonb_typeof(payload::jsonb) = 'object'),
  contract_version integer not null check (contract_version = 1),
  dependency_id uuid,
  source_device_id text,
  status text not null default 'confirmed' check (status = 'confirmed'),
  result_id uuid not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  foreign key(company_id, actor_id) references public.profiles(company_id,id)
);
alter table public.operation_commands enable row level security;
revoke all on public.operation_commands from public, anon, authenticated;
grant select on public.operation_commands to authenticated;
create policy operation_commands_read on public.operation_commands for select to authenticated
  using (company_id = (select private.current_company_id()) and
    ((select private.current_app_role()) in ('management','administration') or actor_id = (select auth.uid())));
create index operation_commands_company_date on public.operation_commands(company_id,created_at);

-- Reserve resources for a whole outing, not separately for each commercial service.
drop index public.one_active_trip_per_vehicle_idx;
drop index public.one_active_trip_per_driver_idx;
create unique index one_active_trip_per_vehicle_idx on public.trips(company_id,vehicle_id)
  where cycle_id is null and vehicle_id is not null and operational_status in ('scheduled','loading','in_transit','unloading');
create unique index one_active_trip_per_driver_idx on public.trips(company_id,driver_id)
  where cycle_id is null and driver_id is not null and operational_status in ('scheduled','loading','in_transit','unloading');

create function private.assert_cycle_resources(p_company uuid, p_cycle uuid, p_vehicle uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_vehicle is null or p_driver is null then
    raise exception using errcode='23514', message='La salida necesita unidad y conductor responsable.';
  end if;
  perform 1 from public.vehicles v where v.company_id=p_company and v.id=p_vehicle and v.active
    and v.current_status in ('available','scheduled','in_trip','waiting_load','returning_empty') for update;
  if not found then raise exception using errcode='23514', message='La unidad no está disponible para operar.'; end if;
  perform 1 from public.drivers d where d.company_id=p_company and d.id=p_driver and d.active
    and d.current_status in ('available','assigned','in_trip') for update;
  if not found then raise exception using errcode='23514', message='El conductor no está disponible para operar.'; end if;
  if exists (select 1 from public.operational_cycles c where c.company_id=p_company and c.id is distinct from p_cycle
    and c.status in ('planned','active') and (c.vehicle_id=p_vehicle or c.primary_driver_id=p_driver)) then
    raise exception using errcode='23505', message='La unidad o el conductor ya tiene otra salida abierta.';
  end if;
  if exists (select 1 from public.trips t where t.company_id=p_company and t.cycle_id is distinct from p_cycle
    and t.operational_status in ('scheduled','loading','in_transit','unloading') and (t.vehicle_id=p_vehicle or t.driver_id=p_driver)) then
    raise exception using errcode='23505', message='La unidad o el conductor está reservado por otro viaje.';
  end if;
  if exists (select 1 from public.documents d where d.company_id=p_company and d.blocks_operation
    and ((d.entity_type='vehicle' and d.vehicle_id=p_vehicle) or (d.entity_type='driver' and d.driver_id=p_driver))
    and (d.file_id is null or d.status in ('expired','cancelled') or d.expires_on<current_date)) then
    raise exception using errcode='23514', message='Hay un documento obligatorio pendiente o vencido.';
  end if;
  if exists (select 1 from public.work_orders w where w.company_id=p_company and w.vehicle_id=p_vehicle
    and w.blocks_operation and w.status not in ('finished','cancelled')) then
    raise exception using errcode='23514', message='La unidad tiene un mantenimiento que impide la salida.';
  end if;
end; $$;
revoke all on function private.assert_cycle_resources(uuid,uuid,uuid,uuid) from public, anon, authenticated;

create function private.guard_cycle_reservation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.started_at is not null and
    (old.primary_driver_id,old.vehicle_id,old.company_id) is distinct from (new.primary_driver_id,new.vehicle_id,new.company_id) then
    raise exception using errcode='23514', message='No se puede cambiar el responsable o la unidad de una salida iniciada.';
  end if;
  if new.status in ('planned','active') then
    perform private.assert_cycle_resources(new.company_id,new.id,new.vehicle_id,new.primary_driver_id);
  end if;
  return new;
end; $$;
revoke all on function private.guard_cycle_reservation() from public,anon,authenticated;
create trigger cycle_reservation_guard before insert or update of company_id, vehicle_id, primary_driver_id, status
  on public.operational_cycles for each row execute function private.guard_cycle_reservation();

create function private.guard_trip_cycle_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.operational_cycles;
begin
  if new.operational_status not in ('scheduled','loading','in_transit','unloading') then return new; end if;
  perform 1 from public.vehicles v where v.id=new.vehicle_id and v.company_id=new.company_id for update;
  perform 1 from public.drivers d where d.id=new.driver_id and d.company_id=new.company_id for update;
  if new.cycle_id is not null then
    select * into c from public.operational_cycles where id=new.cycle_id and company_id=new.company_id;
    if not found or c.status not in ('planned','active') or
      (c.vehicle_id,c.primary_driver_id) is distinct from (new.vehicle_id,new.driver_id) then
      raise exception using errcode='23514', message='El servicio debe usar la unidad y el conductor de su salida abierta.';
    end if;
  end if;
  if exists (select 1 from public.operational_cycles c2 where c2.company_id=new.company_id
    and c2.id is distinct from new.cycle_id and c2.status in ('planned','active')
    and (c2.vehicle_id=new.vehicle_id or c2.primary_driver_id=new.driver_id)) or exists (
      select 1 from public.trips t where t.company_id=new.company_id and t.id<>new.id
      and (new.cycle_id is null or t.cycle_id is distinct from new.cycle_id)
      and t.operational_status in ('scheduled','loading','in_transit','unloading')
      and (t.vehicle_id=new.vehicle_id or t.driver_id=new.driver_id)) then
    raise exception using errcode='23505', message='La unidad o el conductor está reservado por otra operación.';
  end if;
  return new;
end; $$;
revoke all on function private.guard_trip_cycle_reservation() from public,anon,authenticated;
create trigger trip_cycle_reservation_guard before insert or update of company_id,cycle_id,vehicle_id,driver_id,operational_status
  on public.trips for each row execute function private.guard_trip_cycle_reservation();

create function private.create_cycle_service(p_cycle public.operational_cycles,p_data jsonb,p_at timestamptz,p_start boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.trips; previous_trip public.trips; seq integer;
begin
  if p_cycle.status not in ('planned','active') or p_cycle.returned_at is not null then
    raise exception using errcode='23514', message='No se puede agregar un servicio después del regreso.';
  end if;
  perform private.assert_cycle_resources(p_cycle.company_id,p_cycle.id,p_cycle.vehicle_id,p_cycle.primary_driver_id);
  select * into t from public.create_trip_draft((p_data->>'client_id')::uuid,p_data->>'origin',null,
    p_data->>'destination',p_at,p_data->>'cargo_description',(p_data->>'cargo_tons')::numeric,
    case when (p_data->>'freight_amount') is null then null else 'total'::public.freight_pricing_mode end,
    (p_data->>'freight_amount')::numeric,null);
  perform public.approve_trip(t.id);
  select * into previous_trip from public.trips where id=t.id;
  select coalesce(max(cycle_sequence),0)+1 into seq from public.trips where company_id=p_cycle.company_id and cycle_id=p_cycle.id;
  update public.trips set cycle_id=p_cycle.id,cycle_sequence=seq,
    cycle_leg_kind=(p_data->>'leg_kind')::public.operational_cycle_leg_kind,
    vehicle_id=p_cycle.vehicle_id,driver_id=p_cycle.primary_driver_id,
    capture_mode=case when p_cycle.capture_channel='driver_app' then 'driver_app'::public.trip_capture_mode else 'staff_assisted'::public.trip_capture_mode end,
    capture_mode_changed_at=now(),operational_status=case when p_start then 'in_transit'::public.trip_operational_status else 'scheduled'::public.trip_operational_status end,
    started_at=case when p_start then p_at else null end, version=version+1,updated_at=now()
    where id=t.id returning * into t;
  insert into public.trip_status_events(company_id,trip_id,dimension,previous_status,new_status,occurred_at,actor_id)
    values(t.company_id,t.id,'operational','approved',t.operational_status::text,p_at,auth.uid());
  perform private.write_audit(t.company_id,'QUICK_SERVICE_REGISTERED','trip',t.id,to_jsonb(previous_trip),to_jsonb(t),null);
  return t.id;
end; $$;
revoke all on function private.create_cycle_service(public.operational_cycles,jsonb,timestamptz,boolean) from public,anon,authenticated;

create function public.apply_operation_command(p_id uuid,p_kind text,p_payload text,p_contract_version integer,p_dependency_id uuid,p_source_device_id text)
returns public.operation_commands language plpgsql security definer set search_path='' as $$
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
end; $$;
revoke all on function public.apply_operation_command(uuid,text,text,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.apply_operation_command(uuid,text,text,integer,uuid,text) to authenticated;

insert into public.expense_categories(company_id,code,name,active)
select c.id,x.code,x.name,true from public.companies c cross join (values
  ('VIATICOS','Viáticos'),('PEAJES','Peajes'),('COCHERAS','Cocheras'),('CARGA_DESCARGA','Carga y descarga'),
  ('BALANZA','Balanza'),('UREA','Urea'),('OTHER','Otros gastos')) x(code,name)
where c.active on conflict(company_id,code) do nothing;

-- Mileage is optional in existing office and driver contracts. Provided readings remain validated.
alter table public.trip_load_state_events alter column odometer_km drop not null;
alter table public.trip_transition_requests drop constraint transition_requests_payload;
alter table public.trip_transition_requests add constraint transition_requests_payload check (
 (requested_action='arrive' and odometer_km is null and not cargo_delivered)
 or (requested_action='start' and not cargo_delivered)
 or (requested_action='complete' and cargo_delivered));
CREATE OR REPLACE FUNCTION public.complete_trip(p_trip_id uuid, p_odometer_km numeric, p_expected_version integer, p_idempotency_key uuid, p_cargo_delivered boolean)
 RETURNS trips
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  if p_odometer_km is not null and (p_odometer_km = 'NaN'::numeric or p_odometer_km < 0) then
    raise exception using errcode = '23514', message = 'Trip completion odometer must be finite and non-negative';
  end if;
  if p_cargo_delivered is distinct from true then
    raise exception using errcode = '23514', message = 'Cargo delivery must be confirmed';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'unloading' then
    raise exception using errcode = '40001', message = 'Trip changed or cannot be completed';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) and not private.has_gps_odometer_authority(current_company_id, old_trip.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'completed',
      administrative_status = 'settlement_pending',
      operational_finished_at = now(),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'available',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'available'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  if p_odometer_km is not null then
    insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_finish', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  end if;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values
    (current_company_id, p_trip_id, 'operational', old_trip.operational_status::text, 'completed', auth.uid()),
    (current_company_id, p_trip_id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', auth.uid());
  if old_trip.cycle_id is null then
    insert into public.settlements (company_id, trip_id, driver_id)
  values (current_company_id, p_trip_id, old_trip.driver_id)
  on conflict (company_id, trip_id) do nothing;
  end if;
  perform private.write_audit(
    current_company_id, 'TRIP_COMPLETED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$function$;


CREATE OR REPLACE FUNCTION public.apply_driver_trip_transition(p_request_id uuid, p_trip_id uuid, p_action text, p_odometer_km numeric, p_cargo_delivered boolean, p_occurred_at timestamp with time zone, p_source_device_id text)
 RETURNS trips
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  current_driver_id uuid := private.current_driver_id();
  trip_row public.trips;
  old_trip public.trips;
  existing_request public.trip_transition_requests;
  arrival_at timestamptz;
  current_vehicle_odometer numeric(14,2);
  normalized_device_id text := nullif(trim($7), '');
begin
  perform private.assert_role(array['driver']::public.app_role[]);
  if $1 is null or $2 is null or $6 is null then
    raise exception using errcode = '23514', message = 'Transition ID, trip, and occurrence time are required';
  end if;
  if $4 is not null and ($4 = 'NaN'::numeric or $4 < 0) then
    raise exception using errcode = '23514', message = 'Transition odometer must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':trip-transition:' || $1::text, 0)
  );

  select * into existing_request
  from public.trip_transition_requests r
  where r.id = $1 and r.company_id = current_company_id;
  if found then
    if existing_request.actor_id is distinct from current_actor_id
      or existing_request.trip_id is distinct from $2
      or existing_request.requested_action is distinct from $3
      or existing_request.odometer_km is distinct from $4::numeric(14,2)
      or existing_request.cargo_delivered is distinct from coalesce($5, false)
      or existing_request.occurred_at is distinct from $6
      or existing_request.source_device_id is distinct from normalized_device_id then
      raise exception using errcode = '23505', message = 'Transition ID was already used';
    end if;
    select * into trip_row
    from public.trips t
    where t.id = existing_request.trip_id and t.company_id = current_company_id;
    return trip_row;
  end if;

  if $6 > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.driver_id is distinct from current_driver_id then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  old_trip := trip_row;

  if $3 = 'start' then
    if coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Start requires mileage only';
    end if;
    if trip_row.operational_status not in ('scheduled','loading')
       or trip_row.vehicle_id is null
       or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer
      and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;

    update public.trips t
    set operational_status = 'in_transit',
        started_at = $6,
        version = t.version + case
          when trip_row.operational_status = 'scheduled' then 2
          else 1
        end,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'in_trip',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;

    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values
        (current_company_id, old_trip.id, 'operational', 'scheduled', 'loading', $6, 'Offline driver request', current_actor_id),
        (current_company_id, old_trip.id, 'operational', 'loading', 'in_transit', $6, 'Offline driver request', current_actor_id);
    else
      insert into public.trip_status_events (
        company_id, trip_id, dimension, previous_status, new_status,
        occurred_at, reason, actor_id
      ) values (
        current_company_id, old_trip.id, 'operational', 'loading', 'in_transit',
        $6, 'Offline driver request', current_actor_id
      );
    end if;
    if $4 is not null then
      insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_start', 'command', current_actor_id, normalized_device_id, $1
    );
    end if;
    perform private.write_audit(
      current_company_id, 'TRIP_STARTED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );

  elsif $3 = 'arrive' then
    if $4 is not null or coalesce($5, false) then
      raise exception using errcode = '23514', message = 'Arrival does not accept closure fields';
    end if;
    if trip_row.operational_status <> 'in_transit' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not in transit';
    end if;
    if $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Arrival must occur after trip start';
    end if;
    update public.trips t
    set operational_status = 'unloading',
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values (
      current_company_id, old_trip.id, 'operational', 'in_transit', 'unloading',
      $6, 'Offline driver request', current_actor_id
    );
    perform private.write_audit(
      current_company_id, 'TRIP_ARRIVED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );

  elsif $3 = 'complete' then
    if $5 is distinct from true then
      raise exception using errcode = '23514', message = 'Completion requires final mileage and delivered cargo';
    end if;
    if trip_row.operational_status <> 'unloading' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to complete';
    end if;
    select max(e.occurred_at) into arrival_at
    from public.trip_status_events e
    where e.company_id = current_company_id
      and e.trip_id = trip_row.id
      and e.dimension = 'operational'
      and e.new_status = 'unloading';
    if arrival_at is null or $6 <= arrival_at or $6 <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id
    for update;
    if $4 < current_vehicle_odometer
      and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1
      from public.odometer_entries o
      where o.company_id = current_company_id
        and o.trip_id = trip_row.id
        and o.reading_at > $6
      union all
      select 1
      from public.expenses e
      where e.company_id = current_company_id
        and e.trip_id = trip_row.id
        and e.incurred_at > $6
      union all
      select 1
      from public.fuel_entries f
      where f.company_id = current_company_id
        and f.trip_id = trip_row.id
        and f.fueled_at > $6
      union all
      select 1
      from public.incidents i
      where i.company_id = current_company_id
        and i.trip_id = trip_row.id
        and i.occurred_at > $6
    ) then
      raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity';
    end if;

    update public.trips t
    set operational_status = 'completed',
        administrative_status = 'settlement_pending',
        operational_finished_at = $6,
        version = t.version + 1,
        updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id
    returning * into trip_row;
    update public.vehicles v
    set current_status = 'available',
        current_odometer_km = greatest(v.current_odometer_km, $4)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d
    set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    if $4 is not null then
      insert into public.odometer_entries (
      company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
      source, recorded_by, source_device_id, idempotency_key
    ) values (
      current_company_id, old_trip.vehicle_id, old_trip.id, $4, $6,
      'trip_finish', 'command', current_actor_id, normalized_device_id, $1
    );
    end if;
    insert into public.trip_status_events (
      company_id, trip_id, dimension, previous_status, new_status,
      occurred_at, reason, actor_id
    ) values
      (current_company_id, old_trip.id, 'operational', 'unloading', 'completed', $6, 'Offline driver request', current_actor_id),
      (current_company_id, old_trip.id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', $6, 'Offline driver request', current_actor_id);
    if old_trip.cycle_id is null then
      insert into public.settlements (company_id, trip_id, driver_id, started_at)
    values (current_company_id, old_trip.id, old_trip.driver_id, $6)
    on conflict (company_id, trip_id) do nothing;
    end if;
    perform private.write_audit(
      current_company_id, 'TRIP_COMPLETED', 'trip', old_trip.id,
      to_jsonb(old_trip), to_jsonb(trip_row), 'Offline driver request'
    );
  else
    raise exception using errcode = '22023', message = 'Unsupported transition action';
  end if;

  insert into public.trip_transition_requests (
    id, company_id, trip_id, requested_action, odometer_km,
    cargo_delivered, occurred_at, source_device_id, actor_id, applied_at
  ) values (
    $1, current_company_id, $2, $3, $4, coalesce($5, false), $6,
    normalized_device_id, current_actor_id, now()
  );
  return trip_row;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_fuel_entry(p_id uuid, p_trip_id uuid, p_supplier_id uuid, p_fueled_at timestamp with time zone, p_location text, p_odometer_km numeric, p_quantity numeric, p_volume_unit text, p_unit_price numeric, p_total_amount numeric, p_currency character, p_payment_method text, p_receipt_type text, p_receipt_number text, p_receipt_file_id uuid, p_source_device_id text, p_idempotency_key uuid)
 RETURNS fuel_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.fuel_entries;
  current_driver_id uuid := private.current_driver_id();
  current_vehicle_odometer numeric(14,2);
  normalized_currency char(3) := upper($11::text)::char(3);
begin
  perform private.assert_role(array['driver']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if $6 is not null and ($6 = 'NaN'::numeric or $6 < 0) then
    raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':fuel:' || $17::text, 0)
  );
  select * into result
  from public.fuel_entries f
  where f.company_id = current_company_id and f.idempotency_key = $17;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.supplier_id is distinct from $3
      or result.fueled_at is distinct from $4
      or result.location is distinct from $5
      or result.odometer_km is distinct from $6::numeric(14,2)
      or result.quantity is distinct from $7::numeric(14,3)
      or result.volume_unit is distinct from $8
      or result.unit_price is distinct from $9::numeric(14,4)
      or result.total_amount is distinct from $10::numeric(14,2)
      or result.currency is distinct from normalized_currency
      or result.payment_method is distinct from $12
      or result.receipt_type is distinct from $13
      or result.receipt_number is distinct from $14
      or result.receipt_file_id is distinct from $15
      or result.created_by is distinct from current_actor_id
      or result.source_device_id is distinct from $16 then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;

  if not private.can_write_trip_activity($2) then
    raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope';
  end if;
  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id;
  if trip_row.vehicle_id is null then
    raise exception using errcode = '23514', message = 'Trip has no vehicle';
  end if;
  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $6 < current_vehicle_odometer
    and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, current_driver_id,
    $3, $4, $5, $6, $7, $8, $9, $10, normalized_currency, $12, $13,
    $14, $15, 'pending_review', current_actor_id, $16, $17
  ) returning * into result;
  if $6 is not null then
    insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, source_device_id, idempotency_key
  ) values (
    current_company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'driver_app', current_actor_id, $16, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  end if;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;
  return result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_trip_load_state_event(p_id uuid, p_trip_id uuid, p_load_state trip_load_state, p_effective_at timestamp with time zone, p_odometer_km numeric, p_source_device_id text, p_idempotency_key uuid, p_supersedes_event_id uuid DEFAULT NULL::uuid, p_correction_reason text DEFAULT NULL::text)
 RETURNS trip_load_state_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  trip_row public.trips;
  existing_row public.trip_load_state_events;
  superseded_row public.trip_load_state_events;
  result_row public.trip_load_state_events;
  last_odometer numeric;
  last_effective_at timestamptz;
  normalized_reason text := nullif(trim(coalesce(p_correction_reason, '')), '');
begin
  perform private.assert_role(array['management', 'administration', 'driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_effective_at is null or (p_odometer_km is not null and (p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric)) then
    raise exception using errcode = '23514', message = 'A valid load-state event requires id, timestamp, odometer and idempotency key';
  end if;
  select * into existing_row from public.trip_load_state_events
  where trip_load_state_events.company_id = current_company_id and idempotency_key = p_idempotency_key;
  if found then return existing_row; end if;
  select * into trip_row from public.trips
  where trips.company_id = current_company_id and id = p_trip_id for update;
  if not found or trip_row.vehicle_id is null then
    raise exception using errcode = 'P0002', message = 'Trip with assigned vehicle not found';
  end if;
  if private.current_app_role() = 'driver' then
    if trip_row.driver_id is distinct from private.current_driver_id()
      or trip_row.operational_status not in ('loading', 'in_transit', 'unloading') then
      raise exception using errcode = '42501', message = 'Driver cannot record load state for this trip';
    end if;
    if p_supersedes_event_id is not null then
      raise exception using errcode = '42501', message = 'Only staff can correct a load-state event';
    end if;
  end if;
  if p_supersedes_event_id is not null then
    if normalized_reason is null then
      raise exception using errcode = '23514', message = 'A correction reason is required';
    end if;
    select * into superseded_row from public.trip_load_state_events
    where trip_load_state_events.company_id = current_company_id and id = p_supersedes_event_id and trip_id = p_trip_id;
    if not found or exists (
      select 1 from public.trip_load_state_events later_event
      where later_event.company_id = current_company_id and later_event.supersedes_event_id = p_supersedes_event_id
    ) then
      raise exception using errcode = '23514', message = 'The load-state event cannot be corrected';
    end if;
    if p_odometer_km is distinct from superseded_row.odometer_km or p_effective_at <> superseded_row.effective_at then
      raise exception using errcode = '23514', message = 'A correction must preserve the original odometer and effective time';
    end if;
  else
    if normalized_reason is not null then
      raise exception using errcode = '23514', message = 'A correction reason requires a superseded event';
    end if;
    select e.odometer_km, e.effective_at into last_odometer, last_effective_at
    from public.trip_load_state_events e
    where e.company_id = current_company_id and e.trip_id = p_trip_id
      and not exists (
        select 1 from public.trip_load_state_events correction
        where correction.company_id = e.company_id and correction.supersedes_event_id = e.id
      )
    order by e.effective_at desc, e.created_at desc
    limit 1;
    if p_effective_at < last_effective_at or (p_odometer_km is not null and last_odometer is not null and p_odometer_km <= last_odometer) then
      raise exception using errcode = '23514', message = 'Load-state events must increase odometer and time';
    end if;
  end if;
  if trip_row.started_at is not null and p_effective_at < trip_row.started_at - interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event predates trip start';
  end if;
  if trip_row.operational_finished_at is not null and p_effective_at > trip_row.operational_finished_at + interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event is after trip completion';
  end if;
  insert into public.trip_load_state_events (
    id, company_id, trip_id, vehicle_id, load_state, effective_at, odometer_km,
    recorded_by, source_device_id, idempotency_key, supersedes_event_id, correction_reason
  ) values (
    p_id, current_company_id, p_trip_id, trip_row.vehicle_id, p_load_state, p_effective_at, p_odometer_km,
    actor_id, nullif(trim(coalesce(p_source_device_id, '')), ''), p_idempotency_key,
    p_supersedes_event_id, normalized_reason
  ) returning * into result_row;
  perform private.write_audit(
    current_company_id,
    case when p_supersedes_event_id is null then 'TRIP_LOAD_STATE_RECORDED' else 'TRIP_LOAD_STATE_CORRECTED' end,
    'trip_load_state_event', result_row.id, null, to_jsonb(result_row), normalized_reason
  );
  return result_row;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_staff_trip_load_state(p_id uuid, p_trip_id uuid, p_load_state trip_load_state, p_effective_at timestamp with time zone, p_odometer_km numeric, p_expected_version integer, p_reason text, p_idempotency_key uuid)
 RETURNS trip_load_state_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.trip_load_state_events;
  normalized_reason text := nullif(trim(p_reason), '');
  last_odometer numeric;
  last_effective_at timestamptz;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null or p_expected_version is null or p_effective_at is null
     or (p_odometer_km is not null and (p_odometer_km < 0 or p_odometer_km = 'NaN'::numeric)) or false then
    raise exception using errcode = '23514', message = 'Staff load-state capture needs version, time, mileage, reason and idempotency';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':load-state:' || p_idempotency_key::text, 0));
  select * into result from public.trip_load_state_events e
  where e.company_id = current_company_id and e.idempotency_key = p_idempotency_key;
  if found then
    if result.id is distinct from p_id or result.trip_id is distinct from p_trip_id
       or result.load_state is distinct from p_load_state or result.effective_at is distinct from p_effective_at
       or result.odometer_km is distinct from p_odometer_km::numeric(14,2) or result.recorded_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found or trip_row.vehicle_id is null then raise exception using errcode = 'P0002', message = 'Trip with assigned vehicle not found'; end if;
  if trip_row.version <> p_expected_version then raise exception using errcode = '40001', message = 'Trip changed; refresh before recording load state'; end if;
  if trip_row.capture_mode <> 'staff_assisted' or trip_row.operational_status not in ('loading','in_transit','unloading') then
    raise exception using errcode = '42501', message = 'Office load-state capture requires an active staff-assisted trip';
  end if;
  select e.odometer_km, e.effective_at into last_odometer, last_effective_at
  from public.trip_load_state_events e
  where e.company_id = current_company_id and e.trip_id = p_trip_id
    and not exists (select 1 from public.trip_load_state_events correction where correction.company_id = e.company_id and correction.supersedes_event_id = e.id)
  order by e.effective_at desc, e.created_at desc limit 1;
  if p_effective_at < last_effective_at or (p_odometer_km is not null and last_odometer is not null and p_odometer_km <= last_odometer) then
    raise exception using errcode = '23514', message = 'Load-state events must increase odometer and time';
  end if;
  if trip_row.started_at is not null and p_effective_at < trip_row.started_at - interval '24 hours' then
    raise exception using errcode = '23514', message = 'Load-state event predates trip start';
  end if;
  insert into public.trip_load_state_events (id,company_id,trip_id,vehicle_id,load_state,effective_at,odometer_km,recorded_by,source_device_id,idempotency_key)
  values (p_id,current_company_id,p_trip_id,trip_row.vehicle_id,p_load_state,p_effective_at,p_odometer_km,current_actor_id,null,p_idempotency_key)
  returning * into result;
  perform private.write_audit(current_company_id,'STAFF_TRIP_LOAD_STATE_RECORDED','trip_load_state_event',result.id,null,
    jsonb_build_object('load_state_event',to_jsonb(result),'represented_driver_id',trip_row.driver_id),normalized_reason);
  return result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_staff_trip_transition(p_request_id uuid, p_trip_id uuid, p_action text, p_odometer_km numeric, p_cargo_delivered boolean, p_occurred_at timestamp with time zone, p_load_state trip_load_state, p_expected_version integer, p_reason text)
 RETURNS trips
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  old_trip public.trips;
  existing_request public.trip_transition_requests;
  arrival_at timestamptz;
  current_vehicle_odometer numeric(14,2);
  normalized_reason text := nullif(trim(p_reason), '');
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_request_id is null or p_trip_id is null or p_occurred_at is null or false then
    raise exception using errcode = '23514', message = 'Staff transition needs ID, trip, occurrence time and reason';
  end if;
  if p_occurred_at > now() then
    raise exception using errcode = '22007', message = 'Transition occurrence time cannot be in the future';
  end if;
  if p_odometer_km is not null and (p_odometer_km = 'NaN'::numeric or p_odometer_km < 0) then
    raise exception using errcode = '23514', message = 'Transition odometer must be finite and non-negative';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_company_id::text || ':trip-transition:' || p_request_id::text, 0));
  select * into existing_request from public.trip_transition_requests r
  where r.id = p_request_id and r.company_id = current_company_id;
  if found then
    if existing_request.actor_id is distinct from current_actor_id
       or existing_request.trip_id is distinct from p_trip_id
       or existing_request.requested_action is distinct from p_action
       or existing_request.odometer_km is distinct from p_odometer_km::numeric(14,2)
       or existing_request.cargo_delivered is distinct from coalesce(p_cargo_delivered, false)
       or existing_request.occurred_at is distinct from p_occurred_at then
      raise exception using errcode = '23505', message = 'Transition ID was already used';
    end if;
    select * into trip_row from public.trips t
    where t.id = existing_request.trip_id and t.company_id = current_company_id;
    return trip_row;
  end if;
  select * into trip_row from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Trip changed while recording its operation';
  end if;
  if trip_row.capture_mode <> 'staff_assisted' then
    raise exception using errcode = '42501', message = 'Staff transition requires a staff-assisted trip';
  end if;
  old_trip := trip_row;
  if p_action = 'start' then
    if coalesce(p_cargo_delivered, false) or p_load_state is null then
      raise exception using errcode = '23514', message = 'Start requires mileage and load state';
    end if;
    if trip_row.operational_status not in ('scheduled','loading') or trip_row.vehicle_id is null or trip_row.driver_id is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to start';
    end if;
    select v.current_odometer_km into current_vehicle_odometer
    from public.vehicles v where v.id = trip_row.vehicle_id and v.company_id = current_company_id for update;
    if p_odometer_km < current_vehicle_odometer
       and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    update public.trips t set operational_status = 'in_transit', started_at = p_occurred_at,
      version = t.version + case when trip_row.operational_status = 'scheduled' then 2 else 1 end,
      updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    update public.vehicles v set current_status = 'in_trip', current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d set current_status = 'in_trip'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    if old_trip.operational_status = 'scheduled' then
      insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
      values
        (current_company_id,old_trip.id,'operational','scheduled','loading',p_occurred_at,normalized_reason,current_actor_id),
        (current_company_id,old_trip.id,'operational','loading','in_transit',p_occurred_at,normalized_reason,current_actor_id);
    else
      insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
      values (current_company_id,old_trip.id,'operational','loading','in_transit',p_occurred_at,normalized_reason,current_actor_id);
    end if;
    if p_odometer_km is not null then
      insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.vehicle_id,old_trip.id,p_odometer_km,p_occurred_at,'trip_start','staff_representative',current_actor_id,null,p_request_id);
    end if;
    insert into public.trip_load_state_events (id,company_id,trip_id,vehicle_id,load_state,effective_at,odometer_km,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.id,old_trip.vehicle_id,p_load_state,p_occurred_at,p_odometer_km,current_actor_id,null,p_request_id);
    perform private.write_audit(current_company_id,'STAFF_TRIP_STARTED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  elsif p_action = 'arrive' then
    if p_odometer_km is not null or coalesce(p_cargo_delivered,false) or p_load_state is not null then
      raise exception using errcode = '23514', message = 'Arrival does not accept mileage, delivery or load state';
    end if;
    if trip_row.operational_status <> 'in_transit' or trip_row.started_at is null or p_occurred_at <= trip_row.started_at then
      raise exception using errcode = '23514', message = 'Arrival must follow an active trip start';
    end if;
    update public.trips t set operational_status = 'unloading', version = t.version + 1, updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
    values (current_company_id,old_trip.id,'operational','in_transit','unloading',p_occurred_at,normalized_reason,current_actor_id);
    perform private.write_audit(current_company_id,'STAFF_TRIP_ARRIVED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  elsif p_action = 'complete' then
    if p_cargo_delivered is distinct from true or p_load_state is not null then
      raise exception using errcode = '23514', message = 'Completion requires final mileage and delivered cargo';
    end if;
    if trip_row.operational_status <> 'unloading' or trip_row.started_at is null then
      raise exception using errcode = '23514', message = 'Trip is not ready to complete';
    end if;
    select max(e.occurred_at) into arrival_at from public.trip_status_events e
    where e.company_id = current_company_id and e.trip_id = trip_row.id
      and e.dimension = 'operational' and e.new_status = 'unloading';
    if arrival_at is null or p_occurred_at <= arrival_at or p_occurred_at <= trip_row.started_at then
      raise exception using errcode = '22007', message = 'Completion must occur after arrival';
    end if;
    select v.current_odometer_km into current_vehicle_odometer from public.vehicles v
    where v.id = trip_row.vehicle_id and v.company_id = current_company_id for update;
    if p_odometer_km < current_vehicle_odometer
       and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
      raise exception using errcode = '23514', message = 'Odometer cannot decrease';
    end if;
    if exists (
      select 1 from public.odometer_entries o where o.company_id = current_company_id and o.trip_id = trip_row.id and o.reading_at > p_occurred_at
      union all select 1 from public.expenses e where e.company_id = current_company_id and e.trip_id = trip_row.id and e.incurred_at > p_occurred_at
      union all select 1 from public.fuel_entries f where f.company_id = current_company_id and f.trip_id = trip_row.id and f.fueled_at > p_occurred_at
      union all select 1 from public.incidents i where i.company_id = current_company_id and i.trip_id = trip_row.id and i.occurred_at > p_occurred_at
    ) then raise exception using errcode = '22007', message = 'Completion cannot predate recorded trip activity'; end if;
    update public.trips t set operational_status = 'completed', administrative_status = 'settlement_pending',
      operational_finished_at = p_occurred_at, version = t.version + 1, updated_at = now()
    where t.id = trip_row.id and t.company_id = current_company_id returning * into trip_row;
    update public.vehicles v set current_status = 'available', current_odometer_km = greatest(v.current_odometer_km,p_odometer_km)
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
    update public.drivers d set current_status = 'available'
    where d.id = old_trip.driver_id and d.company_id = current_company_id;
    if p_odometer_km is not null then
      insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (p_request_id,current_company_id,old_trip.vehicle_id,old_trip.id,p_odometer_km,p_occurred_at,'trip_finish','staff_representative',current_actor_id,null,p_request_id);
    end if;
    insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,occurred_at,reason,actor_id)
    values
      (current_company_id,old_trip.id,'operational','unloading','completed',p_occurred_at,normalized_reason,current_actor_id),
      (current_company_id,old_trip.id,'administrative',old_trip.administrative_status::text,'settlement_pending',p_occurred_at,normalized_reason,current_actor_id);
    if old_trip.cycle_id is null then
      insert into public.settlements (company_id,trip_id,driver_id,started_at)
    values (current_company_id,old_trip.id,old_trip.driver_id,p_occurred_at)
    on conflict (company_id,trip_id) do nothing;
    end if;
    perform private.write_audit(current_company_id,'STAFF_TRIP_COMPLETED','trip',old_trip.id,to_jsonb(old_trip),to_jsonb(trip_row),normalized_reason);
  else
    raise exception using errcode = '22023', message = 'Unsupported staff transition action';
  end if;
  insert into public.trip_transition_requests (id,company_id,trip_id,requested_action,odometer_km,cargo_delivered,occurred_at,source_device_id,actor_id,applied_at)
  values (p_request_id,current_company_id,p_trip_id,p_action,p_odometer_km,coalesce(p_cargo_delivered,false),p_occurred_at,null,current_actor_id,now());
  return trip_row;
end;
$function$;


CREATE OR REPLACE FUNCTION public.record_staff_trip_fuel_entry(p_id uuid, p_trip_id uuid, p_supplier_id uuid, p_fueled_at timestamp with time zone, p_location text, p_odometer_km numeric, p_quantity numeric, p_volume_unit text, p_unit_price numeric, p_total_amount numeric, p_currency character, p_payment_method text, p_receipt_type text, p_receipt_number text, p_receipt_file_id uuid, p_reason text, p_idempotency_key uuid)
 RETURNS fuel_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  trip_row public.trips;
  result public.fuel_entries;
  current_vehicle_odometer numeric(14,2);
  normalized_reason text := nullif(trim($16), '');
  normalized_currency char(3) := upper(trim($11::text))::char(3);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $1 is null or $17 is null then
    raise exception using errcode = '23514', message = 'Record and idempotency IDs are required';
  end if;
  if false then
    raise exception using errcode = '23514', message = 'A staff representation reason is required';
  end if;
  if $4 is null then
    raise exception using errcode = '23514', message = 'Fuel occurrence time is required';
  end if;
  if $6 is not null and ($6 = 'NaN'::numeric or $6 < 0) then
    raise exception using errcode = '23514', message = 'Fuel odometer must be finite and non-negative';
  end if;
  if $7 is null or $7 = 'NaN'::numeric or $7 <= 0 then
    raise exception using errcode = '23514', message = 'Fuel quantity must be finite and positive';
  end if;
  if $9 is null or $9 = 'NaN'::numeric or $9 < 0 then
    raise exception using errcode = '23514', message = 'Fuel unit price must be finite and non-negative';
  end if;
  if $10 is null or $10 = 'NaN'::numeric or $10 <= 0 then
    raise exception using errcode = '23514', message = 'Fuel total amount must be finite and positive';
  end if;
  if $8 not in ('gallon','liter') then
    raise exception using errcode = '23514', message = 'Fuel volume unit is invalid';
  end if;
  if coalesce(trim($11::text), '') !~ '^[A-Za-z]{3}$' then
    raise exception using errcode = '23514', message = 'Fuel currency must be a three-letter code';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':fuel:' || $17::text, 0)
  );
  select * into result
  from public.fuel_entries f
  where f.company_id = current_company_id and f.idempotency_key = $17;
  if found then
    if result.id is distinct from $1
      or result.trip_id is distinct from $2
      or result.supplier_id is distinct from $3
      or result.fueled_at is distinct from $4
      or result.location is distinct from $5
      or result.odometer_km is distinct from $6::numeric(14,2)
      or result.quantity is distinct from $7::numeric(14,3)
      or result.volume_unit is distinct from $8
      or result.unit_price is distinct from $9::numeric(14,4)
      or result.total_amount is distinct from $10::numeric(14,2)
      or result.currency is distinct from normalized_currency
      or result.payment_method is distinct from $12
      or result.receipt_type is distinct from $13
      or result.receipt_number is distinct from $14
      or result.receipt_file_id is distinct from $15
      or result.created_by is distinct from current_actor_id
      or not exists (
        select 1
        from public.audit_events a
        where a.company_id = current_company_id
          and a.entity_type = 'fuel_entry'
          and a.entity_id = result.id
          and a.action = 'STAFF_TRIP_FUEL_RECORDED'
          and a.actor_id is not distinct from current_actor_id
          and a.reason is not distinct from normalized_reason
      ) then
      raise exception using errcode = '23505', message = 'Idempotency key was already used';
    end if;
    return result;
  end if;

  select * into trip_row
  from public.trips t
  where t.id = $2 and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if trip_row.operational_status not in ('scheduled','loading','in_transit','unloading','completed') then
    raise exception using errcode = '23514', message = 'Staff fuel registration is allowed only from scheduling through completion';
  end if;
  if trip_row.vehicle_id is null or trip_row.driver_id is null then
    raise exception using errcode = '23514', message = 'Trip needs an assigned vehicle and driver';
  end if;
  if trip_row.operational_status = 'completed'
     and (trip_row.operational_finished_at is null or $4 > trip_row.operational_finished_at) then
    raise exception using errcode = '22007', message = 'Fuel occurrence time cannot be after trip completion';
  end if;

  select v.current_odometer_km into current_vehicle_odometer
  from public.vehicles v
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id
  for update;
  -- A staff registration against a completed trip can represent omitted,
  -- historical evidence. It must not regress the vehicle master, but a lower
  -- historical reading remains valid evidence for the trip.
  if $6 < current_vehicle_odometer
     and trip_row.operational_status <> 'completed'
     and not private.has_gps_odometer_authority(current_company_id, trip_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  insert into public.fuel_entries (
    id, company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at,
    location, odometer_km, quantity, volume_unit, unit_price, total_amount,
    currency, payment_method, receipt_type, receipt_number, receipt_file_id,
    validation_status, created_by, source_device_id, idempotency_key
  ) values (
    $1, current_company_id, $2, trip_row.vehicle_id, trip_row.driver_id,
    $3, $4, $5, $6, $7, $8, $9, $10, normalized_currency, $12, $13,
    $14, $15, 'pending_review', current_actor_id, null, $17
  ) returning * into result;
  if $6 is not null then
    insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, trip_row.vehicle_id, $2, $6, $4, 'fuel',
    'staff_representative', current_actor_id, $17
  ) on conflict (company_id, idempotency_key) do nothing;
  end if;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $6)
  where v.id = trip_row.vehicle_id and v.company_id = current_company_id;

  perform private.write_audit(
    current_company_id,
    'STAFF_TRIP_FUEL_RECORDED',
    'fuel_entry',
    result.id,
    null,
    jsonb_build_object(
      'fuel_entry', to_jsonb(result),
      'represented_driver_id', trip_row.driver_id
    ),
    normalized_reason
  );
  return result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.start_trip(p_trip_id uuid, p_odometer_km numeric, p_expected_version integer, p_idempotency_key uuid)
 RETURNS trips
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_company_id uuid := private.current_company_id();
  old_trip public.trips;
  new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Idempotency ID is required';
  end if;
  if p_odometer_km is not null and (p_odometer_km = 'NaN'::numeric or p_odometer_km < 0) then
    raise exception using errcode = '23514', message = 'Trip start odometer must be finite and non-negative';
  end if;
  select * into old_trip
  from public.trips t
  where t.id = p_trip_id and t.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Trip not found';
  end if;
  if private.current_app_role() = 'driver'
     and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version
     or old_trip.operational_status <> 'loading'
     or old_trip.vehicle_id is null
     or old_trip.driver_id is null then
    raise exception using errcode = '40001', message = 'Trip changed or is not ready to start';
  end if;
  if p_odometer_km < (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = old_trip.vehicle_id and v.company_id = current_company_id
  ) and not private.has_gps_odometer_authority(current_company_id, old_trip.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.trips t
  set operational_status = 'in_transit',
      started_at = coalesce(t.started_at, now()),
      version = t.version + 1
  where t.id = p_trip_id and t.company_id = current_company_id
  returning * into new_trip;
  update public.vehicles v
  set current_status = 'in_trip',
      current_odometer_km = greatest(v.current_odometer_km, p_odometer_km)
  where v.id = old_trip.vehicle_id and v.company_id = current_company_id;
  update public.drivers d
  set current_status = 'in_trip'
  where d.id = old_trip.driver_id and d.company_id = current_company_id;
  if p_odometer_km is not null then
    insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type,
    source, recorded_by, idempotency_key
  ) values (
    current_company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(),
    'trip_start', 'command', auth.uid(), p_idempotency_key
  ) on conflict (company_id, idempotency_key) do nothing;
  end if;
  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, actor_id
  ) values (
    current_company_id, p_trip_id, 'operational', old_trip.operational_status::text,
    new_trip.operational_status::text, auth.uid()
  );
  perform private.write_audit(
    current_company_id, 'TRIP_STARTED', 'trip', p_trip_id,
    to_jsonb(old_trip), to_jsonb(new_trip)
  );
  return new_trip;
end;
$function$;
