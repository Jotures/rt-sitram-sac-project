-- Close a settlement from authoritative trip records. The client supplies only
-- the target ID; it cannot choose which trip expenses are reconciled or assert
-- a stale balance.

create function public.close_settlement(settlement_id uuid)
returns public.settlements
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  settlement_row public.settlements;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);

  select * into settlement_row
  from public.settlements s
  where s.id = $1 and s.company_id = company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Settlement not found';
  end if;
  if settlement_row.status = 'closed' then
    return settlement_row;
  end if;

  -- Every validated expense from the trip belongs to its settlement. Pending,
  -- observed, or rejected expenses must be resolved before financial closure.
  if exists (
    select 1
    from public.expenses e
    where e.company_id = company_id
      and e.trip_id = settlement_row.trip_id
      and e.validation_status in ('pending_review','observed')
  ) then
    raise exception using errcode = '23514', message = 'Pending or observed trip expenses must be resolved before closing the settlement';
  end if;

  insert into public.settlement_expenses (company_id, settlement_id, expense_id, included_by)
  select company_id, settlement_row.id, e.id, auth.uid()
  from public.expenses e
  where e.company_id = company_id
    and e.trip_id = settlement_row.trip_id
    and e.validation_status = 'validated'
  on conflict (company_id, settlement_id, expense_id) do nothing;

  return public.close_settlement(settlement_row.id, settlement_row.version);
end;
$$;

revoke all on function public.close_settlement(uuid) from public;
grant execute on function public.close_settlement(uuid) to authenticated;
grant execute on function public.close_settlement(uuid) to service_role;

-- The versioned primitive is internal-only. The authenticated API must pass
-- through the wrapper above so expense inclusion cannot be bypassed.
revoke all on function public.close_settlement(uuid,integer) from public, authenticated;
grant execute on function public.close_settlement(uuid,integer) to service_role;

-- Remove the UI-oriented balance assertion overload. The versioned internal
-- command remains available for server-side orchestration.
drop function public.close_settlement(uuid,numeric);
