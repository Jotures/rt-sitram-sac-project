-- A closed settlement freezes every expense on its trip, not only validated
-- expenses copied into settlement_expenses. This closes the rejected ->
-- validated loophole and serializes review against close/reopen.

create or replace function private.prevent_closed_expense_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_status public.settlement_status;
begin
  if old.trip_id is not null then
    select s.status into locked_status
    from public.settlements s
    where s.company_id = old.company_id and s.trip_id = old.trip_id
    for key share;
    if found and locked_status = 'closed' then
      raise exception using
        errcode = '55000',
        message = 'Expense for a closed settlement is immutable';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (new.company_id, new.trip_id) is distinct from (old.company_id, old.trip_id)
     and new.trip_id is not null then
    locked_status := null;
    select s.status into locked_status
    from public.settlements s
    where s.company_id = new.company_id and s.trip_id = new.trip_id
    for key share;
    if found and locked_status = 'closed' then
      raise exception using
        errcode = '55000',
        message = 'Expense cannot be moved into a closed settlement';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.review_expense(
  expense_id uuid,
  validation_status public.validation_status,
  approved_amount numeric,
  note text default null
)
returns public.expenses
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
  if $2 = 'validated' and ($3 is null or $3 < 0 or $3 > old_row.amount) then
    raise exception using
      errcode = '23514',
      message = 'Approved amount must be within the submitted expense amount';
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
$$;

revoke all on function private.prevent_closed_expense_mutation() from public, anon, authenticated, service_role;
revoke all on function public.review_expense(uuid,public.validation_status,numeric,text)
  from public, anon, service_role;
grant execute on function public.review_expense(uuid,public.validation_status,numeric,text)
  to authenticated;
