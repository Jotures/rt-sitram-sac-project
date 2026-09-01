-- P2 maintenance detail: itemized parts and optional private evidence remain
-- explicit records. Evidence supports human review only; it never derives a
-- diagnosis, work performed, a part line, a cost, or an order transition.

alter table public.work_order_parts
  add column if not exists idempotency_key uuid;

create unique index if not exists work_order_parts_company_idempotency_key_unique
  on public.work_order_parts (company_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists work_order_parts_order_idx
  on public.work_order_parts (company_id, work_order_id);

-- Once a part affects a work order, it is recorded through an audited command.
revoke insert, update on table public.work_order_parts from authenticated;
drop policy if exists work_order_parts_staff_insert on public.work_order_parts;
drop policy if exists work_order_parts_staff_update on public.work_order_parts;

create table public.work_order_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  work_order_id uuid not null,
  file_id uuid not null,
  notes text,
  created_by uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint work_order_evidence_order_fk
    foreign key (company_id, work_order_id)
    references public.work_orders (company_id, id) on delete restrict,
  constraint work_order_evidence_file_fk
    foreign key (company_id, file_id)
    references public.files (company_id, id) on delete restrict,
  constraint work_order_evidence_actor_fk
    foreign key (company_id, created_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint work_order_evidence_company_idempotency_unique unique (company_id, idempotency_key),
  constraint work_order_evidence_order_file_unique unique (company_id, work_order_id, file_id),
  constraint work_order_evidence_company_id_id_unique unique (company_id, id)
);

create index work_order_evidence_order_idx
  on public.work_order_evidence (company_id, work_order_id, created_at desc);

alter table public.work_order_evidence enable row level security;
alter table public.work_order_evidence force row level security;
revoke all on table public.work_order_evidence from public, anon, authenticated;
grant all on table public.work_order_evidence to service_role;
grant select on table public.work_order_evidence to authenticated;
create policy work_order_evidence_staff_select
  on public.work_order_evidence for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.is_staff())
  );

create function public.record_work_order_part(
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
  current_actor_id uuid := auth.uid();
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

create function public.attach_work_order_evidence(
  p_id uuid,
  p_work_order_id uuid,
  p_file_id uuid,
  p_notes text,
  p_idempotency_key uuid
)
returns public.work_order_evidence
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  existing_row public.work_order_evidence;
  result public.work_order_evidence;
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  perform private.assert_role(array['management', 'administration']::public.app_role[]);
  if p_id is null or p_file_id is null or p_idempotency_key is null then
    raise exception using errcode = '23514', message = 'Evidence, file, and idempotency IDs are required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_company_id::text || ':work-order-evidence:' || p_idempotency_key::text, 0)
  );
  select * into existing_row
  from public.work_order_evidence e
  where e.company_id = current_company_id and e.idempotency_key = p_idempotency_key;
  if found then
    if existing_row.id is distinct from p_id
       or existing_row.work_order_id is distinct from p_work_order_id
       or existing_row.file_id is distinct from p_file_id
       or existing_row.notes is distinct from normalized_notes
       or existing_row.created_by is distinct from current_actor_id then
      raise exception using errcode = '23505', message = 'Evidence idempotency key belongs to another request';
    end if;
    return existing_row;
  end if;

  if not exists (
    select 1
    from public.work_orders w
    where w.company_id = current_company_id and w.id = p_work_order_id
  ) then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;
  if not exists (
    select 1
    from public.files f
    where f.company_id = current_company_id and f.id = p_file_id
  ) then
    raise exception using errcode = '23514', message = 'Evidence file is not available in this company';
  end if;
  if exists (
    select 1
    from public.work_order_evidence e
    where e.company_id = current_company_id
      and e.work_order_id = p_work_order_id
      and e.file_id = p_file_id
  ) then
    raise exception using errcode = '23505', message = 'Evidence file is already attached to this work order';
  end if;

  -- Evidence is optional and can be attached later for review. It is never
  -- interpreted by this database command or used to alter the work order.
  insert into public.work_order_evidence (
    id, company_id, work_order_id, file_id, notes, created_by, idempotency_key
  ) values (
    p_id, current_company_id, p_work_order_id, p_file_id, normalized_notes,
    current_actor_id, p_idempotency_key
  )
  returning * into result;

  perform private.write_audit(
    current_company_id,
    'WORK_ORDER_EVIDENCE_ATTACHED',
    'work_order_evidence',
    result.id,
    null,
    to_jsonb(result)
  );
  return result;
