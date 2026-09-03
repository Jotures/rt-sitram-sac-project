-- One-time controlled cutover for R&T SITRAM SAC before recording real operations.
-- Preserves the company, active access profiles, and the three approved vehicle masters.

begin;

delete from public.vehicle_latest_positions where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_odometer_plausibility_policy_requests where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_odometer_promotion_reviews where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_odometer_promotions where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_odometer_authorities where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_odometer_plausibility_policies where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_positions where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_provider_vehicle_links where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_sync_runs where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.gps_telemetry_retention_policies where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';

delete from public.trip_evaluation_exceptions where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.trip_evaluations where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.trip_evaluation_policies where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.work_order_evidence where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.work_order_parts where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.payments where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.invoices where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.documents where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.settlement_expenses where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.settlements where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.advances where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.expenses where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.fuel_entries where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.incidents where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.odometer_entries where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
-- This is the sole company in the project. The event log is append-only, so
-- a table-level truncate is the controlled maintenance path for pilot data.
truncate table public.trip_load_state_events;
delete from public.trip_status_events where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.trip_transition_requests where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.loads where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.trips where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.vehicle_status_history where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.driver_availability where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.work_orders where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.maintenance_plans where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.parts where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.suppliers where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.expense_categories where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.routes where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.clients where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.operational_cycles where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.drivers where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.files where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.alerts where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.audit_events where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f';
delete from public.spike_records;
delete from public.vehicles
where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f'
  and plate not in ('X3N-719', 'X2Y-756', 'VDR-768');

update public.vehicles
set current_status = 'available'
where company_id = 'da19ae99-00c5-4e25-8a32-9e8db78d466f'
  and plate in ('X3N-719', 'X2Y-756', 'VDR-768');

insert into public.audit_events (company_id, actor_id, action, entity_type, entity_id, after_data, reason)
values (
  'da19ae99-00c5-4e25-8a32-9e8db78d466f',
  null,
  'CONTROLLED_PRODUCTION_CUTOVER',
  'company',
  'da19ae99-00c5-4e25-8a32-9e8db78d466f',
  jsonb_build_object(
    'retained_vehicle_plates', jsonb_build_array('X3N-719', 'X2Y-756', 'VDR-768'),
    'backup', 'evidence/cutover-20260901/public-before-cleanup.jsonl'
  ),
  'Limpieza autorizada de datos ficticios antes del inicio de la operación real.'
);

commit;
