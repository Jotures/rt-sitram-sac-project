-- P2 maintenance work orders: preserve the existing flexible maintenance
-- vocabulary while moving operationally relevant creation and progress updates
-- through auditable, company-scoped commands.

alter table public.work_orders
  add column if not exists idempotency_key uuid;

create unique index if not exists work_orders_company_idempotency_key_unique
  on public.work_orders (company_id, idempotency_key)
  where idempotency_key is not null;

-- Work-order status and the scheduling-block flag affect operation. Keep
-- direct staff writes disabled and expose only the narrow commands below.
revoke insert, update on table public.work_orders from authenticated;
drop policy if exists work_orders_staff_insert on public.work_orders;
drop policy if exists work_orders_staff_update on public.work_orders;

create function public.create_work_order(
  p_id uuid,
  p_vehicle_id uuid,
  p_supplier_id uuid,
  p_maintenance_type text,
  p_reported_problem text,
  p_admitted_at timestamptz,
  p_blocks_operation boolean,
  p_notes text,
  p_idempotency_key uuid
)
returns public.work_orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  existing_row public.work_orders;
  result public.work_orders;
  normalized_maintenance_type text := nullif(trim(coalesce(p_maintenance_type, '')), '');
  normalized_problem text := nullif(trim(coalesce(p_reported_problem, '')), '');
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Work order and idempotency IDs are required';
  end if;
  if normalized_maintenance_type is null or normalized_problem is null then
    raise exception using errcode = '23514', message = 'Maintenance type and reported problem are required';
  end if;
  if p_blocks_operation is null then
    raise exception using errcode = '23514', message = 'Work order blocking state is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':work-order:' || p_idempotency_key::text, 0)
  );
  select * into existing_row
  from public.work_orders w
  where w.company_id = current_company_id and w.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.id is distinct from p_id
       or existing_row.vehicle_id is distinct from p_vehicle_id
       or existing_row.supplier_id is distinct from p_supplier_id
       or existing_row.maintenance_type is distinct from normalized_maintenance_type
       or existing_row.reported_problem is distinct from normalized_problem
       or existing_row.admitted_at is distinct from p_admitted_at
       or existing_row.blocks_operation is distinct from p_blocks_operation
       or existing_row.notes is distinct from normalized_notes
       or existing_row.status is distinct from 'scheduled'::public.work_order_status
       or existing_row.source is distinct from 'administration'
       or existing_row.created_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Work order idempotency key belongs to another request';
    end if;
    return existing_row;
  end if;

  if not exists (
    select 1
    from public.vehicles v
    where v.company_id = current_company_id and v.id = p_vehicle_id and v.active
  ) then
    raise exception using errcode = '23514', message = 'Work order vehicle is not active in this company';
  end if;
  if p_supplier_id is not null and not exists (
    select 1
    from public.suppliers s
    where s.company_id = current_company_id and s.id = p_supplier_id and s.active
  ) then
    raise exception using errcode = '23514', message = 'Work order supplier is not active in this company';
  end if;

  insert into public.work_orders (
    id, company_id, code, vehicle_id, supplier_id, maintenance_type, source,
    admitted_at, reported_problem, status, blocks_operation, notes, created_by,
    idempotency_key
  ) values (
    p_id,
    current_company_id,
    'OT-' || to_char(now() at time zone 'UTC', 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    p_vehicle_id,
    p_supplier_id,
    normalized_maintenance_type,
    'administration',
    p_admitted_at,
    normalized_problem,
    'scheduled',
    p_blocks_operation,
    normalized_notes,
    current_actor_id,
    p_idempotency_key
  )
  returning * into result;

  perform private.write_audit(
    current_company_id,
    'WORK_ORDER_CREATED',
    'work_order',
    result.id,
    null,
    to_jsonb(result)
  );
  return result;
end;
$$;

create function public.update_work_order_progress(
  p_work_order_id uuid,
  p_supplier_id uuid,
  p_status public.work_order_status,
  p_admitted_at timestamptz,
  p_started_at timestamptz,
  p_diagnosis text,
  p_work_performed text,
  p_notes text,
  p_blocks_operation boolean
)
returns public.work_orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.work_orders;
  result public.work_orders;
  normalized_diagnosis text := nullif(trim(coalesce(p_diagnosis, '')), '');
  normalized_work_performed text := nullif(trim(coalesce(p_work_performed, '')), '');
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_status is null or p_blocks_operation is null then
    raise exception using errcode = '23514', message = 'Work order status and blocking state are required';
  end if;
  if p_status = 'finished' then
    raise exception using errcode = '23514', message = 'Use complete_work_order to finish a work order';
  end if;
  if p_admitted_at is not null and p_started_at is not null and p_started_at < p_admitted_at then
    raise exception using errcode = '23514', message = 'Work order start cannot precede admission';
  end if;

  select * into old_row
  from public.work_orders w
  where w.company_id = current_company_id and w.id = p_work_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;

  if old_row.supplier_id is not distinct from p_supplier_id
     and old_row.status is not distinct from p_status
     and old_row.admitted_at is not distinct from p_admitted_at
     and old_row.started_at is not distinct from p_started_at
     and old_row.diagnosis is not distinct from normalized_diagnosis
     and old_row.work_performed is not distinct from normalized_work_performed
     and old_row.notes is not distinct from normalized_notes
     and old_row.blocks_operation is not distinct from p_blocks_operation then
    return old_row;
  end if;
  if old_row.status in ('finished', 'cancelled') then
    raise exception using errcode = '23514', message = 'Finished or cancelled work order cannot be changed';
  end if;
  if p_supplier_id is not null and not exists (
    select 1
    from public.suppliers s
    where s.company_id = current_company_id and s.id = p_supplier_id and s.active
  ) then
    raise exception using errcode = '23514', message = 'Work order supplier is not active in this company';
  end if;

  update public.work_orders w
  set supplier_id = p_supplier_id,
      status = p_status,
      admitted_at = p_admitted_at,
      started_at = p_started_at,
      diagnosis = normalized_diagnosis,
      work_performed = normalized_work_performed,
      notes = normalized_notes,
      blocks_operation = p_blocks_operation
  where w.company_id = current_company_id and w.id = p_work_order_id
  returning * into result;

  perform private.write_audit(
    current_company_id,
    'WORK_ORDER_PROGRESS_UPDATED',
    'work_order',
    result.id,
    to_jsonb(old_row),
    to_jsonb(result)
  );
  return result;
end;
$$;

revoke all on function public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_work_order_progress(uuid,uuid,public.work_order_status,timestamptz,timestamptz,text,text,text,boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)
  to authenticated;
grant execute on function public.update_work_order_progress(uuid,uuid,public.work_order_status,timestamptz,timestamptz,text,text,text,boolean)
  to authenticated;
