grant select on public.operation_commands,public.cycle_rendition_summaries,public.cycle_balance_payments,public.settlement_evidence to powersync_role;
alter publication powersync add table public.operation_commands,public.cycle_rendition_summaries,public.cycle_balance_payments,public.settlement_evidence;

create function private.increment_cycle_money_version() returns trigger language plpgsql set search_path='' as $$
begin new.version:=old.version+1; return new; end; $$;
revoke all on function private.increment_cycle_money_version() from public,anon,authenticated;
create trigger expense_version before update on public.expenses for each row execute function private.increment_cycle_money_version();
create trigger fuel_version before update on public.fuel_entries for each row execute function private.increment_cycle_money_version();
create trigger advance_version before update on public.advances for each row execute function private.increment_cycle_money_version();

alter table public.operational_cycles add column capture_device_id text,add column capture_acknowledged_at timestamptz,
 add column capture_acknowledged_by uuid,add column capture_acknowledged_device text;
-- Known office origin is derived from the accepted departure envelope, not browser metadata.
update public.operational_cycles c set capture_device_id=o.source_device_id
from public.operation_commands o where o.id=c.id and o.kind='departure' and c.capture_channel='office';

create function private.bind_cycle_command_device() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.operational_cycles; cycle uuid:=case when new.kind='departure' then new.id else new.dependency_id end;
begin
 if cycle is null then return new; end if;
 select * into c from public.operational_cycles where id=cycle and company_id=new.company_id for update;
 if new.kind in ('expense','fuel') then
 if private.current_app_role()='driver' and (c.capture_channel<>'driver_app' or c.primary_driver_id is distinct from private.current_driver_id()) then
 raise exception using errcode='42501',message='Oficina está registrando esta salida.'; end if;
 if private.current_app_role()<>'driver' and c.capture_channel<>'office' then
 raise exception using errcode='42501',message='El conductor está registrando esta salida. Cambia el canal después de confirmar su dispositivo.'; end if;
 if c.capture_device_id is not null and new.source_device_id is distinct from c.capture_device_id then
 raise exception using errcode='42501',message='La captura está activa en otro dispositivo. Conserva el registro y regulariza el canal.'; end if;
 end if;
 update public.operational_cycles set capture_acknowledged_at=null,capture_acknowledged_by=null,capture_acknowledged_device=null,
 capture_device_id=case when new.kind='departure' and capture_channel='office' then new.source_device_id
 when new.kind in ('expense','fuel') then coalesce(capture_device_id,new.source_device_id) else capture_device_id end
 where id=cycle and company_id=new.company_id;
 return new;
end; $$;
revoke all on function private.bind_cycle_command_device() from public,anon,authenticated;
create trigger command_capture_device before insert on public.operation_commands for each row execute function private.bind_cycle_command_device();

create function public.acknowledge_cycle_device(p_cycle_id uuid,p_device_id text,p_queue_empty boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.operational_cycles;
begin
 perform private.assert_role(array['management','administration','driver']::public.app_role[]);
 select * into c from public.operational_cycles where id=p_cycle_id and company_id=private.current_company_id() for update;
 if not found or p_queue_empty is distinct from true or nullif(trim(p_device_id),'') is null then
 raise exception using errcode='23514',message='Primero sincroniza todos los registros y archivos de este dispositivo.'; end if;
 if (c.capture_device_id is not null and c.capture_device_id is distinct from p_device_id)
 or (c.capture_channel='driver_app' and (private.current_app_role()<>'driver' or c.primary_driver_id is distinct from private.current_driver_id()))
 or (c.capture_channel='office' and private.current_app_role()='driver') then
 raise exception using errcode='42501',message='La confirmación debe hacerse desde el dispositivo que está capturando la salida.'; end if;
 update public.operational_cycles set capture_device_id=p_device_id,capture_acknowledged_at=now(),capture_acknowledged_by=auth.uid(),capture_acknowledged_device=p_device_id where id=c.id;
 perform private.write_audit(c.company_id,'CYCLE_DEVICE_DRAIN_ACKNOWLEDGED','operational_cycle',c.id,null,jsonb_build_object('device',p_device_id),null);
end; $$;

create function public.change_cycle_capture_channel(p_cycle_id uuid,p_channel text,p_device_id text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.operational_cycles;
begin
 perform private.assert_role(array['management','administration']::public.app_role[]);
 select * into c from public.operational_cycles where id=p_cycle_id and company_id=private.current_company_id() for update;
 if not found or p_channel not in ('office','driver_app') or nullif(trim(p_reason),'') is null then
 raise exception using errcode='23514',message='Selecciona el canal y registra el motivo del cambio.'; end if;
 if c.status not in ('active','planned') or c.capture_acknowledged_at is null or c.capture_acknowledged_at<now()-interval '5 minutes'
 or c.capture_acknowledged_device is distinct from c.capture_device_id then
 raise exception using errcode='23514',message='Falta la confirmación reciente del dispositivo de origen con sus colas vacías.'; end if;
 if p_channel='driver_app' and not exists(select 1 from public.drivers d join public.profiles p on p.id=d.profile_id and p.company_id=d.company_id where d.id=c.primary_driver_id and p.active and p.role='driver') then
 raise exception using errcode='23514',message='El conductor necesita una cuenta activa.'; end if;
 update public.operational_cycles set capture_channel=p_channel,capture_device_id=case when p_channel='office' then p_device_id else null end,
 capture_acknowledged_at=null,capture_acknowledged_by=null,capture_acknowledged_device=null,version=version+1,updated_at=now() where id=c.id;
 update public.trips set capture_mode=case when p_channel='office' then 'staff_assisted'::public.trip_capture_mode else 'driver_app'::public.trip_capture_mode end,
 capture_mode_changed_at=now(),version=version+1,updated_at=now() where cycle_id=c.id and operational_status not in ('completed','cancelled');
 perform private.write_audit(c.company_id,'CYCLE_CAPTURE_CHANNEL_CHANGED','operational_cycle',c.id,to_jsonb(c),jsonb_build_object('channel',p_channel,'device',p_device_id),p_reason);
end; $$;
revoke all on function public.acknowledge_cycle_device(uuid,text,boolean),public.change_cycle_capture_channel(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.acknowledge_cycle_device(uuid,text,boolean),public.change_cycle_capture_channel(uuid,text,text,text) to authenticated;
