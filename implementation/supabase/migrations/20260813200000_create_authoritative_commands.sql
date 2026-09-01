-- Server-authoritative state transitions and financial commands.

create function private.assert_role(allowed_roles public.app_role[])
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_app_role() is null or not (private.current_app_role() = any(allowed_roles)) then
    raise exception using errcode = '42501', message = 'Not authorized for this operation';
  end if;
end;
$$;

create function private.write_audit(
  target_company_id uuid, target_action text, target_type text, target_id uuid,
  old_data jsonb, new_data jsonb, target_reason text default null
)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.audit_events (company_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (target_company_id, auth.uid(), target_action, target_type, target_id, old_data, new_data, target_reason)
$$;

revoke all on function private.assert_role(public.app_role[]) from public;
revoke all on function private.write_audit(uuid,text,text,uuid,jsonb,jsonb,text) from public;

create function public.transition_trip_operational(
  p_trip_id uuid, p_target public.trip_operational_status, p_expected_version integer, p_reason text default null
)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_trip public.trips; new_trip public.trips; allowed boolean := false;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  select * into old_trip from public.trips where id = p_trip_id and trips.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if old_trip.version <> p_expected_version then raise exception using errcode = '40001', message = 'Trip version conflict'; end if;
  if private.current_app_role() = 'driver' and (old_trip.driver_id is distinct from private.current_driver_id() or p_target not in ('loading','unloading')) then
    raise exception using errcode = '42501', message = 'Driver cannot perform this transition';
  end if;
  allowed := (old_trip.operational_status = 'draft' and p_target = 'approved' and private.is_staff())
    or (old_trip.operational_status = 'scheduled' and p_target = 'loading')
    or (old_trip.operational_status = 'in_transit' and p_target = 'unloading')
    or (old_trip.operational_status not in ('completed','cancelled') and p_target = 'cancelled' and private.is_staff());
  if not allowed then raise exception using errcode = '23514', message = 'Invalid operational transition'; end if;
  if p_target = 'cancelled' and length(trim(coalesce(p_reason,''))) = 0 then raise exception using errcode = '23514', message = 'Cancellation reason is required'; end if;
  update public.trips set operational_status = p_target, version = version + 1 where id = p_trip_id and trips.company_id = company_id returning * into new_trip;
  if p_target = 'loading' then
    update public.vehicles set current_status = 'in_trip' where id = old_trip.vehicle_id and vehicles.company_id = company_id;
    update public.drivers set current_status = 'in_trip' where id = old_trip.driver_id and drivers.company_id = company_id;
  elsif p_target = 'cancelled' then
    update public.vehicles set current_status = 'available' where id = old_trip.vehicle_id and vehicles.company_id = company_id;
    update public.drivers set current_status = 'available' where id = old_trip.driver_id and drivers.company_id = company_id;
  end if;
  insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,reason,actor_id)
    values (company_id,p_trip_id,'operational',old_trip.operational_status::text,p_target::text,p_reason,auth.uid());
  perform private.write_audit(company_id, case when p_target = 'cancelled' then 'TRIP_CANCELLED' else 'TRIP_STATUS_CHANGED' end, 'trip', p_trip_id, to_jsonb(old_trip), to_jsonb(new_trip), p_reason);
  return new_trip;
end;
$$;

