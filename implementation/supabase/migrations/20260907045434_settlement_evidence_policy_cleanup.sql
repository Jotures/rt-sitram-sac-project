-- Keep one SELECT policy for this table so staff and assigned drivers do not
-- add avoidable duplicate permissive predicates.
drop policy if exists settlement_evidence_staff_select on public.settlement_evidence;
drop policy if exists settlement_evidence_driver_select on public.settlement_evidence;

create policy settlement_evidence_select
  on public.settlement_evidence for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (
      (select private.is_staff())
      or exists (
        select 1
        from public.settlements s
        where s.company_id = settlement_evidence.company_id
          and s.id = settlement_evidence.settlement_id
          and (
            (s.trip_id is not null and (select private.can_access_trip(s.trip_id)))
            or (s.cycle_id is not null and (select private.can_access_operational_cycle(s.cycle_id)))
          )
      )
    )
  );
