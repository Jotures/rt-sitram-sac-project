-- Deny-by-default Data API permissions and company/role-scoped RLS.

create function private.current_driver_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select d.id from public.drivers d
  where d.company_id = private.current_company_id()
    and d.profile_id = (select auth.uid()) and d.active
$$;

create function private.is_accounting()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_app_role() = 'accounting', false)
$$;

create function private.can_access_trip(target_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.is_staff() or private.is_accounting() then exists (
      select 1 from public.trips t where t.id = target_trip_id and t.company_id = private.current_company_id()
    )
    when private.current_app_role() = 'driver' then exists (
      select 1 from public.trips t
      where t.id = target_trip_id and t.company_id = private.current_company_id() and t.driver_id = private.current_driver_id()
    )
    else false
  end
$$;

create function private.can_write_trip_activity(target_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when private.is_staff() then exists (
      select 1 from public.trips t where t.id = target_trip_id and t.company_id = private.current_company_id()
    )
    when private.current_app_role() = 'driver' then exists (
      select 1 from public.trips t where t.id = target_trip_id and t.company_id = private.current_company_id()
        and t.driver_id = private.current_driver_id() and t.operational_status in ('loading','in_transit','unloading')
    )
    else false
  end
$$;

create function private.enforce_trip_activity_scope()
returns trigger language plpgsql set search_path = '' as $$
declare payload jsonb := to_jsonb(new); target_trip uuid; target_vehicle uuid; target_driver uuid; assigned_vehicle uuid; assigned_driver uuid;
begin
  target_trip := nullif(payload ->> 'trip_id','')::uuid;
  if target_trip is null then return new; end if;
  target_vehicle := nullif(payload ->> 'vehicle_id','')::uuid;
  target_driver := nullif(payload ->> 'driver_id','')::uuid;
  select t.vehicle_id,t.driver_id into assigned_vehicle,assigned_driver from public.trips t where t.company_id = new.company_id and t.id = target_trip;
  if not found then raise exception using errcode = '23503', message = 'Trip does not belong to the row company'; end if;
  if target_vehicle is not null and target_vehicle is distinct from assigned_vehicle then raise exception using errcode = '23514', message = 'Vehicle does not match trip assignment'; end if;
  if target_driver is not null and target_driver is distinct from assigned_driver then raise exception using errcode = '23514', message = 'Driver does not match trip assignment'; end if;
  return new;
end;
$$;

revoke all on function private.current_driver_id() from public;
revoke all on function private.is_accounting() from public;
revoke all on function private.can_access_trip(uuid) from public;
revoke all on function private.can_write_trip_activity(uuid) from public;
revoke all on function private.enforce_trip_activity_scope() from public;
grant execute on function private.current_driver_id() to authenticated;
grant execute on function private.is_accounting() to authenticated;
grant execute on function private.can_access_trip(uuid) to authenticated;
grant execute on function private.can_write_trip_activity(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'audit_events','clients','suppliers','expense_categories','routes','vehicles','drivers','vehicle_status_history',
    'driver_availability','operational_cycles','trips','trip_status_events','loads','files','odometer_entries','incidents',
    'advances','expenses','fuel_entries','settlements','settlement_expenses','maintenance_plans','work_orders','parts',
    'work_order_parts','documents','invoices','payments','alerts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$$;

-- Staff can read company operational data. Accounting receives only its needed
-- financial/document context in a separate policy.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'clients','suppliers','expense_categories','routes','vehicles','drivers','vehicle_status_history','driver_availability',
    'operational_cycles','trips','trip_status_events','loads','files','odometer_entries','incidents','advances','expenses',
    'fuel_entries','settlements','settlement_expenses','maintenance_plans','work_orders','parts','work_order_parts','documents',
    'invoices','payments','alerts'
  ] loop
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select private.current_company_id()) and (select private.is_staff()))', table_name || '_staff_select', table_name);
  end loop;
end
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['clients','trips','files','documents','advances','expenses','fuel_entries','settlements','settlement_expenses','invoices','payments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select private.current_company_id()) and (select private.is_accounting()))', table_name || '_accounting_select', table_name);
  end loop;
end
$$;

grant select on table public.audit_events to authenticated;
create policy audit_management_select on public.audit_events for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.current_app_role()) = 'management');

