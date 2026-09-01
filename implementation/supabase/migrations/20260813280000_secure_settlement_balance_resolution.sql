-- A settlement may close only after every submitted expense has a terminal
-- review decision and any non-zero balance has documented resolution evidence.

alter table public.settlements
  add column resolution_method text,
  add column resolution_reference text,
  add column resolution_note text,
  add column resolution_direction text,
  add column resolved_amount numeric(14,2),
  add column resolved_by uuid,
  add column resolved_at timestamptz,
  add constraint settlements_resolution_direction_check check (
    resolution_direction is null
    or resolution_direction in ('BALANCED', 'DRIVER_RETURNS', 'COMPANY_REIMBURSES')
  ),
  add constraint settlements_resolved_amount_check check (
    resolved_amount is null or resolved_amount >= 0
  ),
  add constraint settlements_resolver_fk foreign key (company_id, resolved_by)
    references public.profiles (company_id, id) on delete restrict;

drop function public.close_settlement(uuid);

create function public.close_settlement(
  settlement_id uuid,
  resolution_method text,
  resolution_reference text,
  resolution_note text
)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_company_id uuid := private.current_company_id();
  actor_id uuid := auth.uid();
  old_settlement public.settlements;
  new_settlement public.settlements;
  trip_row public.trips;
  advances_total numeric(14,2);
  expenses_total numeric(14,2);
  calculated_balance numeric(14,2);
  clean_method text := nullif(trim($2), '');
  clean_reference text := nullif(trim($3), '');
  clean_note text := nullif(trim($4), '');
  calculated_direction text;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);

  select * into old_settlement
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  if old_settlement.status = 'closed' then
    return old_settlement;
  end if;
  if old_settlement.status not in ('pending','under_review','observed','approved') then
    raise exception using errcode = '23514', message = 'Settlement cannot be closed in its current state';
  end if;

  select * into trip_row
  from public.trips t
  where t.id = old_settlement.trip_id and t.company_id = current_company_id
  for update;
  if not found or trip_row.operational_status <> 'completed' or trip_row.operational_finished_at is null then
    raise exception using errcode = '23514', message = 'Only a completed trip can have its settlement closed';
  end if;

  if exists (
    select 1
    from public.expenses e
    where e.company_id = current_company_id
      and e.trip_id = old_settlement.trip_id
      and e.validation_status in ('pending_review','observed')
  ) then
    raise exception using errcode = '23514', message = 'Pending or observed trip expenses must be resolved before closing the settlement';
  end if;

  -- Membership is recalculated authoritatively. Rejected expenses are terminal,
  -- but never form part of the justified total.
  delete from public.settlement_expenses se
  using public.expenses e
  where se.company_id = current_company_id
    and se.settlement_id = old_settlement.id
    and e.company_id = se.company_id
    and e.id = se.expense_id
    and e.validation_status <> 'validated';

  insert into public.settlement_expenses (company_id, settlement_id, expense_id, included_by)
  select current_company_id, old_settlement.id, e.id, actor_id
  from public.expenses e
  where e.company_id = current_company_id
    and e.trip_id = old_settlement.trip_id
    and e.validation_status = 'validated'
  on conflict (company_id, settlement_id, expense_id) do nothing;

  select coalesce(sum(a.amount), 0)::numeric(14,2) into advances_total
  from public.advances a
  where a.company_id = current_company_id
    and a.trip_id = old_settlement.trip_id
    and a.status <> 'cancelled';

  select coalesce(sum(coalesce(e.approved_amount, e.amount)), 0)::numeric(14,2)
    into expenses_total
  from public.settlement_expenses se
  join public.expenses e
    on e.company_id = se.company_id and e.id = se.expense_id
  where se.company_id = current_company_id
    and se.settlement_id = old_settlement.id
    and e.validation_status = 'validated';

  calculated_balance := (advances_total - expenses_total)::numeric(14,2);
  if calculated_balance = 0 then
    calculated_direction := 'BALANCED';
    clean_method := 'AUTO_BALANCED';
    clean_reference := null;
  else
    if clean_method is null or clean_reference is null then
      raise exception using errcode = '23514', message = 'A method and reference are required to resolve a non-zero settlement balance';
    end if;
    calculated_direction := case
      when calculated_balance > 0 then 'DRIVER_RETURNS'
      else 'COMPANY_REIMBURSES'
    end;
  end if;

  update public.settlements s
  set total_advances = advances_total,
      total_expenses = expenses_total,
      balance = calculated_balance,
      status = 'closed',
      approved_at = now(),
      closed_at = now(),
      approved_by = actor_id,
      resolution_method = clean_method,
      resolution_reference = clean_reference,
      resolution_note = clean_note,
      resolution_direction = calculated_direction,
      resolved_amount = abs(calculated_balance),
      resolved_by = actor_id,
      resolved_at = now(),
      version = s.version + 1,
      updated_at = now()
  where s.id = old_settlement.id and s.company_id = current_company_id
  returning * into new_settlement;

  update public.trips t
  set administrative_status = 'settlement_closed',
      version = t.version + 1,
      updated_at = now()
  where t.id = old_settlement.trip_id and t.company_id = current_company_id;

  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, occurred_at, actor_id
  ) values (
    current_company_id, old_settlement.trip_id, 'administrative',
    trip_row.administrative_status::text, 'settlement_closed', now(), actor_id
  );

  perform private.write_audit(
    current_company_id,
    'SETTLEMENT_CLOSED',
    'settlement',
    old_settlement.id,
    to_jsonb(old_settlement),
    to_jsonb(new_settlement),
    clean_note
  );
  return new_settlement;
