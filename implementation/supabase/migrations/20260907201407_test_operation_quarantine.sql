-- Explicit owner instruction: RT-2026-0001 and its S/800 are a test, never a real repayment.
alter table public.trips add column is_test boolean not null default false;
alter table public.advances add column is_test boolean not null default false;
do $$
declare t public.trips; previous public.trips; a public.advances; changed public.advances;
 reason text:='Prueba identificada y retiro del circuito real autorizado por el propietario en SESSION-20260828-011. Migración de sistema; no representa devolución de efectivo ni regreso físico.';
begin
 select * into t from public.trips where id='27141748-5bd5-4859-9726-493aec327130' and code='RT-2026-0001' for update;
 if not found then return; end if;
 if t.is_test then return; end if;
 if exists(select 1 from public.invoices where trip_id=t.id) or exists(select 1 from public.expenses where trip_id=t.id)
 or exists(select 1 from public.fuel_entries where trip_id=t.id)
 or (select coalesce(sum(amount),0) from public.advances where trip_id=t.id)<>800 then
 raise exception 'La prueba cambió desde el inventario. Revisar antes de excluirla.'; end if;
 previous:=t;
 update public.trips set is_test=true,operational_status='cancelled',version=version+1,updated_at=now() where id=t.id returning * into t;
 perform private.write_audit(t.company_id,'TEST_OPERATION_QUARANTINED','trip',t.id,to_jsonb(previous),to_jsonb(t),reason);
 for a in select * from public.advances where trip_id=t.id for update loop
 update public.advances set is_test=true,status='cancelled' where id=a.id returning * into changed;
 perform private.write_audit(a.company_id,'TEST_FUND_QUARANTINED','advance',a.id,to_jsonb(a),to_jsonb(changed),reason);
 end loop;
 if not exists(select 1 from public.trips where company_id=t.company_id and vehicle_id=t.vehicle_id and operational_status in ('scheduled','loading','in_transit','unloading'))
 and not exists(select 1 from public.operational_cycles where company_id=t.company_id and vehicle_id=t.vehicle_id and status in ('planned','active')) then
 update public.vehicles set current_status='available' where id=t.vehicle_id and company_id=t.company_id;
 end if;
 if not exists(select 1 from public.trips where company_id=t.company_id and driver_id=t.driver_id and operational_status in ('scheduled','loading','in_transit','unloading'))
 and not exists(select 1 from public.operational_cycles where company_id=t.company_id and primary_driver_id=t.driver_id and status in ('planned','active')) then
 update public.drivers set current_status='available' where id=t.driver_id and company_id=t.company_id;
 end if;
end; $$;
