-- THIS IS TECHNICAL SPIKE INFRASTRUCTURE.
-- It grants PowerSync read-only replication access exclusively to spike_records.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls login;
  end if;
end
$$;

grant usage on schema public to powersync_role;
grant select on table public.spike_records to powersync_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync for table public.spike_records;
  elsif not exists (
    select 1
    from pg_publication_tables
    where pubname = 'powersync'
      and schemaname = 'public'
      and tablename = 'spike_records'
  ) then
    alter publication powersync add table public.spike_records;
  end if;
end
$$;

comment on role powersync_role is
  'Read-only replication role for the R&T technical PowerSync spike.';
