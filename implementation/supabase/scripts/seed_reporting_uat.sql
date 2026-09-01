-- Synthetic UAT data for DEC-041 reporting. This script is intentionally
-- idempotent and tags every record so it is distinguishable from operations.
-- It creates facts only after the reporting deployment baseline; it does not
-- reconstruct pre-deployment history.

begin;

do $$
declare
  v_company_id uuid;
  v_actor_id uuid;
  v_available_from timestamptz;
  v_finished_at timestamptz;
  v_started_at timestamptz;
  v_midpoint_at timestamptz;
  v_status_start timestamptz;
  v_status_first timestamptz;
  v_status_second timestamptz;
  v_client_a_id uuid;
  v_client_b_id uuid;
  v_route_a_id uuid;
  v_route_b_id uuid;
  v_supplier_id uuid;
  v_expense_category_id uuid;
  v_driver_id uuid;
  v_vehicle_a_id uuid;
  v_vehicle_b_id uuid;
  v_vehicle_c_id uuid;
  v_cycle_a_id uuid;
  v_cycle_b_id uuid;
  v_cycle_c_id uuid;
  v_trip_a_id uuid;
  v_trip_b_id uuid;
  v_trip_c_id uuid;
  v_report_date date;
begin
  select c.id into v_company_id
  from public.companies c
  where c.legal_name = 'R&T SITRAM SAC' and c.active
  limit 1;
  if v_company_id is null then
    raise exception 'The R&T SITRAM company is required before loading reporting UAT data';
  end if;

  select p.id into v_actor_id
  from public.profiles p
  where p.company_id = v_company_id and p.active and p.role in ('management', 'administration')
  order by case p.role when 'management' then 0 else 1 end, p.created_at
  limit 1;
  if v_actor_id is null then
    raise exception 'An active management or administration profile is required for reporting UAT data';
  end if;

  select min(h.started_at) into v_available_from
  from public.vehicle_status_history h
  where h.company_id = v_company_id and h.source = 'baseline';
  if v_available_from is null then
    raise exception 'The reporting deployment baseline is required before loading UAT data';
  end if;

  v_finished_at := greatest(clock_timestamp() - interval '1 second', v_available_from + interval '1 second');
  v_started_at := greatest(v_available_from + interval '1 second', v_finished_at - interval '5 minutes');
  v_midpoint_at := v_started_at + ((v_finished_at - v_started_at) / 2);
  v_status_start := greatest(v_available_from + interval '1 second', v_finished_at - interval '4 minutes');
  v_status_first := v_status_start + ((v_finished_at - v_status_start) / 3);
  v_status_second := v_status_start + (((v_finished_at - v_status_start) * 2) / 3);
  v_report_date := (v_finished_at at time zone 'America/Lima')::date;

  -- Previous versions of this UAT script used implementation-oriented codes.
  -- Keep the stable IDs, but make every visible business label understandable.
  update public.routes set name = 'Lima → Huancayo'
  where company_id = v_company_id and name = 'UAT Reportes: Lima → Huancayo'
    and not exists (select 1 from public.routes where company_id = v_company_id and name = 'Lima → Huancayo');
  update public.routes set name = 'Lima → Ica'
  where company_id = v_company_id and name = 'UAT Reportes: Lima → Ica'
    and not exists (select 1 from public.routes where company_id = v_company_id and name = 'Lima → Ica');
  update public.vehicles set plate = 'BPF-218'
  where company_id = v_company_id and plate = 'UAT-RPT-101'
    and not exists (select 1 from public.vehicles where company_id = v_company_id and plate = 'BPF-218');
  update public.vehicles set plate = 'DMC-461'
  where company_id = v_company_id and plate = 'UAT-RPT-102'
    and not exists (select 1 from public.vehicles where company_id = v_company_id and plate = 'DMC-461');
  update public.vehicles set plate = 'FRT-702'
  where company_id = v_company_id and plate = 'UAT-RPT-103'
    and not exists (select 1 from public.vehicles where company_id = v_company_id and plate = 'FRT-702');
  update public.operational_cycles set code = 'CICLO-2026-001'
  where company_id = v_company_id and code = 'UAT-RPT-CICLO-001'
    and not exists (select 1 from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-001');
  update public.operational_cycles set code = 'CICLO-2026-002'
  where company_id = v_company_id and code = 'UAT-RPT-CICLO-002'
    and not exists (select 1 from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-002');
  update public.operational_cycles set code = 'CICLO-2026-003'
  where company_id = v_company_id and code = 'UAT-RPT-CICLO-003'
    and not exists (select 1 from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-003');
  update public.trips set code = 'RT-2026-021'
  where company_id = v_company_id and code = 'UAT-RPT-VIAJE-001'
    and not exists (select 1 from public.trips where company_id = v_company_id and code = 'RT-2026-021');
  update public.trips set code = 'RT-2026-022'
  where company_id = v_company_id and code = 'UAT-RPT-VIAJE-002'
    and not exists (select 1 from public.trips where company_id = v_company_id and code = 'RT-2026-022');
  update public.trips set code = 'RT-2026-023'
  where company_id = v_company_id and code = 'UAT-RPT-VIAJE-003'
    and not exists (select 1 from public.trips where company_id = v_company_id and code = 'RT-2026-023');
  update public.invoices set series = 'F001', number = '000121'
  where company_id = v_company_id and series = 'UAT' and number = 'RPT-001'
    and not exists (select 1 from public.invoices where company_id = v_company_id and series = 'F001' and number = '000121');
  update public.invoices set series = 'F001', number = '000122'
  where company_id = v_company_id and series = 'UAT' and number = 'RPT-002'
    and not exists (select 1 from public.invoices where company_id = v_company_id and series = 'F001' and number = '000122');
  update public.invoices set series = 'F002', number = '000043'
  where company_id = v_company_id and series = 'UAT' and number = 'RPT-003'
    and not exists (select 1 from public.invoices where company_id = v_company_id and series = 'F002' and number = '000043');
  update public.work_orders set code = 'OT-2026-014'
  where company_id = v_company_id and code = 'UAT-RPT-OT-001'
    and not exists (select 1 from public.work_orders where company_id = v_company_id and code = 'OT-2026-014');
  update public.work_orders set code = 'OT-2026-015'
  where company_id = v_company_id and code = 'UAT-RPT-OT-002'
    and not exists (select 1 from public.work_orders where company_id = v_company_id and code = 'OT-2026-015');
  update public.loads set description = 'Carga mineral', notes = 'Dato de demostración.'
  where company_id = v_company_id and description = 'Carga UAT Reportes A';
  update public.loads set description = 'Carga de alimentos', notes = 'Dato de demostración.'
  where company_id = v_company_id and description = 'Carga UAT Reportes B';
  update public.loads set description = 'Carga de repuestos', notes = 'Dato de demostración.'
  where company_id = v_company_id and description = 'Carga UAT Reportes C';
  update public.vehicle_status_history set reason = 'Viaje, espera y disponibilidad'
  where company_id = v_company_id and reason = 'UAT Reportes: viaje, espera y disponibilidad';
  update public.vehicle_status_history set reason = 'Viaje y taller'
  where company_id = v_company_id and reason = 'UAT Reportes: viaje y taller';
  update public.vehicle_status_history set reason = 'Fuera de servicio'
  where company_id = v_company_id and reason = 'UAT Reportes: fuera de servicio';

  insert into public.clients (
    company_id, legal_name, trade_name, tax_id, relationship_type, payment_terms_days, notes
  ) values
    (v_company_id, 'Transportes Andina S.A.C.', 'Transportes Andina', 'UAT-RPT-CLIENTE-A', 'direct', 15, 'Dato de demostración para validar Reportes.'),
    (v_company_id, 'Logística Costera S.A.C.', 'Logística Costera', 'UAT-RPT-CLIENTE-B', 'direct', 30, 'Dato de demostración para validar Reportes.')
  on conflict (company_id, tax_id) do update
    set legal_name = excluded.legal_name,
        trade_name = excluded.trade_name,
        payment_terms_days = excluded.payment_terms_days,
        notes = excluded.notes,
        active = true;
  select id into v_client_a_id from public.clients where company_id = v_company_id and tax_id = 'UAT-RPT-CLIENTE-A';
  select id into v_client_b_id from public.clients where company_id = v_company_id and tax_id = 'UAT-RPT-CLIENTE-B';

  insert into public.routes (company_id, name, origin, destination, reference_distance_km, notes)
  values
    (v_company_id, 'Lima → Huancayo', 'Lima', 'Huancayo', 180, 'Ruta de demostración para validar Reportes.'),
    (v_company_id, 'Lima → Ica', 'Lima', 'Ica', 220, 'Ruta de demostración para validar Reportes.')
  on conflict (company_id, name) do update
    set origin = excluded.origin,
        destination = excluded.destination,
        reference_distance_km = excluded.reference_distance_km,
        notes = excluded.notes,
        active = true;
  select id into v_route_a_id from public.routes where company_id = v_company_id and name = 'Lima → Huancayo';
  select id into v_route_b_id from public.routes where company_id = v_company_id and name = 'Lima → Ica';

  insert into public.suppliers (company_id, legal_name, trade_name, tax_id, supplier_type, notes)
  values (v_company_id, 'Estación y Taller Central S.A.C.', 'Estación Central', 'UAT-RPT-PROVEEDOR', 'fuel_and_maintenance', 'Dato de demostración para validar Reportes.')
  on conflict (company_id, tax_id) do update
    set legal_name = excluded.legal_name,
        trade_name = excluded.trade_name,
        supplier_type = excluded.supplier_type,
        notes = excluded.notes,
        active = true;
  select id into v_supplier_id from public.suppliers where company_id = v_company_id and tax_id = 'UAT-RPT-PROVEEDOR';

  insert into public.expense_categories (company_id, code, name)
  values (v_company_id, 'UAT-RPT-PEAJE', 'Peaje')
  on conflict (company_id, code) do update set name = excluded.name, active = true;
  select id into v_expense_category_id from public.expense_categories where company_id = v_company_id and code = 'UAT-RPT-PEAJE';

  insert into public.vehicles (
    company_id, plate, make, model, model_year, ownership_type, capacity_tons, current_odometer_km, notes
  ) values
    (v_company_id, 'BPF-218', 'Volvo', 'FMX', 2024, 'owned', 30, 100180, 'Unidad de demostración para validar Reportes.'),
    (v_company_id, 'DMC-461', 'Scania', 'P410', 2023, 'owned', 28, 110220, 'Unidad de demostración para validar Reportes.'),
    (v_company_id, 'FRT-702', 'Mercedes-Benz', 'Atego', 2022, 'owned', 25, 120200, 'Unidad de demostración para validar Reportes.')
  on conflict (company_id, plate) do update
    set make = excluded.make,
        model = excluded.model,
        model_year = excluded.model_year,
        capacity_tons = excluded.capacity_tons,
        current_odometer_km = excluded.current_odometer_km,
        notes = excluded.notes,
        active = true;
  select id into v_vehicle_a_id from public.vehicles where company_id = v_company_id and plate = 'BPF-218';
  select id into v_vehicle_b_id from public.vehicles where company_id = v_company_id and plate = 'DMC-461';
  select id into v_vehicle_c_id from public.vehicles where company_id = v_company_id and plate = 'FRT-702';

  insert into public.drivers (
    company_id, display_name, document_type, document_number, usual_vehicle_id, notes
  ) values (
    v_company_id, 'Luis Paredes', 'DNI', 'UAT-RPT-DRIVER-01', v_vehicle_a_id, 'Conductor de demostración para validar Reportes.'
  )
  on conflict (company_id, document_type, document_number) do update
    set display_name = excluded.display_name,
        usual_vehicle_id = excluded.usual_vehicle_id,
        notes = excluded.notes,
        active = true;
  select id into v_driver_id from public.drivers where company_id = v_company_id and document_type = 'DNI' and document_number = 'UAT-RPT-DRIVER-01';

  insert into public.operational_cycles (
    company_id, code, vehicle_id, primary_driver_id, status, return_status, started_at, ended_at, notes, created_by
  ) values
    (v_company_id, 'CICLO-2026-001', v_vehicle_a_id, v_driver_id, 'completed', 'empty_return', v_started_at, v_finished_at, 'Ciclo de demostración con retorno vacío', v_actor_id),
    (v_company_id, 'CICLO-2026-002', v_vehicle_b_id, v_driver_id, 'completed', 'empty_return', v_started_at, v_finished_at, 'Ciclo de demostración con gastos pendientes', v_actor_id),
    (v_company_id, 'CICLO-2026-003', v_vehicle_c_id, v_driver_id, 'completed', 'completed', v_started_at, v_finished_at, 'Ciclo de demostración en USD', v_actor_id)
  on conflict (company_id, code) do update
    set vehicle_id = excluded.vehicle_id,
        primary_driver_id = excluded.primary_driver_id,
        status = excluded.status,
        return_status = excluded.return_status,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        notes = excluded.notes;
  select id into v_cycle_a_id from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-001';
  select id into v_cycle_b_id from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-002';
  select id into v_cycle_c_id from public.operational_cycles where company_id = v_company_id and code = 'CICLO-2026-003';

  insert into public.trips (
    company_id, code, cycle_id, client_id, vehicle_id, driver_id, route_id, origin, destination,
    scheduled_at, started_at, operational_finished_at, financially_closed_at, operational_status,
    administrative_status, financial_status, freight_amount, additional_amount, currency, notes, created_by
  ) values
    (v_company_id, 'RT-2026-021', v_cycle_a_id, v_client_a_id, v_vehicle_a_id, v_driver_id, v_route_a_id, 'Lima', 'Huancayo', v_started_at, v_started_at, v_finished_at, v_finished_at, 'completed', 'settlement_closed', 'paid', 10000, 500, 'PEN', 'Viaje de demostración: margen directo confirmado', v_actor_id),
    (v_company_id, 'RT-2026-022', v_cycle_b_id, v_client_b_id, v_vehicle_b_id, v_driver_id, v_route_b_id, 'Lima', 'Ica', v_started_at, v_started_at, v_finished_at, null, 'completed', 'settlement_pending', 'partially_paid', 8000, 0, 'PEN', 'Viaje de demostración: gastos pendientes y margen provisional', v_actor_id),
    (v_company_id, 'RT-2026-023', v_cycle_c_id, v_client_a_id, v_vehicle_c_id, v_driver_id, v_route_a_id, 'Lima', 'Huancayo', v_started_at, v_started_at, v_finished_at, v_finished_at, 'completed', 'settlement_closed', 'paid', 2500, 0, 'USD', 'Viaje de demostración: moneda separada', v_actor_id)
  on conflict (company_id, code) do update
    set cycle_id = excluded.cycle_id,
        client_id = excluded.client_id,
        vehicle_id = excluded.vehicle_id,
        driver_id = excluded.driver_id,
        route_id = excluded.route_id,
        scheduled_at = excluded.scheduled_at,
        started_at = excluded.started_at,
        operational_finished_at = excluded.operational_finished_at,
        financially_closed_at = excluded.financially_closed_at,
        operational_status = excluded.operational_status,
        administrative_status = excluded.administrative_status,
        financial_status = excluded.financial_status,
        freight_amount = excluded.freight_amount,
        additional_amount = excluded.additional_amount,
        currency = excluded.currency,
        notes = excluded.notes;
  select id into v_trip_a_id from public.trips where company_id = v_company_id and code = 'RT-2026-021';
  select id into v_trip_b_id from public.trips where company_id = v_company_id and code = 'RT-2026-022';
  select id into v_trip_c_id from public.trips where company_id = v_company_id and code = 'RT-2026-023';

  insert into public.loads (company_id, trip_id, description, cargo_type, tons, notes)
  select v_company_id, v_trip_a_id, 'Carga mineral', 'Mineral', 22, 'Dato de demostración.'
  where not exists (select 1 from public.loads where company_id = v_company_id and trip_id = v_trip_a_id and description = 'Carga mineral');
  insert into public.loads (company_id, trip_id, description, cargo_type, tons, notes)
  select v_company_id, v_trip_b_id, 'Carga de alimentos', 'Alimentos', 18, 'Dato de demostración.'
  where not exists (select 1 from public.loads where company_id = v_company_id and trip_id = v_trip_b_id and description = 'Carga de alimentos');
  insert into public.loads (company_id, trip_id, description, cargo_type, tons, notes)
  select v_company_id, v_trip_c_id, 'Carga de repuestos', 'Repuestos', 10, 'Dato de demostración.'
  where not exists (select 1 from public.loads where company_id = v_company_id and trip_id = v_trip_c_id and description = 'Carga de repuestos');

  insert into public.odometer_entries (
    company_id, vehicle_id, trip_id, reading_km, reading_at, reading_type, source, recorded_by, source_device_id, idempotency_key
  ) values
    (v_company_id, v_vehicle_a_id, v_trip_a_id, 100000, v_started_at, 'start', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000101'),
    (v_company_id, v_vehicle_a_id, v_trip_a_id, 100180, v_finished_at, 'final', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000102'),
    (v_company_id, v_vehicle_b_id, v_trip_b_id, 110000, v_started_at, 'start', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000103'),
    (v_company_id, v_vehicle_b_id, v_trip_b_id, 110220, v_finished_at, 'final', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000104'),
    (v_company_id, v_vehicle_c_id, v_trip_c_id, 120000, v_started_at, 'start', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000105'),
    (v_company_id, v_vehicle_c_id, v_trip_c_id, 120200, v_finished_at, 'final', 'uat_seed', v_actor_id, 'uat-reportes', '92000000-0000-4000-8000-000000000106')
  on conflict (company_id, idempotency_key) do nothing;

  insert into public.trip_load_state_events (
    id, company_id, trip_id, vehicle_id, load_state, effective_at, odometer_km, recorded_by, source_device_id, idempotency_key
  ) values
    ('90000000-0000-4000-8000-000000000101', v_company_id, v_trip_a_id, v_vehicle_a_id, 'loaded', v_started_at, 100000, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000101'),
    ('90000000-0000-4000-8000-000000000102', v_company_id, v_trip_a_id, v_vehicle_a_id, 'empty', v_midpoint_at, 100100, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000102'),
    ('90000000-0000-4000-8000-000000000103', v_company_id, v_trip_b_id, v_vehicle_b_id, 'loaded', v_started_at, 110000, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000103'),
    ('90000000-0000-4000-8000-000000000104', v_company_id, v_trip_b_id, v_vehicle_b_id, 'empty', v_midpoint_at, 110140, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000104'),
    ('90000000-0000-4000-8000-000000000105', v_company_id, v_trip_c_id, v_vehicle_c_id, 'loaded', v_started_at, 120000, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000105'),
    ('90000000-0000-4000-8000-000000000106', v_company_id, v_trip_c_id, v_vehicle_c_id, 'empty', v_midpoint_at, 120120, v_actor_id, 'uat-reportes', '91000000-0000-4000-8000-000000000106')
  on conflict (company_id, idempotency_key) do nothing;

  if not exists (select 1 from public.fuel_entries where company_id = v_company_id and idempotency_key = '93000000-0000-4000-8000-000000000101') then
    insert into public.fuel_entries (company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, payment_method, validation_status, created_by, source_device_id, idempotency_key)
    values (v_company_id, v_trip_a_id, v_vehicle_a_id, v_driver_id, v_supplier_id, v_midpoint_at, 'Estación Central Lima', 100100, 80, 'liter', 4, 320, 'PEN', 'card', 'validated', v_actor_id, 'uat-reportes', '93000000-0000-4000-8000-000000000101');
  end if;
  if not exists (select 1 from public.fuel_entries where company_id = v_company_id and idempotency_key = '93000000-0000-4000-8000-000000000102') then
    insert into public.fuel_entries (company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, payment_method, validation_status, created_by, source_device_id, idempotency_key)
    values (v_company_id, v_trip_b_id, v_vehicle_b_id, v_driver_id, v_supplier_id, v_midpoint_at, 'Estación Central Ica', 110140, 55, 'liter', 4, 220, 'PEN', 'card', 'pending_review', v_actor_id, 'uat-reportes', '93000000-0000-4000-8000-000000000102');
  end if;
  if not exists (select 1 from public.fuel_entries where company_id = v_company_id and idempotency_key = '93000000-0000-4000-8000-000000000103') then
    insert into public.fuel_entries (company_id, trip_id, vehicle_id, driver_id, supplier_id, fueled_at, location, odometer_km, quantity, volume_unit, unit_price, total_amount, currency, payment_method, validation_status, created_by, source_device_id, idempotency_key)
    values (v_company_id, v_trip_c_id, v_vehicle_c_id, v_driver_id, v_supplier_id, v_midpoint_at, 'Estación Central Lima', 120120, 60, 'liter', 3, 180, 'USD', 'cash', 'validated', v_actor_id, 'uat-reportes', '93000000-0000-4000-8000-000000000103');
  end if;

  if not exists (select 1 from public.expenses where company_id = v_company_id and idempotency_key = '94000000-0000-4000-8000-000000000101') then
    insert into public.expenses (company_id, assignment_type, trip_id, vehicle_id, driver_id, category_id, supplier_id, incurred_at, amount, currency, description, source, validation_status, approved_amount, created_by, source_device_id, idempotency_key)
    values (v_company_id, 'trip', v_trip_a_id, v_vehicle_a_id, v_driver_id, v_expense_category_id, v_supplier_id, v_midpoint_at, 130, 'PEN', 'Peaje confirmado', 'uat_seed', 'validated', 130, v_actor_id, 'uat-reportes', '94000000-0000-4000-8000-000000000101');
  end if;
  if not exists (select 1 from public.expenses where company_id = v_company_id and idempotency_key = '94000000-0000-4000-8000-000000000102') then
    insert into public.expenses (company_id, assignment_type, trip_id, vehicle_id, driver_id, category_id, supplier_id, incurred_at, amount, currency, description, source, validation_status, approved_amount, created_by, source_device_id, idempotency_key)
    values (v_company_id, 'trip', v_trip_b_id, v_vehicle_b_id, v_driver_id, v_expense_category_id, v_supplier_id, v_midpoint_at, 90, 'PEN', 'Peaje pendiente', 'uat_seed', 'pending_review', null, v_actor_id, 'uat-reportes', '94000000-0000-4000-8000-000000000102');
  end if;
  if not exists (select 1 from public.expenses where company_id = v_company_id and idempotency_key = '94000000-0000-4000-8000-000000000103') then
    insert into public.expenses (company_id, assignment_type, trip_id, vehicle_id, driver_id, category_id, supplier_id, incurred_at, amount, currency, description, source, validation_status, approved_amount, created_by, source_device_id, idempotency_key)
    values (v_company_id, 'trip', v_trip_c_id, v_vehicle_c_id, v_driver_id, v_expense_category_id, v_supplier_id, v_midpoint_at, 75, 'USD', 'Peaje confirmado', 'uat_seed', 'validated', 75, v_actor_id, 'uat-reportes', '94000000-0000-4000-8000-000000000103');
  end if;

  if not exists (select 1 from public.settlements where company_id = v_company_id and trip_id = v_trip_a_id) then
    insert into public.settlements (company_id, trip_id, driver_id, started_at, submitted_at, approved_at, closed_at, total_advances, total_expenses, balance, status, notes, approved_by)
    values (v_company_id, v_trip_a_id, v_driver_id, v_started_at, v_finished_at, v_finished_at, v_finished_at, 0, 130, -130, 'closed', 'Rendición de demostración cerrada', v_actor_id);
  end if;
  if not exists (select 1 from public.settlements where company_id = v_company_id and trip_id = v_trip_b_id) then
    insert into public.settlements (company_id, trip_id, driver_id, started_at, total_advances, total_expenses, balance, status, notes)
    values (v_company_id, v_trip_b_id, v_driver_id, v_started_at, 0, 0, 0, 'pending', 'Rendición de demostración pendiente');
  end if;
  if not exists (select 1 from public.settlements where company_id = v_company_id and trip_id = v_trip_c_id) then
    insert into public.settlements (company_id, trip_id, driver_id, started_at, submitted_at, approved_at, closed_at, total_advances, total_expenses, balance, status, notes, approved_by)
    values (v_company_id, v_trip_c_id, v_driver_id, v_started_at, v_finished_at, v_finished_at, v_finished_at, 0, 75, -75, 'closed', 'Rendición de demostración cerrada en USD', v_actor_id);
  end if;

  insert into public.invoices (
    company_id, client_id, trip_id, series, number, issued_on, due_on, currency, subtotal, tax, total, status, notes, created_by
  ) values
    (v_company_id, v_client_a_id, v_trip_a_id, 'F001', '000121', v_report_date, v_report_date, 'PEN', 10500, 1890, 12390, 'partial', 'Factura de demostración con pago parcial', v_actor_id),
    (v_company_id, v_client_b_id, v_trip_b_id, 'F001', '000122', v_report_date, v_report_date, 'PEN', 8000, 1440, 9440, 'overdue', 'Factura de demostración con saldo pendiente', v_actor_id),
    (v_company_id, v_client_a_id, v_trip_c_id, 'F002', '000043', v_report_date, v_report_date, 'USD', 2500, 450, 2950, 'paid', 'Factura de demostración pagada en USD', v_actor_id)
  on conflict (company_id, series, number) do nothing;

  if not exists (select 1 from public.payments where company_id = v_company_id and idempotency_key = '95000000-0000-4000-8000-000000000101') then
    insert into public.payments (company_id, invoice_id, client_id, paid_at, amount, currency, payment_method, reference, notes, created_by, idempotency_key, cancelled_at, cancellation_reason)
    values (v_company_id, (select id from public.invoices where company_id = v_company_id and series = 'F001' and number = '000121'), v_client_a_id, v_finished_at, 6000, 'PEN', 'transfer', 'DEMO-PAGO-001', 'Pago parcial de demostración', v_actor_id, '95000000-0000-4000-8000-000000000101', null, null);
  end if;
  if not exists (select 1 from public.payments where company_id = v_company_id and idempotency_key = '95000000-0000-4000-8000-000000000102') then
    insert into public.payments (company_id, invoice_id, client_id, paid_at, amount, currency, payment_method, reference, notes, created_by, idempotency_key, cancelled_at, cancellation_reason)
    values (v_company_id, (select id from public.invoices where company_id = v_company_id and series = 'F001' and number = '000122'), v_client_b_id, v_finished_at, 1000, 'PEN', 'transfer', 'DEMO-PAGO-ANULADO', 'Pago anulado que no debe sumar', v_actor_id, '95000000-0000-4000-8000-000000000102', v_finished_at, 'Anulación de demostración');
  end if;
  if not exists (select 1 from public.payments where company_id = v_company_id and idempotency_key = '95000000-0000-4000-8000-000000000103') then
    insert into public.payments (company_id, invoice_id, client_id, paid_at, amount, currency, payment_method, reference, notes, created_by, idempotency_key, cancelled_at, cancellation_reason)
    values (v_company_id, (select id from public.invoices where company_id = v_company_id and series = 'F002' and number = '000043'), v_client_a_id, v_finished_at, 2950, 'USD', 'transfer', 'DEMO-PAGO-003', 'Pago total de demostración', v_actor_id, '95000000-0000-4000-8000-000000000103', null, null);
  end if;

  -- Closed operational intervals make the utilization and downtime tabs
  -- demonstrable without inventing any time before the baseline.
  if not exists (
    select 1 from public.vehicle_status_history
    where company_id = v_company_id and vehicle_id = v_vehicle_a_id and reason = 'Viaje, espera y disponibilidad'
  ) then
    insert into public.vehicle_status_history (company_id, vehicle_id, status, started_at, ended_at, reason, recorded_by, source)
    values
      (v_company_id, v_vehicle_a_id, 'available', v_status_start, v_status_first, 'Viaje, espera y disponibilidad', v_actor_id, 'system'),
      (v_company_id, v_vehicle_a_id, 'in_trip', v_status_first, v_status_second, 'Viaje, espera y disponibilidad', v_actor_id, 'system'),
      (v_company_id, v_vehicle_a_id, 'waiting_load', v_status_second, v_finished_at, 'Viaje, espera y disponibilidad', v_actor_id, 'system'),
      (v_company_id, v_vehicle_a_id, 'available', v_finished_at, null, 'Viaje, espera y disponibilidad', v_actor_id, 'system');
  end if;

  if not exists (
    select 1 from public.vehicle_status_history
    where company_id = v_company_id and vehicle_id = v_vehicle_b_id and reason = 'Viaje y taller'
  ) then
    insert into public.vehicle_status_history (company_id, vehicle_id, status, started_at, ended_at, reason, recorded_by, source)
    values
      (v_company_id, v_vehicle_b_id, 'in_trip', v_status_start, v_status_first, 'Viaje y taller', v_actor_id, 'system'),
      (v_company_id, v_vehicle_b_id, 'waiting_workshop', v_status_first, v_finished_at, 'Viaje y taller', v_actor_id, 'system');
  end if;

  if not exists (
    select 1 from public.vehicle_status_history
    where company_id = v_company_id and vehicle_id = v_vehicle_c_id and reason = 'Fuera de servicio'
  ) then
    insert into public.vehicle_status_history (company_id, vehicle_id, status, started_at, ended_at, reason, recorded_by, source)
    values
      (v_company_id, v_vehicle_c_id, 'out_of_service', v_status_start, v_status_first, 'Fuera de servicio', v_actor_id, 'system'),
      (v_company_id, v_vehicle_c_id, 'in_trip', v_status_first, v_status_second, 'Fuera de servicio', v_actor_id, 'system'),
      (v_company_id, v_vehicle_c_id, 'available', v_status_second, null, 'Fuera de servicio', v_actor_id, 'system');
  end if;

  if not exists (select 1 from public.work_orders where company_id = v_company_id and idempotency_key = '97000000-0000-4000-8000-000000000101') then
    insert into public.work_orders (company_id, code, vehicle_id, supplier_id, maintenance_type, source, admitted_at, started_at, finished_at, odometer_km, reported_problem, diagnosis, work_performed, labor_cost, parts_cost, currency, status, notes, blocks_operation, created_by, idempotency_key)
    values (v_company_id, 'OT-2026-014', v_vehicle_a_id, v_supplier_id, 'Mantenimiento preventivo', 'uat_seed', v_started_at, v_started_at, v_finished_at, 100180, 'Mantenimiento preventivo', 'Inspección aprobada', 'Cambio preventivo', 180, 120, 'PEN', 'finished', 'Orden cerrada de demostración', false, v_actor_id, '97000000-0000-4000-8000-000000000101');
  end if;
  if not exists (select 1 from public.work_orders where company_id = v_company_id and idempotency_key = '97000000-0000-4000-8000-000000000102') then
    insert into public.work_orders (company_id, code, vehicle_id, supplier_id, maintenance_type, source, admitted_at, started_at, finished_at, odometer_km, reported_problem, diagnosis, work_performed, labor_cost, parts_cost, currency, status, notes, blocks_operation, created_by, idempotency_key)
    values (v_company_id, 'OT-2026-015', v_vehicle_b_id, v_supplier_id, 'Reparación', 'uat_seed', v_finished_at, v_finished_at, null, 110220, 'Diagnóstico de frenos', 'En evaluación', null, 250, 0, 'PEN', 'in_progress', 'Orden abierta de demostración y bloqueante', true, v_actor_id, '97000000-0000-4000-8000-000000000102');
  end if;

  insert into public.audit_events (
    id, company_id, actor_id, action, entity_type, entity_id, after_data, reason
  ) values (
    '96000000-0000-4000-8000-000000000101', v_company_id, v_actor_id,
    'UAT_REPORTING_SYNTHETIC_SEED', 'reporting_uat_seed', '96000000-0000-4000-8000-000000000101',
    jsonb_build_object('trips', array['RT-2026-021', 'RT-2026-022', 'RT-2026-023'], 'marker', 'DEC-041 demonstration UAT'),
    'Datos de demostración autorizados para validar Reportes'
  ) on conflict (id) do nothing;
end;
$$;

commit;