create function public.schedule_trip(
  p_trip_id uuid, p_vehicle_id uuid, p_driver_id uuid, p_expected_version integer
)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_trip public.trips; new_trip public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_trip from public.trips where id = p_trip_id and trips.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'approved' then
    raise exception using errcode = '40001', message = 'Trip changed or is not plannable';
  end if;
  if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = company_id and v.active and v.current_status in ('available','scheduled')) then
    raise exception using errcode = '23514', message = 'Vehicle is not available';
  end if;
  if not exists (select 1 from public.drivers d where d.id = p_driver_id and d.company_id = company_id and d.active and d.current_status in ('available','assigned')) then
    raise exception using errcode = '23514', message = 'Driver is not available';
  end if;
  if exists (
    select 1 from public.documents d
    where d.company_id = company_id and d.blocks_operation
      and ((d.entity_type = 'vehicle' and d.vehicle_id = p_vehicle_id) or (d.entity_type = 'driver' and d.driver_id = p_driver_id))
      and (d.file_id is null or d.status in ('expired','cancelled') or d.expires_on < current_date)
  ) then raise exception using errcode = '23514', message = 'Critical vehicle or driver document blocks scheduling'; end if;
  if exists (
    select 1 from public.work_orders w
    where w.company_id = company_id and w.vehicle_id = p_vehicle_id and w.blocks_operation
      and w.status not in ('finished','cancelled')
  ) then raise exception using errcode = '23514', message = 'Blocking maintenance work order prevents scheduling'; end if;
  if exists (select 1 from public.trips t where t.company_id = company_id and t.id <> p_trip_id and (t.vehicle_id = p_vehicle_id or t.driver_id = p_driver_id) and t.operational_status in ('scheduled','loading','in_transit','unloading')) then
    raise exception using errcode = '23505', message = 'Vehicle or driver already has an active trip';
  end if;
  update public.trips set vehicle_id = p_vehicle_id, driver_id = p_driver_id, operational_status = 'scheduled', version = version + 1
    where id = p_trip_id and trips.company_id = company_id returning * into new_trip;
  update public.vehicles set current_status = 'scheduled' where id = p_vehicle_id and vehicles.company_id = company_id;
  update public.drivers set current_status = 'assigned' where id = p_driver_id and drivers.company_id = company_id;
  insert into public.trip_status_events (company_id,trip_id,dimension,previous_status,new_status,actor_id)
    values (company_id,p_trip_id,'operational',old_trip.operational_status::text,'scheduled',auth.uid());
  perform private.write_audit(company_id, 'TRIP_SCHEDULED', 'trip', p_trip_id, to_jsonb(old_trip), to_jsonb(new_trip));
  return new_trip;
end;
$$;