end;
$$;

-- Preserve the existing GPS-authoritative odometer behavior while adding the
-- accepted money rule. Each registered line is rounded to the two decimal
-- places stored in work_orders.parts_cost before totals are added; a manual
-- global amount remains valid only with no registered part lines.
create or replace function public.complete_work_order(
  work_order_id uuid,
  final_mileage numeric,
  labour_cost numeric,
  parts_cost numeric
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
  new_row public.work_orders;
  vehicle_mileage numeric;
  part_line_count integer;
  recorded_parts_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 is null or $3 is null or $4 is null
    or $2 = 'NaN'::numeric or $3 = 'NaN'::numeric or $4 = 'NaN'::numeric
    or $2 < 0 or $3 < 0 or $4 < 0 then
    raise exception using errcode = '23514', message = 'Mileage and costs must be finite and non-negative';
  end if;
  if $4 <> round($4, 2) then
    raise exception using errcode = '23514', message = 'Parts cost must use at most two decimals';
  end if;
  select * into old_row
  from public.work_orders w
  where w.id = $1 and w.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Work order not found';
  end if;
  if old_row.status = 'finished' then
    return old_row;
  end if;
  if old_row.status = 'cancelled' then
    raise exception using errcode = '23514', message = 'Cancelled work order cannot be completed';
  end if;

  -- record_work_order_part locks this order before it inserts. Taking the
  -- order lock above and then these row locks yields a stable line-item total.
  perform 1
  from public.work_order_parts p
  where p.company_id = current_company_id and p.work_order_id = $1
  for update;
  select count(*)::integer,
         coalesce(sum(round(p.quantity * p.unit_cost, 2)), 0)::numeric(14,2)
    into part_line_count, recorded_parts_total
  from public.work_order_parts p
  where p.company_id = current_company_id and p.work_order_id = $1;
  if part_line_count > 0 and $4::numeric(14,2) is distinct from recorded_parts_total then
    raise exception using errcode = '23514',
      message = 'Work order parts cost must equal the sum of registered part lines';
  end if;

  select v.current_odometer_km into vehicle_mileage
  from public.vehicles v
  where v.id = old_row.vehicle_id and v.company_id = current_company_id
  for update;
  if $2 < vehicle_mileage
    and not private.has_gps_odometer_authority(current_company_id, old_row.vehicle_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;

  update public.work_orders w
  set status = 'finished',
      finished_at = coalesce(w.finished_at, now()),
      odometer_km = $2,
      labor_cost = $3,
      parts_cost = $4
  where w.id = $1 and w.company_id = current_company_id
  returning * into new_row;
  update public.vehicles v
  set current_odometer_km = greatest(v.current_odometer_km, $2),
      current_status = 'available'
  where v.id = old_row.vehicle_id and v.company_id = current_company_id;
  perform private.write_audit(
    current_company_id, 'WORK_ORDER_COMPLETED', 'work_order', $1,
    to_jsonb(old_row), to_jsonb(new_row)
  );
  return new_row;
end;
$$;

revoke all on function public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_work_order(uuid,numeric,numeric,numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)
  to authenticated;
grant execute on function public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)
  to authenticated;
grant execute on function public.complete_work_order(uuid,numeric,numeric,numeric)
  to authenticated;
