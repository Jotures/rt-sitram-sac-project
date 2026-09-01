-- Public RPC contract used by the web application. These small adapters keep
-- optimistic locking and actor/company resolution inside authoritative commands.

create function public.approve_trip(trip_id uuid)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare trip_row public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.operational_status = 'approved' then return trip_row; end if;
  return public.transition_trip_operational($1, 'approved', trip_row.version, null);
end;
$$;

create function public.schedule_trip(trip_id uuid, vehicle_id uuid, driver_id uuid)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare trip_row public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.operational_status = 'scheduled'
     and trip_row.vehicle_id = $2 and trip_row.driver_id = $3 then
    return trip_row;
  end if;
  return public.schedule_trip($1, $2, $3, trip_row.version);
end;
$$;

create function public.start_trip(trip_id uuid, initial_mileage numeric)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare trip_row public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if private.current_app_role() = 'driver' and trip_row.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if trip_row.operational_status = 'in_transit' then return trip_row; end if;
  if trip_row.operational_status <> 'scheduled' then
    raise exception using errcode = '23514', message = 'Only a scheduled trip can be started';
  end if;
  trip_row := public.transition_trip_operational($1, 'loading', trip_row.version, null);
  return public.start_trip($1, $2, trip_row.version, gen_random_uuid());
end;
$$;

create function public.complete_trip(trip_id uuid, final_mileage numeric, cargo_delivered boolean)
returns public.trips language plpgsql volatile security definer set search_path = '' as $$
declare trip_row public.trips;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  select * into trip_row
  from public.trips t
  where t.id = $1 and t.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if private.current_app_role() = 'driver' and trip_row.driver_id is distinct from private.current_driver_id() then
    raise exception using errcode = '42501', message = 'Driver is not assigned to this trip';
  end if;
  if $3 is distinct from true then raise exception using errcode = '23514', message = 'Cargo delivery must be confirmed'; end if;
  if trip_row.operational_status = 'completed' then return trip_row; end if;
  return public.complete_trip($1, $2, trip_row.version, gen_random_uuid(), $3);
end;
$$;

