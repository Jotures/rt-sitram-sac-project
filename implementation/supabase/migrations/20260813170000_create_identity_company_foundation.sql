-- Production identity and company foundation.
-- Supabase Auth remains the sole authority for credentials and identity.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum (
  'management',
  'administration',
  'driver',
  'accounting'
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_legal_name_not_blank check (length(trim(legal_name)) > 0),
  constraint companies_trade_name_not_blank check (trade_name is null or length(trim(trade_name)) > 0),
  constraint companies_tax_id_not_blank check (tax_id is null or length(trim(tax_id)) > 0),
  constraint companies_legal_name_unique unique (legal_name),
  constraint companies_tax_id_unique unique (tax_id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  display_name text not null,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint profiles_company_id_id_unique unique (company_id, id)
);

create index profiles_company_id_idx on public.profiles (company_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.company_id
  from public.profiles as profile
  join public.companies as company on company.id = profile.company_id
  where profile.id = (select auth.uid())
    and profile.active
    and company.active
$$;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  join public.companies as company on company.id = profile.company_id
  where profile.id = (select auth.uid())
    and profile.active
    and company.active
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('management', 'administration'), false)
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.current_company_id() from public;
revoke all on function private.current_app_role() from public;
revoke all on function private.is_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_staff() to authenticated;

alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.companies to authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.companies to service_role;
grant all on table public.profiles to service_role;

create policy companies_select_own
  on public.companies for select to authenticated
  using (id = (select private.current_company_id()));

create policy profiles_select_allowed
  on public.profiles for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (id = (select auth.uid()) or (select private.is_staff()))
  );

comment on table public.companies is 'Company security boundary; created only through administrative provisioning.';
comment on table public.profiles is 'One product profile per Supabase Auth user; credentials remain in auth.users.';
comment on function private.current_company_id() is 'Returns the active authenticated user company without client input.';
comment on function private.current_app_role() is 'Returns the active authenticated user role without recursive RLS.';

-- Controlled development company. The generated ID is resolved by legal_name;
-- application code never embeds it.
insert into public.companies (legal_name, trade_name)
values ('R&T SITRAM SAC', 'R&T SITRAM')
on conflict (legal_name) do nothing;