end;
$$;

create or replace function public.reopen_settlement(settlement_id uuid, reason text)
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
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if length(trim(coalesce($2, ''))) = 0 then
    raise exception using errcode = '23514', message = 'A reason is required';
  end if;
  select * into old_row
  from public.settlements s
  where s.id = $1 and s.company_id = current_company_id
  for update;
  if not found or old_row.status <> 'closed' then
    raise exception using errcode = '23514', message = 'Only a closed settlement can be reopened';
  end if;

  update public.settlements s
  set status = 'under_review',
      approved_at = null,
      approved_by = null,
      closed_at = null,
      resolution_method = null,
      resolution_reference = null,
      resolution_note = null,
      resolution_direction = null,
      resolved_amount = null,
      resolved_by = null,
      resolved_at = null,
      version = s.version + 1,
      updated_at = now()
  where s.id = $1 and s.company_id = current_company_id
  returning * into new_row;

  update public.trips t
  set administrative_status = 'settlement_review',
      version = t.version + 1,
      updated_at = now()
  where t.id = old_row.trip_id and t.company_id = current_company_id;

  insert into public.trip_status_events (
    company_id, trip_id, dimension, previous_status, new_status, occurred_at,
    reason, actor_id
  ) values (
    current_company_id, old_row.trip_id, 'administrative',
    'settlement_closed', 'settlement_review', now(), trim($2), auth.uid()
  );

  perform private.write_audit(
    current_company_id,
    'SETTLEMENT_REOPENED',
    'settlement',
    $1,
    to_jsonb(old_row),
    to_jsonb(new_row),
    trim($2)
  );
  return new_row;
end;
$$;

revoke all on function public.close_settlement(uuid,text,text,text) from public, anon;
grant execute on function public.close_settlement(uuid,text,text,text) to authenticated, service_role;

-- All legacy entry points bypass balance evidence and remain internal-only.
revoke all on function public.close_settlement(uuid,integer) from public, anon, authenticated, service_role;

revoke all on function public.reopen_settlement(uuid,text) from public, anon;
grant execute on function public.reopen_settlement(uuid,text) to authenticated, service_role;
