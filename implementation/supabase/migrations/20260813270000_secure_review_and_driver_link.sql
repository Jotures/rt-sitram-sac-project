-- Review decisions and Auth-to-driver linking are audited commands. Direct
-- UPDATE would allow a staff client to rewrite immutable source fields.

create function public.review_expense(
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
  company_id uuid := private.current_company_id();
  old_row public.expenses;
  new_row public.expenses;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 not in ('validated','observed','rejected') then
    raise exception using errcode = '23514', message = 'Unsupported expense review decision';
  end if;
  if $2 = 'validated' and ($3 is null or $3 < 0 or $3 > (select e.amount from public.expenses e where e.id = $1 and e.company_id = company_id)) then
    raise exception using errcode = '23514', message = 'Approved amount must be within the submitted expense amount';
  end if;
  if $2 <> 'validated' and $3 is not null then
    raise exception using errcode = '23514', message = 'Only a validated expense can have an approved amount';
  end if;
  select * into old_row from public.expenses e
  where e.id = $1 and e.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Expense not found'; end if;
  update public.expenses e
  set validation_status = $2, approved_amount = $3, updated_at = now()
  where e.id = $1 and e.company_id = company_id returning * into new_row;
  perform private.write_audit(company_id, 'EXPENSE_REVIEWED', 'expense', $1,
    to_jsonb(old_row), to_jsonb(new_row), nullif(trim($4),''));
  return new_row;
end;
$$;

revoke update on table public.expenses, public.fuel_entries, public.incidents from authenticated;
revoke all on function public.review_expense(uuid,public.validation_status,numeric,text) from public;
grant execute on function public.review_expense(uuid,public.validation_status,numeric,text) to authenticated, service_role;

create function public.link_driver_profile(driver_id uuid, profile_id uuid)
returns public.drivers
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  company_id uuid := private.current_company_id();
  old_row public.drivers;
  new_row public.drivers;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if not exists (
    select 1 from public.profiles p
    where p.id = $2 and p.company_id = company_id and p.active and p.role = 'driver'
  ) then
    raise exception using errcode = '23514', message = 'An active driver profile from this company is required';
  end if;
  if exists (
    select 1 from public.drivers d
    where d.company_id = company_id and d.profile_id = $2 and d.id <> $1
  ) then
    raise exception using errcode = '23505', message = 'Profile is already linked to another driver';
  end if;
  select * into old_row from public.drivers d
  where d.id = $1 and d.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Driver not found'; end if;
  if old_row.profile_id = $2 then return old_row; end if;
  if old_row.profile_id is not null then
    raise exception using errcode = '23505', message = 'Driver is already linked to another profile';
  end if;
  update public.drivers d set profile_id = $2, updated_at = now()
  where d.id = $1 and d.company_id = company_id returning * into new_row;
  perform private.write_audit(company_id, 'DRIVER_PROFILE_LINKED', 'driver', $1,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

revoke update on table public.drivers from authenticated;
revoke all on function public.link_driver_profile(uuid,uuid) from public;
grant execute on function public.link_driver_profile(uuid,uuid) to authenticated, service_role;