create function public.issue_trip_advance(
  trip_id uuid, driver_id uuid, amount numeric, concept text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  advance_id uuid := gen_random_uuid();
  trip_row public.trips;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $3 <= 0 then raise exception using errcode = '23514', message = 'Advance amount must be positive'; end if;
  select * into trip_row from public.trips t
  where t.id = $1 and t.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.driver_id is distinct from $2 then
    raise exception using errcode = '23514', message = 'Advance driver must be assigned to the trip';
  end if;
  if trip_row.operational_status in ('draft','approved','cancelled','completed') then
    raise exception using errcode = '23514', message = 'Trip cannot receive an advance in its current state';
  end if;
  insert into public.advances (
    id, company_id, trip_id, driver_id, delivered_at, amount, currency,
    delivery_method, concept, created_by
  ) values (
    advance_id, company_id, $1, $2, now(), $3, trip_row.currency,
    'unspecified', nullif(trim($4), ''), auth.uid()
  );
  perform private.write_audit(company_id, 'TRIP_ADVANCE_ISSUED', 'advance', advance_id, null,
    (select to_jsonb(a) from public.advances a where a.id = advance_id));
  return advance_id;
end;
$$;

create function public.issue_trip_advance(
  p_trip_id uuid, p_driver_id uuid, p_delivered_at timestamptz, p_amount numeric,
  p_delivery_method text, p_concept text, p_idempotency_key uuid
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  advance_id uuid := gen_random_uuid();
  trip_row public.trips;
  existing_id uuid;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $4 <= 0 or $7 is null then raise exception using errcode = '23514', message = 'Positive amount and idempotency ID are required'; end if;
  if length(trim($5)) = 0 then raise exception using errcode = '23514', message = 'Delivery method is required'; end if;
  select a.id into existing_id from public.advances a
  where a.company_id = company_id and a.idempotency_key = $7;
  if found then return existing_id; end if;
  select * into trip_row from public.trips t
  where t.id = $1 and t.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.driver_id is distinct from $2 then
    raise exception using errcode = '23514', message = 'Advance driver must be assigned to the trip';
  end if;
  if trip_row.operational_status in ('draft','approved','cancelled','completed') then
    raise exception using errcode = '23514', message = 'Trip cannot receive an advance in its current state';
  end if;
  insert into public.advances (
    id, company_id, trip_id, driver_id, delivered_at, amount, currency,
    delivery_method, concept, created_by, idempotency_key
  ) values (
    advance_id, company_id, $1, $2, $3, $4, trip_row.currency,
    trim($5), nullif(trim($6), ''), auth.uid(), $7
  );
  perform private.write_audit(company_id, 'TRIP_ADVANCE_ISSUED', 'advance', advance_id, null,
    (select to_jsonb(a) from public.advances a where a.id = advance_id));
  return advance_id;
end;
$$;

create function public.close_settlement(settlement_id uuid, expected_balance numeric)
returns public.settlements language plpgsql volatile security definer set search_path = '' as $$
declare settlement_row public.settlements;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  select * into settlement_row from public.settlements s
  where s.id = $1 and s.company_id = private.current_company_id();
  if not found then raise exception using errcode = 'P0002', message = 'Settlement not found'; end if;
  if settlement_row.status = 'closed' and settlement_row.balance = $2 then return settlement_row; end if;
  settlement_row := public.close_settlement($1, settlement_row.version);
  if settlement_row.balance is distinct from $2 then
    raise exception using errcode = '40001', message = 'Settlement balance changed';
  end if;
  return settlement_row;
end;
$$;

create function public.complete_work_order(
  work_order_id uuid, final_mileage numeric, labour_cost numeric, parts_cost numeric
)
returns public.work_orders language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  old_row public.work_orders;
  new_row public.work_orders;
  vehicle_mileage numeric;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $2 < 0 or $3 < 0 or $4 < 0 then
    raise exception using errcode = '23514', message = 'Mileage and costs cannot be negative';
  end if;
  select * into old_row from public.work_orders w
  where w.id = $1 and w.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Work order not found'; end if;
  if old_row.status = 'finished' then return old_row; end if;
  if old_row.status = 'cancelled' then raise exception using errcode = '23514', message = 'Cancelled work order cannot be completed'; end if;
  select v.current_odometer_km into vehicle_mileage from public.vehicles v
  where v.id = old_row.vehicle_id and v.company_id = company_id for update;
  if $2 < vehicle_mileage then raise exception using errcode = '23514', message = 'Odometer cannot decrease'; end if;
  update public.work_orders
  set status = 'finished', finished_at = coalesce(finished_at, now()), odometer_km = $2,
      labor_cost = $3, parts_cost = $4
  where id = $1 and work_orders.company_id = company_id returning * into new_row;
  update public.vehicles
  set current_odometer_km = greatest(current_odometer_km, $2), current_status = 'available'
  where id = old_row.vehicle_id and vehicles.company_id = company_id;
  perform private.write_audit(company_id, 'WORK_ORDER_COMPLETED', 'work_order', $1,
    to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end;
$$;

create function public.create_trip_invoice(
  trip_id uuid, client_id uuid, series text, number text,
  issued_at timestamptz, due_at timestamptz, total numeric
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  invoice_id uuid := gen_random_uuid();
  trip_row public.trips;
  invoice_row public.invoices;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $7 <= 0 then raise exception using errcode = '23514', message = 'Invoice total must be positive'; end if;
  if $6 < $5 then raise exception using errcode = '23514', message = 'Invoice due date cannot precede issue date'; end if;
  if length(trim($3)) = 0 or length(trim($4)) = 0 then
    raise exception using errcode = '23514', message = 'Invoice series and number are required';
  end if;
  select * into trip_row from public.trips t
  where t.id = $1 and t.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.client_id <> $2 then raise exception using errcode = '23514', message = 'Invoice client must match trip client'; end if;
  if trip_row.operational_status <> 'completed' then
    raise exception using errcode = '23514', message = 'Only a completed trip can be invoiced';
  end if;
  select * into invoice_row from public.invoices i
  where i.company_id = company_id and i.trip_id = $1 and i.status <> 'cancelled';
  if found then
    if invoice_row.client_id = $2 and invoice_row.series = trim($3) and invoice_row.number = trim($4)
       and invoice_row.issued_on = $5::date and invoice_row.due_on = $6::date and invoice_row.total = $7 then
      return invoice_row.id;
    end if;
    raise exception using errcode = '23505', message = 'Trip already has a different active invoice';
  end if;
  insert into public.invoices (
    id, company_id, client_id, trip_id, series, number, issued_on, due_on,
    currency, subtotal, tax, total, status, created_by
  ) values (
    invoice_id, company_id, $2, $1, trim($3), trim($4), $5::date, $6::date,
    trip_row.currency, $7, 0, $7, 'issued', auth.uid()
  ) returning * into invoice_row;
  update public.trips set financial_status = 'billed', version = version + 1
  where id = $1 and trips.company_id = company_id;
  perform private.write_audit(company_id, 'TRIP_INVOICE_CREATED', 'invoice', invoice_id, null, to_jsonb(invoice_row));
  return invoice_id;
end;
$$;

create function public.create_trip_invoice(
  p_trip_id uuid, p_client_id uuid, p_series text, p_number text,
  p_issued_on date, p_due_on date, p_subtotal numeric, p_tax numeric
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  invoice_id uuid := gen_random_uuid();
  trip_row public.trips;
  invoice_row public.invoices;
  invoice_total numeric := $7 + $8;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if $7 < 0 or $8 < 0 or invoice_total <= 0 then raise exception using errcode = '23514', message = 'Invoice amounts are invalid'; end if;
  if $6 is not null and $6 < $5 then raise exception using errcode = '23514', message = 'Invoice due date cannot precede issue date'; end if;
  if length(trim($3)) = 0 or length(trim($4)) = 0 then raise exception using errcode = '23514', message = 'Invoice series and number are required'; end if;
  select * into trip_row from public.trips t
  where t.id = $1 and t.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if trip_row.client_id <> $2 then raise exception using errcode = '23514', message = 'Invoice client must match trip client'; end if;
  if trip_row.operational_status <> 'completed' then raise exception using errcode = '23514', message = 'Only a completed trip can be invoiced'; end if;
  select * into invoice_row from public.invoices i
  where i.company_id = company_id and i.trip_id = $1 and i.status <> 'cancelled';
  if found then
    if invoice_row.client_id = $2 and invoice_row.series = trim($3) and invoice_row.number = trim($4)
       and invoice_row.issued_on = $5 and invoice_row.due_on is not distinct from $6
       and invoice_row.subtotal = $7 and invoice_row.tax = $8 then return invoice_row.id; end if;
    raise exception using errcode = '23505', message = 'Trip already has a different active invoice';
  end if;
  insert into public.invoices (
    id, company_id, client_id, trip_id, series, number, issued_on, due_on,
    currency, subtotal, tax, total, status, created_by
  ) values (
    invoice_id, company_id, $2, $1, trim($3), trim($4), $5, $6,
    trip_row.currency, $7, $8, invoice_total, 'issued', auth.uid()
  ) returning * into invoice_row;
  update public.trips set financial_status = 'billed', version = version + 1
  where id = $1 and trips.company_id = company_id;
  perform private.write_audit(company_id, 'TRIP_INVOICE_CREATED', 'invoice', invoice_id, null, to_jsonb(invoice_row));
  return invoice_id;
end;
$$;

create function public.register_invoice_payment(
  invoice_id uuid, paid_at timestamptz, amount numeric, method text, reference text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  idempotency_id uuid;
  payment_row public.payments;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim($4)) = 0 then raise exception using errcode = '23514', message = 'Payment method is required'; end if;
  idempotency_id := md5(concat_ws('|', company_id::text, $1::text, $2::text, $3::text, trim($4), coalesce(trim($5), '')))::uuid;
  payment_row := public.register_payment(idempotency_id, $1, $2, $3, trim($4), nullif(trim($5), ''), idempotency_id);
  return payment_row.id;
end;
$$;

create function public.resolve_alert(alert_id uuid, note text)
returns public.alerts language plpgsql volatile security definer set search_path = '' as $$
declare company_id uuid := private.current_company_id(); old_row public.alerts; new_row public.alerts;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  if length(trim(coalesce($2,''))) = 0 then raise exception using errcode = '23514', message = 'Resolution note is required'; end if;
  select * into old_row from public.alerts a
  where a.id = $1 and a.company_id = company_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Alert not found'; end if;
  if old_row.status = 'resolved' then return old_row; end if;
  if old_row.status = 'dismissed' then raise exception using errcode = '23514', message = 'Dismissed alert cannot be resolved'; end if;
  update public.alerts set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
  where id = $1 and alerts.company_id = company_id returning * into new_row;
  perform private.write_audit(company_id, 'ALERT_RESOLVED', 'alert', $1, to_jsonb(old_row), to_jsonb(new_row), trim($2));
  return new_row;
end;
$$;

create function public.attach_trip_file(p_entity_type text, p_entity_id uuid, p_file_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  company_id uuid := private.current_company_id();
  actor_role public.app_role := private.current_app_role();
  target_trip_id uuid;
  target_actor_id uuid;
  current_file_id uuid;
begin
  perform private.assert_role(array['management','administration','driver']::public.app_role[]);
  if not exists (
    select 1 from public.files f
    where f.id = $3 and f.company_id = company_id
      and (private.is_staff() or f.uploaded_by = auth.uid())
  ) then raise exception using errcode = '42501', message = 'File is outside the authenticated upload scope'; end if;

  if $1 = 'expense' then
    select e.trip_id, e.created_by, e.receipt_file_id into target_trip_id, target_actor_id, current_file_id
    from public.expenses e where e.id = $2 and e.company_id = company_id for update;
  elsif $1 = 'fuel_entry' then
    select f.trip_id, f.created_by, f.receipt_file_id into target_trip_id, target_actor_id, current_file_id
    from public.fuel_entries f where f.id = $2 and f.company_id = company_id for update;
  elsif $1 = 'incident' then
    select i.trip_id, i.created_by, i.file_id into target_trip_id, target_actor_id, current_file_id
    from public.incidents i where i.id = $2 and i.company_id = company_id for update;
  else
    raise exception using errcode = '22023', message = 'Unsupported attachment entity type';
  end if;
  if not found or target_trip_id is null then raise exception using errcode = 'P0002', message = 'Trip entity not found'; end if;
  if actor_role = 'driver' and (target_actor_id <> auth.uid() or not private.can_access_trip(target_trip_id)) then
    raise exception using errcode = '42501', message = 'Trip entity is outside the authenticated driver scope';
  end if;
  if current_file_id = $3 then return $3; end if;
  if current_file_id is not null then raise exception using errcode = '23505', message = 'Entity already has a different attachment'; end if;

  if $1 = 'expense' then update public.expenses set receipt_file_id = $3 where id = $2 and expenses.company_id = company_id;
  elsif $1 = 'fuel_entry' then update public.fuel_entries set receipt_file_id = $3 where id = $2 and fuel_entries.company_id = company_id;
  else update public.incidents set file_id = $3 where id = $2 and incidents.company_id = company_id;
  end if;
  perform private.write_audit(company_id, 'TRIP_FILE_ATTACHED', $1, $2, null, jsonb_build_object('file_id',$3));
  return $3;
end;
$$;

create unique index alerts_one_open_derivation_idx
  on public.alerts (company_id, alert_type, entity_type, entity_id)
  where status in ('new','seen','in_progress');

create function public.refresh_operational_alerts()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare actor_company_id uuid := private.current_company_id(); inserted_count integer := 0; affected integer;
begin
  perform private.assert_role(array['management','administration']::public.app_role[]);
  insert into public.alerts (company_id,alert_type,priority,entity_type,entity_id,title,message,due_at)
  select d.company_id, 'document_expiry',
    case when expires_on < current_date then 'critical' else 'high' end,
    'document', id,
    case when expires_on < current_date then 'Documento vencido' else 'Documento próximo a vencer' end,
    document_type || case when document_number is null then '' else ' ' || document_number end,
    expires_on::timestamptz
  from public.documents d
  where d.company_id = actor_company_id and d.blocks_operation and d.expires_on is not null
    and d.expires_on <= current_date + 30
    and not exists (select 1 from public.alerts a where a.company_id = actor_company_id and a.alert_type = 'document_expiry' and a.entity_type = 'document' and a.entity_id = d.id and a.status in ('new','seen','in_progress'));
  get diagnostics affected = row_count; inserted_count := inserted_count + affected;

  insert into public.alerts (company_id,alert_type,priority,entity_type,entity_id,title,message)
  select w.company_id, 'maintenance_block', 'critical', 'work_order', id,
    'Mantenimiento bloqueante', 'La orden ' || code || ' bloquea la operación de la unidad.'
  from public.work_orders w
  where w.company_id = actor_company_id and w.blocks_operation and w.status not in ('finished','cancelled')
    and not exists (select 1 from public.alerts a where a.company_id = actor_company_id and a.alert_type = 'maintenance_block' and a.entity_type = 'work_order' and a.entity_id = w.id and a.status in ('new','seen','in_progress'));
  get diagnostics affected = row_count; inserted_count := inserted_count + affected;
  return inserted_count;
end;
$$;

-- Sensitive writes are command-only. Security-definer functions remain subject
-- to their explicit company and role checks.
create unique index invoices_one_active_per_trip_idx
  on public.invoices (company_id, trip_id) where status <> 'cancelled';

revoke insert on table public.advances from authenticated;
revoke insert, update on table public.invoices from authenticated;
revoke update on table public.work_orders, public.alerts from authenticated;

revoke all on function public.approve_trip(uuid) from public;
revoke all on function public.schedule_trip(uuid,uuid,uuid) from public;
revoke all on function public.start_trip(uuid,numeric) from public;
revoke all on function public.complete_trip(uuid,numeric,boolean) from public;
revoke all on function public.issue_trip_advance(uuid,uuid,numeric,text) from public;
revoke all on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid) from public;
revoke all on function public.close_settlement(uuid,numeric) from public;
revoke all on function public.complete_work_order(uuid,numeric,numeric,numeric) from public;
revoke all on function public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric) from public;
revoke all on function public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric) from public;
revoke all on function public.register_invoice_payment(uuid,timestamptz,numeric,text,text) from public;
revoke all on function public.resolve_alert(uuid,text) from public;
revoke all on function public.attach_trip_file(text,uuid,uuid) from public;
revoke all on function public.refresh_operational_alerts() from public;

grant execute on function public.approve_trip(uuid) to authenticated;
grant execute on function public.schedule_trip(uuid,uuid,uuid) to authenticated;
grant execute on function public.start_trip(uuid,numeric) to authenticated;
grant execute on function public.complete_trip(uuid,numeric,boolean) to authenticated;
grant execute on function public.issue_trip_advance(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.issue_trip_advance(uuid,uuid,timestamptz,numeric,text,text,uuid) to authenticated;
grant execute on function public.close_settlement(uuid,numeric) to authenticated;
grant execute on function public.complete_work_order(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,timestamptz,timestamptz,numeric) to authenticated;
grant execute on function public.create_trip_invoice(uuid,uuid,text,text,date,date,numeric,numeric) to authenticated;
grant execute on function public.register_invoice_payment(uuid,timestamptz,numeric,text,text) to authenticated;
grant execute on function public.resolve_alert(uuid,text) to authenticated;
grant execute on function public.attach_trip_file(text,uuid,uuid) to authenticated;
grant execute on function public.refresh_operational_alerts() to authenticated;
grant execute on all functions in schema public to service_role;
