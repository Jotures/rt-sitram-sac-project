-- Retain the P2 command contract while removing an unused local so the
-- production schema passes the strict function lint gate.

create or replace function public.record_work_order_part(
  p_id uuid,
  p_work_order_id uuid,
  p_part_id uuid,
  p_supplier_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_installed_at timestamptz,
  p_installation_odometer_km numeric,
  p_notes text,
  p_idempotency_key uuid
)
returns public.work_order_parts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  existing_row public.work_order_parts;
  work_order_row public.work_orders;
  result public.work_order_parts;
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Part record and idempotency IDs are required';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0
     or p_quantity <> round(p_quantity, 3) then
    raise exception using errcode = '23514', message = 'Part quantity must be positive and use at most three decimals';
  end if;
  if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0
     or p_unit_cost <> round(p_unit_cost, 4) then
    raise exception using errcode = '23514', message = 'Part unit cost must be non-negative and use at most four decimals';
  end if;
  if p_installation_odometer_km is not null
     and (p_installation_odometer_km = 'NaN'::numeric
       or p_installation_odometer_km < 0
       or p_installation_odometer_km <> round(p_installation_odometer_km, 2)) then
    raise exception using errcode = '23514', message = 'Part installation odometer must be non-negative and use at most two decimals';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':work-order-part:' || p_idempotency_key::text, 0)
  );
  select * into existing_row
  from public.work_order_parts p
  where p.company_id = current_company_id and p.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.id is distinct from p_id
       or existing_row.work_order_id is distinct from p_work_order_id
       or existing_row.part_id is distinct from p_part_id
       or existing_row.supplier_id is distinct from p_supplier_id
       or existing_row.quantity is distinct from p_quantity::numeric(14,3)
       or existing_row.unit_cost is distinct from p_unit_cost::numeric(14,4)
       or existing_row.installed_at is distinct from p_installed_at
       or existing_row.installation_odometer_km is distinct from p_installation_odometer_km::numeric(14,2)
       or existing_row.notes is distinct from normalized_notes then
      raise exception using errcode = '23505', message = 'Part idempotency key belongs to another request';
    end if;
    return existing_row;
  end if;

  -- Lock the order before a part is inserted. complete_work_order takes the
  -- same lock before it totals lines, so closing and recording cannot race.
  select * into work_order_row
  from public.work_orders w
  where w.company_id = current_company_id and w.id = p_work_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;
  if work_order_row.status in ('finished', 'cancelled') then
    raise exception using errcode = '23514', message = 'Finished or cancelled work order cannot receive parts';
  end if;
  if not exists (
    select 1
    from public.parts p
    where p.company_id = current_company_id and p.id = p_part_id and p.active
  ) then
    raise exception using errcode = '23514', message = 'Part is not active in this company';
  end if;
  if p_supplier_id is not null and not exists (
    select 1
    from public.suppliers s
    where s.company_id = current_company_id and s.id = p_supplier_id and s.active
  ) then
    raise exception using errcode = '23514', message = 'Part supplier is not active in this company';
  end if;

  insert into public.work_order_parts (
    id, company_id, work_order_id, part_id, supplier_id, quantity, unit_cost,
    installed_at, installation_odometer_km, notes, idempotency_key
  ) values (
    p_id, current_company_id, p_work_order_id, p_part_id, p_supplier_id, p_quantity,
    p_unit_cost, p_installed_at, p_installation_odometer_km, normalized_notes,
    p_idempotency_key
  )
  returning * into result;

  -- The closing command owns the global parts_cost. It may be a manual total
  -- only while no lines exist; otherwise it must equal this line-item total.
  perform private.write_audit(
    current_company_id,
    'WORK_ORDER_PART_RECORDED',
    'work_order_part',
    result.id,
    null,
    to_jsonb(result)
  );
  return result;
end;
$$;
