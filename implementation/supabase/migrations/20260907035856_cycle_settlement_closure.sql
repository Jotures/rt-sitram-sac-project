-- Authoritative closure for a Cusco-Cusco settlement. Trip settlements keep
-- using close_settlement; this function closes only the cycle scope.
create or replace function public.close_cycle_settlement(
  p_settlement_id uuid,
  p_resolution_method text,
  p_resolution_reference text,
  p_resolution_note text
)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  current_actor_id uuid := auth.uid();
  old_settlement public.settlements;
  new_settlement public.settlements;
  cycle_row public.operational_cycles;
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
  fuel_driver_total numeric(14,2);
  calculated_balance numeric(14,2);
  calculated_direction text;
  clean_method text := nullif(trim(coalesce(p_resolution_method, '')), '');
  clean_reference text := nullif(trim(coalesce(p_resolution_reference, '')), '');
  clean_note text := nullif(trim(coalesce(p_resolution_note, '')), '');
  advance_row public.advances;
  new_advance public.advances;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_settlement
  from public.settlements s
  where s.company_id = current_company_id and s.id = p_settlement_id and s.cycle_id is not null
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Cycle settlement not found'; end if;
  if old_settlement.status = 'closed' then return old_settlement; end if;
  if old_settlement.status not in ('pending','under_review','observed','approved') then raise exception using errcode = '23514', message = 'Cycle settlement cannot be closed in its current state'; end if;

  select * into cycle_row
  from public.operational_cycles c
  where c.company_id = current_company_id and c.id = old_settlement.cycle_id
  for update;
  if not found or cycle_row.status <> 'completed' then raise exception using errcode = '23514', message = 'Only a completed operational cycle can have its settlement closed'; end if;
  if exists (
    select 1 from public.expenses e
    where e.company_id = current_company_id and e.cycle_id = old_settlement.cycle_id
      and e.validation_status in ('pending_review','observed')
  ) then raise exception using errcode = '23514', message = 'Pending or observed cycle expenses must be resolved before closing the settlement'; end if;
  if exists (
    select 1 from public.fuel_entries f
    where f.company_id = current_company_id and f.cycle_id = old_settlement.cycle_id
      and f.validation_status in ('pending_review','observed')
  ) then raise exception using errcode = '23514', message = 'Pending or observed cycle fuel must be resolved before closing the settlement'; end if;

  delete from public.settlement_expenses se
  using public.expenses e
  where se.company_id = current_company_id and se.settlement_id = old_settlement.id
    and e.company_id = se.company_id and e.id = se.expense_id and e.validation_status <> 'validated';
  insert into public.settlement_expenses (company_id, settlement_id, expense_id, included_by)
  select current_company_id, old_settlement.id, e.id, current_actor_id
  from public.expenses e
  where e.company_id = current_company_id and e.cycle_id = old_settlement.cycle_id and e.validation_status = 'validated'
  on conflict on constraint settlement_expenses_pkey do nothing;

  select coalesce(sum(a.amount), 0)::numeric(14,2) into advances_total
  from public.advances a where a.company_id = current_company_id and a.cycle_id = old_settlement.cycle_id and a.status <> 'cancelled';
  select coalesce(sum(coalesce(e.approved_amount, e.amount)), 0)::numeric(14,2) into expenses_total
  from public.settlement_expenses se join public.expenses e on e.company_id = se.company_id and e.id = se.expense_id
  where se.company_id = current_company_id and se.settlement_id = old_settlement.id and e.validation_status = 'validated';
  select coalesce(sum(f.total_amount), 0)::numeric(14,2) into fuel_driver_total
  from public.fuel_entries f where f.company_id = current_company_id and f.cycle_id = old_settlement.cycle_id
    and f.payment_source = 'driver_fund' and f.validation_status = 'validated';
  expenses_total := (expenses_total + fuel_driver_total)::numeric(14,2);
  calculated_balance := (advances_total - expenses_total)::numeric(14,2);
  if calculated_balance = 0 then
    calculated_direction := 'BALANCED'; clean_method := 'AUTO_BALANCED'; clean_reference := null;
  elsif clean_method is null or clean_reference is null then
    raise exception using errcode = '23514', message = 'A method and reference are required to resolve a non-zero cycle balance';
  else
    calculated_direction := case when calculated_balance > 0 then 'DRIVER_RETURNS' else 'COMPANY_REIMBURSES' end;
  end if;

  update public.settlements s set total_advances = advances_total, total_expenses = expenses_total,
    balance = calculated_balance, status = 'closed', approved_at = now(), closed_at = now(), approved_by = current_actor_id,
    resolution_method = clean_method, resolution_reference = clean_reference, resolution_note = clean_note,
    resolution_direction = calculated_direction, resolved_amount = abs(calculated_balance), resolved_by = current_actor_id,
    resolved_at = now(), version = s.version + 1, updated_at = now()
  where s.company_id = current_company_id and s.id = old_settlement.id returning * into new_settlement;

  for advance_row in select a.* from public.advances a
    where a.company_id = current_company_id and a.cycle_id = old_settlement.cycle_id and a.status not in ('cancelled','settled') for update
  loop
    update public.advances a set status = 'settled' where a.company_id = current_company_id and a.id = advance_row.id returning * into new_advance;
    perform private.write_audit(current_company_id, 'OPERATING_FUND_SETTLED', 'advance', advance_row.id, to_jsonb(advance_row), to_jsonb(new_advance), format('Cycle settlement %s closed', old_settlement.id));
  end loop;
  perform private.write_audit(current_company_id, 'CYCLE_SETTLEMENT_CLOSED', 'settlement', old_settlement.id, to_jsonb(old_settlement), to_jsonb(new_settlement), clean_note);
  return new_settlement;
end;
$$;

create or replace function public.reopen_cycle_settlement(p_settlement_id uuid, p_reason text)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  old_row public.settlements;
  new_row public.settlements;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if normalized_reason is null then raise exception using errcode = '23514', message = 'A reason is required'; end if;
  select * into old_row from public.settlements s where s.company_id = current_company_id and s.id = p_settlement_id and s.cycle_id is not null for update;
  if not found then raise exception using errcode = 'P0002', message = 'Cycle settlement not found'; end if;
  if old_row.status <> 'closed' then raise exception using errcode = '23514', message = 'Only a closed cycle settlement can be reopened'; end if;
  update public.settlements s set status = 'under_review', approved_at = null, approved_by = null, closed_at = null,
    resolution_method = null, resolution_reference = null, resolution_note = null, resolution_direction = null,
    resolved_amount = null, resolved_by = null, resolved_at = null, version = s.version + 1, updated_at = now()
  where s.company_id = current_company_id and s.id = p_settlement_id returning * into new_row;
  perform private.write_audit(current_company_id, 'CYCLE_SETTLEMENT_REOPENED', 'settlement', old_row.id, to_jsonb(old_row), to_jsonb(new_row), normalized_reason);
  return new_row;
end;
$$;

revoke all on function public.close_cycle_settlement(uuid,text,text,text) from public, anon, service_role;
revoke all on function public.reopen_cycle_settlement(uuid,text) from public, anon, service_role;
grant execute on function public.close_cycle_settlement(uuid,text,text,text) to authenticated;
grant execute on function public.reopen_cycle_settlement(uuid,text) to authenticated;
