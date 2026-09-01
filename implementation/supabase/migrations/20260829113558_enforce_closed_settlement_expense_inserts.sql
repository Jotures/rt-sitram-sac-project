-- A closed settlement also blocks new expenses. The existing guard already
-- locks updates and deletes; include inserts so every authenticated write path
-- observes the same financial immutability boundary.

create or replace function private.prevent_closed_expense_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_status public.settlement_status;
  source_company_id uuid;
  source_trip_id uuid;
begin
  if tg_op = 'INSERT' then
    source_company_id := new.company_id;
    source_trip_id := new.trip_id;
  else
    source_company_id := old.company_id;
    source_trip_id := old.trip_id;
  end if;

  if source_trip_id is not null then
    select s.status into locked_status
    from public.settlements s
    where s.company_id = source_company_id
      and s.trip_id = source_trip_id
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
    where s.company_id = new.company_id
      and s.trip_id = new.trip_id
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

drop trigger if exists expenses_closed_guard on public.expenses;

create trigger expenses_closed_guard
before insert or update or delete on public.expenses
for each row execute function private.prevent_closed_expense_mutation();

revoke all on function private.prevent_closed_expense_mutation()
  from public, anon, authenticated, service_role;