create function public.start_trip(
  p_trip_id uuid, p_odometer_km numeric, p_expected_version integer, p_idempotency_key uuid
)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_trip public.trips; new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then raise exception using errcode = '23514', message = 'Idempotency ID is required'; end if;
  select * into old_trip from public.trips where id = p_trip_id and trips.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if private.current_app_role() = 'driver' and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'loading' or old_trip.vehicle_id is null or old_trip.driver_id is null then
    raise exception using errcode = '40001', message = 'Trip changed or is not ready to start';
  end if;
  if p_odometer_km < (select current_odometer_km from public.vehicles where id = old_trip.vehicle_id and vehicles.company_id = company_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  update public.trips set operational_status = 'in_transit', started_at = coalesce(started_at, now()), version = version + 1
    where id = p_trip_id and trips.company_id = company_id returning * into new_trip;
  update public.vehicles set current_status = 'in_trip', current_odometer_km = greatest(current_odometer_km, p_odometer_km)
    where id = old_trip.vehicle_id and vehicles.company_id = company_id;
  update public.drivers set current_status = 'in_trip' where id = old_trip.driver_id and drivers.company_id = company_id;
  insert into public.odometer_entries (company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type, source, recorded_by, idempotency_key)
    values (company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(), 'trip_start', 'command', auth.uid(), p_idempotency_key)
    on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (company_id, trip_id, dimension, previous_status, new_status, actor_id)
    values (company_id, p_trip_id, 'operational', old_trip.operational_status::text, new_trip.operational_status::text, auth.uid());
  perform private.write_audit(company_id, 'TRIP_STARTED', 'trip', p_trip_id, to_jsonb(old_trip), to_jsonb(new_trip));
  return new_trip;
end;
$$;

create function public.complete_trip(
  p_trip_id uuid, p_odometer_km numeric, p_expected_version integer, p_idempotency_key uuid,
  p_cargo_delivered boolean
)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_trip public.trips; new_trip public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_idempotency_key is null then raise exception using errcode = '23514', message = 'Idempotency ID is required'; end if;
  if p_cargo_delivered is distinct from true then raise exception using errcode = '23514', message = 'Cargo delivery must be confirmed'; end if;
  select * into old_trip from public.trips where id = p_trip_id and trips.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if private.current_app_role() = 'driver' and old_trip.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if old_trip.version <> p_expected_version or old_trip.operational_status <> 'unloading' then
    raise exception using errcode = '40001', message = 'Trip changed or cannot be completed';
  end if;
  if p_odometer_km < (select current_odometer_km from public.vehicles where id = old_trip.vehicle_id and vehicles.company_id = company_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  update public.trips set operational_status = 'completed', administrative_status = 'settlement_pending', operational_finished_at = now(), version = version + 1
    where id = p_trip_id and trips.company_id = company_id returning * into new_trip;
  update public.vehicles set current_status = 'available', current_odometer_km = greatest(current_odometer_km, p_odometer_km)
    where id = old_trip.vehicle_id and vehicles.company_id = company_id;
  update public.drivers set current_status = 'available' where id = old_trip.driver_id and drivers.company_id = company_id;
  insert into public.odometer_entries (company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type, source, recorded_by, idempotency_key)
    values (company_id, old_trip.vehicle_id, p_trip_id, p_odometer_km, now(), 'trip_finish', 'command', auth.uid(), p_idempotency_key)
    on conflict (company_id, idempotency_key) do nothing;
  insert into public.trip_status_events (company_id, trip_id, dimension, previous_status, new_status, actor_id)
    values (company_id, p_trip_id, 'operational', old_trip.operational_status::text, 'completed', auth.uid()),
           (company_id, p_trip_id, 'administrative', old_trip.administrative_status::text, 'settlement_pending', auth.uid());
  insert into public.settlements (company_id, trip_id, driver_id) values (company_id, p_trip_id, old_trip.driver_id)
    on conflict (company_id, trip_id) do nothing;
  perform private.write_audit(company_id, 'TRIP_COMPLETED', 'trip', p_trip_id, to_jsonb(old_trip), to_jsonb(new_trip));
  return new_trip;
end;
$$;

create function public.close_settlement(p_settlement_id uuid, p_expected_version integer)
returns public.settlements language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_row public.settlements; new_row public.settlements; advances_total numeric(14,2); expenses_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into old_row from public.settlements where id = p_settlement_id and settlements.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Settlement not found'; end if;
  if old_row.version <> p_expected_version or old_row.status not in ('pending','under_review','approved') then
    raise exception using errcode = '40001', message = 'Settlement changed or cannot be closed';
  end if;
  if exists (select 1 from public.settlement_expenses se join public.expenses e on e.company_id = se.company_id and e.id = se.expense_id where se.company_id = company_id and se.settlement_id = p_settlement_id and e.validation_status <> 'validated') then
    raise exception using errcode = '23514', message = 'Every included expense must be validated';
  end if;
  select coalesce(sum(a.amount),0) into advances_total from public.advances a where a.company_id = company_id and a.trip_id = old_row.trip_id and a.status <> 'cancelled';
  select coalesce(sum(coalesce(e.approved_amount,e.amount)),0) into expenses_total from public.settlement_expenses se join public.expenses e on e.company_id = se.company_id and e.id = se.expense_id where se.company_id = company_id and se.settlement_id = p_settlement_id;
  update public.settlements set total_advances = advances_total, total_expenses = expenses_total, balance = advances_total - expenses_total,
    status = 'closed', approved_at = coalesce(approved_at,now()), closed_at = now(), approved_by = auth.uid(), version = version + 1
    where id = p_settlement_id and settlements.company_id = company_id returning * into new_row;
  update public.trips set administrative_status = 'settlement_closed', version = version + 1 where id = old_row.trip_id and trips.company_id = company_id;
  insert into public.trip_status_events (company_id, trip_id, dimension, previous_status, new_status, actor_id)
    values (company_id, old_row.trip_id, 'administrative', 'settlement_pending', 'settlement_closed', auth.uid());
  perform private.write_audit(company_id, 'SETTLEMENT_CLOSED', 'settlement', p_settlement_id, to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.reopen_settlement(settlement_id uuid, reason text)
returns public.settlements language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_row public.settlements; new_row public.settlements;
begin
  perform private.assert_role(array['management']::public.app_role[]);
  if length(trim(coalesce(reason,''))) = 0 then raise exception using errcode = '23514', message = 'A reason is required'; end if;
  select * into old_row from public.settlements where id = settlement_id and settlements.company_id = company_id for update;
  if not found or old_row.status <> 'closed' then raise exception using errcode = '23514', message = 'Only a closed settlement can be reopened'; end if;
  update public.settlements set status = 'under_review', closed_at = null, version = version + 1
    where id = settlement_id and settlements.company_id = company_id returning * into new_row;
  update public.trips set administrative_status = 'settlement_review', version = version + 1 where id = old_row.trip_id and trips.company_id = company_id;
  perform private.write_audit(company_id, 'SETTLEMENT_REOPENED', 'settlement', settlement_id, to_jsonb(old_row), to_jsonb(new_row), reason);
  return new_row;
end;
$$;

create function public.register_payment(
  p_payment_id uuid, p_invoice_id uuid, p_paid_at timestamptz, p_amount numeric,
  p_payment_method text, p_reference text, p_idempotency_key uuid
)
returns public.payments language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); invoice_row public.invoices; payment_row public.payments; paid_total numeric(14,2);
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if p_payment_id is null or p_idempotency_key is null then raise exception using errcode = '23514', message = 'Payment and idempotency IDs are required'; end if;
  select * into payment_row from public.payments where payments.company_id = company_id and idempotency_key = p_idempotency_key;
  if found then return payment_row; end if;
  if p_amount <= 0 then raise exception using errcode = '23514', message = 'Payment amount must be positive'; end if;
  select * into invoice_row from public.invoices where id = p_invoice_id and invoices.company_id = company_id for update;
  if not found or invoice_row.status in ('draft','cancelled') then raise exception using errcode = '23514', message = 'Invoice cannot receive payments'; end if;
  select coalesce(sum(amount),0) into paid_total from public.payments where payments.company_id = company_id and invoice_id = p_invoice_id and cancelled_at is null;
  if paid_total + p_amount > invoice_row.total then raise exception using errcode = '23514', message = 'Payment exceeds invoice balance'; end if;
  insert into public.payments (id, company_id, invoice_id, client_id, paid_at, amount, currency, payment_method, reference, created_by, idempotency_key)
    values (p_payment_id, company_id, p_invoice_id, invoice_row.client_id, p_paid_at, p_amount, invoice_row.currency, p_payment_method, p_reference, auth.uid(), p_idempotency_key)
    returning * into payment_row;
  paid_total := paid_total + p_amount;
  update public.invoices set status = case when paid_total = total then 'paid'::public.invoice_status else 'partial'::public.invoice_status end
    where id = p_invoice_id and invoices.company_id = company_id;
  update public.trips set financial_status = case when paid_total = invoice_row.total then 'paid'::public.trip_financial_status else 'partially_paid'::public.trip_financial_status end,
    version = version + 1 where id = invoice_row.trip_id and trips.company_id = company_id;
  perform private.write_audit(company_id, 'PAYMENT_CREATED', 'payment', p_payment_id, null, to_jsonb(payment_row));
  return payment_row;
end;
$$;

revoke all on function public.schedule_trip(uuid,uuid,uuid,integer) from public;
revoke all on function public.transition_trip_operational(uuid,public.trip_operational_status,integer,text) from public;
revoke all on function public.start_trip(uuid,numeric,integer,uuid) from public;
revoke all on function public.complete_trip(uuid,numeric,integer,uuid,boolean) from public;
revoke all on function public.close_settlement(uuid,integer) from public;
revoke all on function public.reopen_settlement(uuid,text) from public;
revoke all on function public.register_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) from public;
grant execute on function public.schedule_trip(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.transition_trip_operational(uuid,public.trip_operational_status,integer,text) to authenticated;
grant execute on function public.start_trip(uuid,numeric,integer,uuid) to authenticated;
grant execute on function public.complete_trip(uuid,numeric,integer,uuid,boolean) to authenticated;
grant execute on function public.close_settlement(uuid,integer) to authenticated;
grant execute on function public.reopen_settlement(uuid,text) to authenticated;
grant execute on function public.register_payment(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated;
grant execute on all functions in schema public to service_role;

create function public.record_odometer_entry(
  p_id uuid, p_trip_id uuid, p_reading_km numeric, p_reading_at timestamptz,
  p_reading_type text, p_source_device_id text, p_idempotency_key uuid
)
returns public.odometer_entries language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); trip_row public.trips; result public.odometer_entries;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then raise exception using errcode = '23514', message = 'Record and idempotency IDs are required'; end if;
  if not private.can_write_trip_activity(p_trip_id) then raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope'; end if;
  select * into result from public.odometer_entries where odometer_entries.company_id = company_id and idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into trip_row from public.trips where id = p_trip_id and trips.company_id = company_id;
  if trip_row.vehicle_id is null then raise exception using errcode = '23514', message = 'Trip has no vehicle'; end if;
  if p_reading_km < (select current_odometer_km from public.vehicles where id = trip_row.vehicle_id and vehicles.company_id = company_id) then
    raise exception using errcode = '23514', message = 'Odometer cannot decrease';
  end if;
  insert into public.odometer_entries (id,company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (p_id,company_id,trip_row.vehicle_id,p_trip_id,p_reading_km,p_reading_at,p_reading_type,'driver_app',auth.uid(),p_source_device_id,p_idempotency_key)
    returning * into result;
  update public.vehicles set current_odometer_km = greatest(current_odometer_km,p_reading_km) where id = trip_row.vehicle_id and vehicles.company_id = company_id;
  return result;
end;
$$;

create function public.record_expense(
  p_id uuid, p_trip_id uuid, p_category_id uuid, p_supplier_id uuid, p_incurred_at timestamptz,
  p_amount numeric, p_currency char(3), p_receipt_type text, p_receipt_number text,
  p_receipt_file_id uuid, p_description text, p_source_device_id text, p_idempotency_key uuid
)
returns public.expenses language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); trip_row public.trips; result public.expenses; driver_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then raise exception using errcode = '23514', message = 'Record and idempotency IDs are required'; end if;
  if not private.can_write_trip_activity(p_trip_id) then raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope'; end if;
  select * into result from public.expenses where expenses.company_id = company_id and idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into trip_row from public.trips where id = p_trip_id and trips.company_id = company_id;
  driver_id := case when private.current_app_role() = 'driver' then private.current_driver_id() else trip_row.driver_id end;
  insert into public.expenses (id,company_id,assignment_type,trip_id,vehicle_id,driver_id,category_id,supplier_id,incurred_at,amount,currency,receipt_type,receipt_number,receipt_file_id,description,source,validation_status,created_by,source_device_id,idempotency_key)
    values (p_id,company_id,'trip',p_trip_id,trip_row.vehicle_id,driver_id,p_category_id,p_supplier_id,p_incurred_at,p_amount,upper(p_currency::text)::char(3),p_receipt_type,p_receipt_number,p_receipt_file_id,p_description,'driver_app','pending_review',auth.uid(),p_source_device_id,p_idempotency_key)
    returning * into result;
  return result;
end;
$$;

create function public.record_fuel_entry(
  p_id uuid, p_trip_id uuid, p_supplier_id uuid, p_fueled_at timestamptz, p_location text,
  p_odometer_km numeric, p_quantity numeric, p_volume_unit text, p_unit_price numeric,
  p_total_amount numeric, p_currency char(3), p_payment_method text, p_receipt_type text,
  p_receipt_number text, p_receipt_file_id uuid, p_source_device_id text, p_idempotency_key uuid
)
returns public.fuel_entries language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); trip_row public.trips; result public.fuel_entries; driver_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then raise exception using errcode = '23514', message = 'Record and idempotency IDs are required'; end if;
  if not private.can_write_trip_activity(p_trip_id) then raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope'; end if;
  select * into result from public.fuel_entries where fuel_entries.company_id = company_id and idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into trip_row from public.trips where id = p_trip_id and trips.company_id = company_id;
  if trip_row.vehicle_id is null then raise exception using errcode = '23514', message = 'Trip has no vehicle'; end if;
  driver_id := case when private.current_app_role() = 'driver' then private.current_driver_id() else trip_row.driver_id end;
  insert into public.fuel_entries (id,company_id,trip_id,vehicle_id,driver_id,supplier_id,fueled_at,location,odometer_km,quantity,volume_unit,unit_price,total_amount,currency,payment_method,receipt_type,receipt_number,receipt_file_id,validation_status,created_by,source_device_id,idempotency_key)
    values (p_id,company_id,p_trip_id,trip_row.vehicle_id,driver_id,p_supplier_id,p_fueled_at,p_location,p_odometer_km,p_quantity,p_volume_unit,p_unit_price,p_total_amount,upper(p_currency::text)::char(3),p_payment_method,p_receipt_type,p_receipt_number,p_receipt_file_id,'pending_review',auth.uid(),p_source_device_id,p_idempotency_key)
    returning * into result;
  insert into public.odometer_entries (company_id,vehicle_id,trip_id,reading_km,reading_at,reading_type,source,recorded_by,source_device_id,idempotency_key)
    values (company_id,trip_row.vehicle_id,p_trip_id,p_odometer_km,p_fueled_at,'fuel','driver_app',auth.uid(),p_source_device_id,p_idempotency_key)
    on conflict (company_id,idempotency_key) do nothing;
  update public.vehicles set current_odometer_km = greatest(current_odometer_km,p_odometer_km) where id = trip_row.vehicle_id and vehicles.company_id = company_id;
  return result;
end;
$$;

create function public.report_incident(
  p_id uuid, p_trip_id uuid, p_occurred_at timestamptz, p_location text, p_incident_type text,
  p_severity public.incident_severity, p_description text, p_action_taken text,
  p_estimated_cost numeric, p_file_id uuid, p_source_device_id text, p_idempotency_key uuid
)
returns public.incidents language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); trip_row public.trips; result public.incidents; driver_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if p_id is null or p_idempotency_key is null then raise exception using errcode = '23514', message = 'Record and idempotency IDs are required'; end if;
  if not private.can_write_trip_activity(p_trip_id) then raise exception using errcode = '42501', message = 'Trip is outside the writable authenticated scope'; end if;
  select * into result from public.incidents where incidents.company_id = company_id and idempotency_key = p_idempotency_key;
  if found then return result; end if;
  select * into trip_row from public.trips where id = p_trip_id and trips.company_id = company_id;
  driver_id := case when private.current_app_role() = 'driver' then private.current_driver_id() else trip_row.driver_id end;
  insert into public.incidents (id,company_id,trip_id,vehicle_id,driver_id,occurred_at,location,incident_type,severity,description,action_taken,status,estimated_cost,file_id,created_by,source_device_id,idempotency_key)
    values (p_id,company_id,p_trip_id,trip_row.vehicle_id,driver_id,p_occurred_at,p_location,p_incident_type,p_severity,p_description,p_action_taken,'open',p_estimated_cost,p_file_id,auth.uid(),p_source_device_id,p_idempotency_key)
    returning * into result;
  return result;
end;
$$;

revoke all on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) from public;
revoke all on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) from public;
revoke all on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) from public;
revoke all on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) from public;
grant execute on function public.record_odometer_entry(uuid,uuid,numeric,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.record_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid) to authenticated;
grant execute on function public.record_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid) to authenticated;
grant execute on function public.report_incident(uuid,uuid,timestamptz,text,text,public.incident_severity,text,text,numeric,uuid,text,uuid) to authenticated;
grant execute on all functions in schema public to service_role;
