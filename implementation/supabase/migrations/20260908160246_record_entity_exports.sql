-- Per-record exports retain the audit requirement of DEC-041.
create function public.record_entity_export(p_entity_type text, p_entity_id uuid, p_format text, p_generated_at timestamptz, p_digest text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare company uuid := private.current_company_id(); export_id uuid := gen_random_uuid(); allowed boolean := false;
begin
  perform private.assert_role(array['management','administration','accounting']::public.app_role[]);
  if p_format is null or p_format not in ('pdf','xlsx') or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_generated_at is null then
    raise exception using errcode='22023', message='Formato o referencia de exportación inválidos.';
  end if;
  if p_entity_type = 'trip' then
    select exists(select 1 from public.trips where id=p_entity_id and company_id=company and not is_test and operational_status <> 'cancelled') into allowed;
  elsif p_entity_type in ('cycle','cycle_settlement') then
    select exists(select 1 from public.operational_cycles where id=p_entity_id and company_id=company and status <> 'cancelled') into allowed;
  elsif p_entity_type = 'settlement' then
    select exists(select 1 from public.settlements s join public.trips t on t.id=s.trip_id and t.company_id=s.company_id
      where s.id=p_entity_id and s.company_id=company and s.cycle_id is null and not t.is_test and t.operational_status <> 'cancelled') into allowed;
  end if;
  if not allowed then raise exception using errcode='42501', message='El registro no está disponible para exportación.'; end if;
  perform private.write_audit(company, 'REPORT_EXPORTED', p_entity_type, p_entity_id, null,
    jsonb_build_object('export_id',export_id,'format',p_format,'generated_at',p_generated_at,'sha256',p_digest));
  return export_id;
end; $$;
revoke all on function public.record_entity_export(text,uuid,text,timestamptz,text) from public, anon, service_role;
grant execute on function public.record_entity_export(text,uuid,text,timestamptz,text) to authenticated;
