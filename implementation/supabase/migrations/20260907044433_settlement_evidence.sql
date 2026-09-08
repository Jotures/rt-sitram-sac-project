-- Settlement sheets are private evidence linked to the authoritative settlement.
-- OCR is intentionally excluded; the file remains an auditable source document.
create table public.settlement_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  settlement_id uuid not null,
  file_id uuid not null,
  evidence_kind text not null default 'expense_sheet'
    check (evidence_kind in ('expense_sheet', 'fuel_sheet', 'other')),
  caption text,
  captured_at timestamptz not null default now(),
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  constraint settlement_evidence_settlement_fk
    foreign key (company_id, settlement_id)
    references public.settlements (company_id, id) on delete restrict,
  constraint settlement_evidence_file_fk
    foreign key (company_id, file_id)
    references public.files (company_id, id) on delete restrict,
  constraint settlement_evidence_actor_fk
    foreign key (company_id, uploaded_by)
    references public.profiles (company_id, id) on delete restrict,
  constraint settlement_evidence_company_id_id_unique unique (company_id, id)
);

create index settlement_evidence_settlement_idx
  on public.settlement_evidence (company_id, settlement_id, captured_at desc);

alter table public.settlement_evidence enable row level security;

revoke all on table public.settlement_evidence from public, anon, service_role;
grant select, insert on table public.settlement_evidence to authenticated;

create policy settlement_evidence_staff_select
  on public.settlement_evidence for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (select private.is_staff())
  );

create policy settlement_evidence_staff_insert
  on public.settlement_evidence for insert to authenticated
  with check (
    company_id = (select private.current_company_id())
    and uploaded_by = (select auth.uid())
    and (select private.is_staff())
  );

create policy settlement_evidence_driver_select
  on public.settlement_evidence for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and exists (
      select 1
      from public.settlements s
      where s.company_id = settlement_evidence.company_id
        and s.id = settlement_evidence.settlement_id
        and (
          (s.trip_id is not null and (select private.can_access_trip(s.trip_id)))
          or (s.cycle_id is not null and (select private.can_access_operational_cycle(s.cycle_id)))
        )
    )
  );

comment on table public.settlement_evidence is
  'Private photographs or PDF sheets attached to a trip or operational-cycle settlement; OCR is not implied.';