-- Direct staff CRUD is limited to non-financial masters and editable operational details.
do $$
declare table_name text;
begin
  foreach table_name in array array['clients','suppliers','expense_categories','routes','vehicles','drivers','vehicle_status_history','driver_availability','operational_cycles','loads','maintenance_plans','work_orders','parts','work_order_parts','documents','alerts'] loop
    execute format('grant insert, update on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = (select private.current_company_id()) and (select private.is_staff()))', table_name || '_staff_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = (select private.current_company_id()) and (select private.is_staff())) with check (company_id = (select private.current_company_id()) and (select private.is_staff()))', table_name || '_staff_update', table_name);
  end loop;
end
$$;

-- Trip creation is direct; all status/assignment transitions are RPC-only.
grant insert on table public.trips to authenticated;
create policy trips_staff_insert on public.trips for insert to authenticated
  with check (
    company_id = (select private.current_company_id()) and created_by = (select auth.uid()) and (select private.is_staff())
    and vehicle_id is null and driver_id is null and operational_status = 'draft'
    and administrative_status = 'not_required' and financial_status = 'unbilled' and version = 1
  );

-- Append-style trip money. No authenticated DELETE is granted.
do $$
declare table_name text;
begin
  foreach table_name in array array['advances','expenses','fuel_entries','incidents'] loop
    execute format('grant insert on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = (select private.current_company_id()) and created_by = (select auth.uid()) and (select private.is_staff()))', table_name || '_staff_append', table_name);
  end loop;
end
$$;

grant insert on table public.odometer_entries, public.files to authenticated;
create policy odometer_staff_append on public.odometer_entries for insert to authenticated
  with check (company_id = (select private.current_company_id()) and recorded_by = (select auth.uid()) and (select private.is_staff()));
create policy files_staff_append on public.files for insert to authenticated
  with check (company_id = (select private.current_company_id()) and uploaded_by = (select auth.uid()) and (select private.is_staff()));

grant update on table public.expenses, public.fuel_entries, public.incidents to authenticated;
create policy expenses_staff_update on public.expenses for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()))
  with check (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy fuel_staff_update on public.fuel_entries for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()))
  with check (company_id = (select private.current_company_id()) and (select private.is_staff()));
create policy incidents_staff_update on public.incidents for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.is_staff()))
  with check (company_id = (select private.current_company_id()) and (select private.is_staff()));

grant insert on table public.settlement_expenses, public.invoices to authenticated;
create policy settlement_expenses_staff_insert on public.settlement_expenses for insert to authenticated
  with check (company_id = (select private.current_company_id()) and included_by = (select auth.uid()) and (select private.is_staff()));
create policy invoices_staff_insert on public.invoices for insert to authenticated
  with check (company_id = (select private.current_company_id()) and created_by = (select auth.uid()) and (select private.is_staff()));
grant update on table public.invoices to authenticated;
create policy invoices_staff_update on public.invoices for update to authenticated
  using (company_id = (select private.current_company_id()) and status = 'draft' and (select private.is_staff()))
  with check (company_id = (select private.current_company_id()) and status = 'draft' and (select private.is_staff()));

-- Driver read scope: only the assigned trip and its operational records.
create policy trips_driver_select on public.trips for select to authenticated
  using (company_id = (select private.current_company_id()) and driver_id = (select private.current_driver_id()));

do $$
declare table_name text;
begin
  foreach table_name in array array['trip_status_events','loads','advances','expenses','fuel_entries','settlements','incidents','odometer_entries','documents'] loop
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select private.current_company_id()) and trip_id is not null and (select private.can_access_trip(trip_id)))', table_name || '_driver_trip_select', table_name);
  end loop;
end
$$;

create policy vehicles_driver_select on public.vehicles for select to authenticated
  using (company_id = (select private.current_company_id()) and id in (select t.vehicle_id from public.trips t where t.driver_id = (select private.current_driver_id())));
create policy drivers_self_select on public.drivers for select to authenticated
  using (company_id = (select private.current_company_id()) and id = (select private.current_driver_id()));
create policy clients_driver_select on public.clients for select to authenticated
  using (company_id = (select private.current_company_id()) and id in (select t.client_id from public.trips t where t.driver_id = (select private.current_driver_id())));
create policy expense_categories_driver_select on public.expense_categories for select to authenticated
  using (company_id = (select private.current_company_id()) and active and (select private.current_app_role()) = 'driver');
create policy files_driver_select on public.files for select to authenticated
  using (company_id = (select private.current_company_id()) and uploaded_by = (select auth.uid()));

