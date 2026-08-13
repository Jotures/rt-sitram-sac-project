-- THIS IS TECHNICAL SPIKE DATA.
-- NOT A PRODUCTION DOMAIN CONTRACT.
--
-- This temporary table exists solely to validate the future PowerSync + SQLite
-- technical spike. It must not be repurposed as an R&T business entity.

create table public.spike_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spike_records_value_not_blank check (length(trim(value)) > 0)
);

comment on table public.spike_records is
  'THIS IS TECHNICAL SPIKE DATA. NOT A PRODUCTION DOMAIN CONTRACT.';

alter table public.spike_records enable row level security;

-- Supabase CLI 2.114 defaults to not auto-exposing new public tables.
-- These explicit grants are intentionally limited to authenticated technical users.
grant select, insert, update, delete on table public.spike_records to authenticated;

create policy "technical spike records are selectable by owner"
  on public.spike_records
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "technical spike records are insertable by owner"
  on public.spike_records
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "technical spike records are updatable by owner"
  on public.spike_records
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "technical spike records are deletable by owner"
  on public.spike_records
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);
