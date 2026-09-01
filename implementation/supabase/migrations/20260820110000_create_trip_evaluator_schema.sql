-- Persisted, versioned commercial estimates. These rows describe assumptions
-- before accepting a load; they never create financial facts or trips.

create type public.trip_evaluation_margin_basis as enum ('REVENUE', 'COST');
create type public.trip_evaluation_tax_basis as enum ('INCLUDED', 'EXCLUDED');
create type public.trip_evaluation_scenario as enum ('CONSERVATIVE', 'PROBABLE', 'FAVORABLE');
create type public.trip_evaluation_status as enum ('DRAFT', 'EXCEPTION_REQUIRED', 'FIXED');
create type public.trip_evaluation_exception_status as enum ('PENDING', 'APPROVED');

create table public.trip_evaluation_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  policy_key text not null check (length(trim(policy_key)) > 0),
  name text not null check (length(trim(name)) > 0),
  version integer not null check (version > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  margin_basis public.trip_evaluation_margin_basis not null,
  tax_basis public.trip_evaluation_tax_basis not null,
  tax_rate numeric(9,6) not null check (tax_rate >= 0 and tax_rate < 1),
  minimum_margin_rate numeric(9,6) not null check (minimum_margin_rate >= 0 and minimum_margin_rate < 1),
  target_margin_rate numeric(9,6) not null check (target_margin_rate >= 0 and target_margin_rate < 1),
  cost_coverage jsonb not null check (jsonb_typeof(cost_coverage) = 'object'),
  active boolean not null default true,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_evaluation_policies_company_id_id_unique unique (company_id, id),
  constraint trip_evaluation_policies_company_key_version_unique unique (company_id, policy_key, version),
  constraint trip_evaluation_policies_margin_order check (target_margin_rate >= minimum_margin_rate),
  constraint trip_evaluation_policies_effective_window check (
    effective_to is null or effective_to > effective_from
  ),
  constraint trip_evaluation_policies_actor_fk foreign key (company_id, created_by)
    references public.profiles (company_id, id) on delete restrict
);

create index trip_evaluation_policies_available_idx
  on public.trip_evaluation_policies (company_id, active, effective_from desc);
create unique index trip_evaluation_policies_one_active_per_company
  on public.trip_evaluation_policies (company_id)
  where active;

create table public.trip_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  policy_id uuid not null,
  policy_version integer not null check (policy_version > 0),
  policy_snapshot jsonb not null check (jsonb_typeof(policy_snapshot) = 'object'),
  client_id uuid,
  vehicle_id uuid,
  reference text,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  status public.trip_evaluation_status not null default 'DRAFT',
  version integer not null default 1 check (version > 0),
  supersedes_evaluation_id uuid,
  fixed_by uuid,
  fixed_at timestamptz,
  created_by uuid not null,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_evaluations_company_id_id_unique unique (company_id, id),
  constraint trip_evaluations_policy_fk foreign key (company_id, policy_id)
    references public.trip_evaluation_policies (company_id, id) on delete restrict,
  constraint trip_evaluations_client_fk foreign key (company_id, client_id)
    references public.clients (company_id, id) on delete restrict,
  constraint trip_evaluations_vehicle_fk foreign key (company_id, vehicle_id)
    references public.vehicles (company_id, id) on delete restrict,
  constraint trip_evaluations_supersedes_fk foreign key (company_id, supersedes_evaluation_id)
    references public.trip_evaluations (company_id, id) on delete restrict,
  constraint trip_evaluations_created_by_fk foreign key (company_id, created_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint trip_evaluations_fixed_by_fk foreign key (company_id, fixed_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint trip_evaluations_reference_not_blank check (
    reference is null or length(trim(reference)) > 0
  ),
  constraint trip_evaluations_fixed_metadata check (
    (status = 'FIXED' and fixed_at is not null and fixed_by is not null)
    or (status <> 'FIXED' and fixed_at is null and fixed_by is null)
  )
);

create unique index trip_evaluations_company_idempotency_key_unique
  on public.trip_evaluations (company_id, idempotency_key)
  where idempotency_key is not null;
create index trip_evaluations_company_updated_idx
  on public.trip_evaluations (company_id, updated_at desc);
create index trip_evaluations_company_status_idx
  on public.trip_evaluations (company_id, status, updated_at desc);

create table public.trip_evaluation_exceptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  evaluation_id uuid not null,
  status public.trip_evaluation_exception_status not null default 'PENDING',
  policy_snapshot jsonb not null check (jsonb_typeof(policy_snapshot) = 'object'),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  approval_reason text,
  constraint trip_evaluation_exceptions_company_id_id_unique unique (company_id, id),
  constraint trip_evaluation_exceptions_evaluation_unique unique (company_id, evaluation_id),
  constraint trip_evaluation_exceptions_evaluation_fk foreign key (company_id, evaluation_id)
    references public.trip_evaluations (company_id, id) on delete restrict,
  constraint trip_evaluation_exceptions_requested_by_fk foreign key (company_id, requested_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint trip_evaluation_exceptions_approved_by_fk foreign key (company_id, approved_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint trip_evaluation_exceptions_approval_metadata check (
    (status = 'APPROVED' and approved_by is not null and approved_at is not null
      and length(trim(coalesce(approval_reason, ''))) > 0)
    or (status = 'PENDING' and approved_by is null and approved_at is null and approval_reason is null)
  )
);

create index trip_evaluation_exceptions_company_status_idx
  on public.trip_evaluation_exceptions (company_id, status, requested_at desc);

create trigger trip_evaluation_policies_set_updated_at
  before update on public.trip_evaluation_policies
  for each row execute function private.set_updated_at();

create trigger trip_evaluations_set_updated_at
  before update on public.trip_evaluations
  for each row execute function private.set_updated_at();

comment on table public.trip_evaluation_policies is
  'Immutable, management-published versions of commercial estimation policy.';
comment on table public.trip_evaluations is
  'Commercial estimate snapshots; not an operational or financial record.';
comment on table public.trip_evaluation_exceptions is
  'Management approvals for fixed estimates below the policy minimum.';