-- Driver offline-originated writes must belong to the authenticated driver and
-- one of that driver's assigned trips.
create policy expenses_driver_insert on public.expenses for insert to authenticated with check (
  company_id = (select private.current_company_id()) and created_by = (select auth.uid())
  and driver_id = (select private.current_driver_id()) and trip_id is not null and (select private.can_write_trip_activity(trip_id))
  and assignment_type = 'trip' and validation_status = 'pending_review' and idempotency_key is not null
);
create policy fuel_driver_insert on public.fuel_entries for insert to authenticated with check (
  company_id = (select private.current_company_id()) and created_by = (select auth.uid())
  and driver_id = (select private.current_driver_id()) and trip_id is not null and (select private.can_write_trip_activity(trip_id))
  and validation_status = 'pending_review' and idempotency_key is not null
);
create policy incidents_driver_insert on public.incidents for insert to authenticated with check (
  company_id = (select private.current_company_id()) and created_by = (select auth.uid())
  and driver_id = (select private.current_driver_id()) and trip_id is not null and (select private.can_write_trip_activity(trip_id))
  and idempotency_key is not null
);
create policy odometer_driver_insert on public.odometer_entries for insert to authenticated with check (
  company_id = (select private.current_company_id()) and recorded_by = (select auth.uid())
  and trip_id is not null and (select private.can_write_trip_activity(trip_id)) and idempotency_key is not null
);
create policy files_driver_insert on public.files for insert to authenticated with check (
  company_id = (select private.current_company_id()) and uploaded_by = (select auth.uid())
);

-- Audit is append-only and only security-definer commands may write it.
revoke insert, update, delete on table public.audit_events from authenticated;
revoke update, delete on table public.payments, public.settlements, public.settlement_expenses, public.trip_status_events from authenticated;

create trigger expenses_trip_scope before insert or update on public.expenses for each row execute function private.enforce_trip_activity_scope();
create trigger fuel_entries_trip_scope before insert or update on public.fuel_entries for each row execute function private.enforce_trip_activity_scope();
create trigger incidents_trip_scope before insert or update on public.incidents for each row execute function private.enforce_trip_activity_scope();
create trigger odometer_entries_trip_scope before insert or update on public.odometer_entries for each row execute function private.enforce_trip_activity_scope();

create function private.enforce_settlement_expense_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.settlements s join public.expenses e on e.company_id = s.company_id and e.trip_id = s.trip_id
    where s.company_id = new.company_id and s.id = new.settlement_id and e.id = new.expense_id
  ) then raise exception using errcode = '23514', message = 'Settlement and expense must belong to the same trip'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_settlement_expense_scope() from public;
create trigger settlement_expenses_scope before insert or update on public.settlement_expenses for each row execute function private.enforce_settlement_expense_scope();

create function private.prevent_closed_settlement_expense_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare target_company uuid; target_settlement uuid;
begin
  if tg_op = 'DELETE' then target_company := old.company_id; target_settlement := old.settlement_id;
  else target_company := new.company_id; target_settlement := new.settlement_id; end if;
  if exists (select 1 from public.settlements s where s.company_id = target_company and s.id = target_settlement and s.status = 'closed') then
    raise exception using errcode = '55000', message = 'Closed settlement membership is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.prevent_closed_settlement_expense_mutation() from public;
create trigger settlement_expenses_closed_guard before insert or update or delete on public.settlement_expenses for each row execute function private.prevent_closed_settlement_expense_mutation();

create function private.prevent_closed_expense_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.settlement_expenses se join public.settlements s on s.company_id = se.company_id and s.id = se.settlement_id
    where se.company_id = old.company_id and se.expense_id = old.id and s.status = 'closed'
  ) then raise exception using errcode = '55000', message = 'Expense included in a closed settlement is immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.prevent_closed_expense_mutation() from public;
create trigger expenses_closed_guard before update or delete on public.expenses for each row execute function private.prevent_closed_expense_mutation();

create function private.enforce_invoice_trip_client()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.trips t where t.company_id = new.company_id and t.id = new.trip_id and t.client_id = new.client_id) then
    raise exception using errcode = '23514', message = 'Invoice client must match trip client';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_invoice_trip_client() from public;
create trigger invoices_trip_client before insert or update on public.invoices for each row execute function private.enforce_invoice_trip_client();
