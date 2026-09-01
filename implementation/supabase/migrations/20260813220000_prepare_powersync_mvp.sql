-- PowerSync reads the publication with BYPASSRLS; Sync Streams must enforce
-- identity/company/driver filtering. Uploads still pass through RPC/RLS.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'companies','profiles','clients','suppliers','expense_categories','routes','vehicles','drivers','vehicle_status_history',
    'driver_availability','operational_cycles','trips','trip_status_events','loads','odometer_entries','incidents','advances',
    'expenses','fuel_entries','settlements','settlement_expenses','maintenance_plans','work_orders','parts','work_order_parts',
    'files','documents','invoices','payments','alerts'
  ] loop
    execute format('grant select on table public.%I to powersync_role', table_name);
    if not exists (
      select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication powersync add table public.%I', table_name);
    end if;
  end loop;
end
$$;

comment on publication powersync is 'R&T source publication; per-user authorization is mandatory in deployed Sync Streams.';
