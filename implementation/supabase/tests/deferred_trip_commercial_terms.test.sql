begin;
set local search_path = extensions, public, auth;
select plan(41);

select has_column('public', 'trips', 'pickup_location', 'trip stores one optional pickup location');
select has_function(
  'public', 'create_trip_draft',
  array['uuid','text','text','text','timestamp with time zone','text','numeric','freight_pricing_mode','numeric','numeric'],
  'deferred commercial trip creation command exists'
);
select has_function(
  'public', 'set_trip_commercial_terms',
  array['uuid','uuid','text','numeric','freight_pricing_mode','numeric','numeric','integer','text'],
  'audited commercial completion command exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_trip_draft(uuid,text,text,text,timestamptz,text,numeric,public.freight_pricing_mode,numeric,numeric)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.set_trip_commercial_terms(uuid,uuid,text,numeric,public.freight_pricing_mode,numeric,numeric,integer,text)',
    'EXECUTE'
  ),
  'authenticated sessions can call the narrow commands'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_trip_draft(uuid,text,text,text,timestamptz,text,numeric,public.freight_pricing_mode,numeric,numeric)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.set_trip_commercial_terms(uuid,uuid,text,numeric,public.freight_pricing_mode,numeric,numeric,integer,text)',
    'EXECUTE'
  ),
  'anonymous sessions cannot call the commercial commands'
);
select ok(
  not has_table_privilege('authenticated', 'public.trips', 'INSERT')
  and not has_table_privilege('authenticated', 'public.loads', 'INSERT')
  and not has_table_privilege('authenticated', 'public.loads', 'UPDATE'),
  'authenticated clients cannot bypass trip or load commands'
);

insert into public.companies (id, legal_name)
values
  ('a0000000-0000-4000-8000-000000000001', 'DEFERRED TERMS COMPANY A'),
  ('a0000000-0000-4000-8000-000000000002', 'DEFERRED TERMS COMPANY B');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('a1000000-0000-4000-8000-000000000001', 'deferred-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000002', 'deferred-administration-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000003', 'deferred-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000004', 'deferred-accounting-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000005', 'deferred-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Deferred management A', 'management'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Deferred administration A', 'administration'),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Deferred driver A', 'driver'),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Deferred accounting A', 'accounting'),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'Deferred management B', 'management');

insert into public.clients (id, company_id, legal_name)
values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'DEFERRED CLIENT A'),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'DEFERRED CLIENT B');

insert into public.vehicles (id, company_id, plate, current_odometer_km)
values ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'DEF-001', 1000);

insert into public.drivers (id, company_id, profile_id, display_name)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000003',
  'Deferred driver A'
);

create temporary table deferred_terms_state (
  trip_id uuid not null,
  load_id uuid not null
);
grant select on deferred_terms_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.create_trip_draft(
    'a2000000-0000-4000-8000-000000000001', 'Cusco', 'Urcos', 'Arequipa',
    now() - interval '2 hours', 'Carga por pesar', null, null, null, null
  )$$,
  'management creates an operational trip without weight or freight'
);
reset role;
insert into deferred_terms_state (trip_id, load_id)
select t.id, l.id
from public.trips t
join public.loads l on l.trip_id = t.id
where t.origin = 'Cusco';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select is((select origin from public.trips where origin = 'Cusco'), 'Cusco', 'origin stores vehicle departure');
select is((select pickup_location from public.trips where origin = 'Cusco'), 'Urcos', 'pickup stores the optional intermediate point');
select is((select freight_amount from public.trips where origin = 'Cusco'), null::numeric, 'pending freight is NULL');
select is((select freight_pricing_mode::text from public.trips where origin = 'Cusco'), null::text, 'pending pricing mode is NULL');
select is((select l.tons from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'), null::numeric, 'pending cargo weight is NULL');

select lives_ok(
  $$select public.approve_trip((select id from public.trips where origin = 'Cusco'))$$,
  'missing commercial terms do not block trip approval'
);
select lives_ok(
  $$select public.schedule_trip(
    (select id from public.trips where origin = 'Cusco'),
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'staff_assisted'::public.trip_capture_mode
  )$$,
  'missing commercial terms do not block scheduling'
);
reset role;
update public.trips
set capture_mode_changed_at = now() - interval '1 hour'
where origin = 'Cusco';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.record_staff_trip_transition(
    'a5000000-0000-4000-8000-000000000001',
    (select id from public.trips where origin = 'Cusco'),
    'start', 1010, false, now() - interval '50 minutes', 'empty',
    (select version from public.trips where origin = 'Cusco'), 'Salida hacia punto de carga'
  )$$,
  'trip starts empty while weight remains unknown'
);
select lives_ok(
  $$select public.record_staff_trip_transition(
    'a5000000-0000-4000-8000-000000000002',
    (select id from public.trips where origin = 'Cusco'),
    'arrive', null, false, now() - interval '30 minutes', null,
    (select version from public.trips where origin = 'Cusco'), 'Llegada a destino'
  )$$,
  'trip advances after pickup without commercial weight'
);
select lives_ok(
  $$select public.record_staff_trip_transition(
    'a5000000-0000-4000-8000-000000000003',
    (select id from public.trips where origin = 'Cusco'),
    'complete', 1100, true, now() - interval '10 minutes', null,
    (select version from public.trips where origin = 'Cusco'), 'Carga entregada'
  )$$,
  'trip completes while commercial terms remain pending'
);
select is((select operational_status::text from public.trips where origin = 'Cusco'), 'completed', 'operational completion is independent from commercial completion');
select lives_ok(
  $$select public.close_settlement(
    (select id from public.settlements where trip_id = (select id from public.trips where origin = 'Cusco')),
    null, null, 'Rendición sin movimientos'
  )$$,
  'settlement closure remains independent from commercial terms'
);
select throws_ok(
  $$select public.create_trip_invoice(
    (select id from public.trips where origin = 'Cusco'),
    'a2000000-0000-4000-8000-000000000001', 'F001', '1', current_date, current_date + 15, 1000, 180
  )$$,
  '23514', null, 'invoice is blocked while weight and freight are pending'
);

select lives_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', null, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), null
  )$$,
  'rate per ton can be recorded before the weight'
);
select is((select freight_amount from public.trips where origin = 'Cusco'), null::numeric, 'per-ton total stays pending until all loads are weighed');
select lives_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 12.345, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), null
  )$$,
  'weight completes an existing per-ton quote without a correction reason'
);
select is((select freight_amount from public.trips where origin = 'Cusco'), 1234.50::numeric, 'server calculates and rounds per-ton freight');
select is((select commercial_terms_complete from public.report_trip_facts where origin = 'Cusco'), true, 'report marks complete commercial terms');
select is((select contracted_revenue from public.report_trip_facts where origin = 'Cusco'), 1234.50::numeric, 'report exposes confirmed freight only');
select lives_ok(
  $$select public.create_trip_invoice(
    (select id from public.trips where origin = 'Cusco'),
    'a2000000-0000-4000-8000-000000000001', 'F001', '1', current_date, current_date + 15, 1000, 180
  )$$,
  'invoice is enabled once weight and freight are complete'
);
select throws_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 13, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), 'Corrección posterior'
  )$$,
  '55000', null, 'active invoice locks commercial corrections'
);
select ok(
  exists (
    select 1 from public.audit_events
    where action = 'TRIP_COMMERCIAL_TERMS_UPDATED'
      and entity_id = (select id from public.trips where origin = 'Cusco')
  ),
  'commercial changes are audited'
);
select lives_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 12.345, 'per_ton', null, 100, 1, null
  )$$,
  'exact retries are harmless even with an old expected version'
);

reset role;
update public.invoices set status = 'cancelled'
where trip_id = (select id from public.trips where origin = 'Cusco');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 13, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), null
  )$$,
  '23514', null, 'a correction after confirmation requires a reason'
);
select lives_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 13, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), 'Ticket de balanza corregido'
  )$$,
  'cancelled invoice unlocks an audited correction'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 13, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), 'No autorizado'
  )$$,
  '42501', null, 'driver cannot edit commercial terms'
);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.set_trip_commercial_terms(
    (select id from public.trips where origin = 'Cusco'),
    (select l.id from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Cusco'),
    'Urcos', 13, 'per_ton', null, 100,
    (select version from public.trips where origin = 'Cusco'), 'No autorizado'
  )$$,
  '42501', null, 'accounting cannot edit commercial terms'
);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.set_trip_commercial_terms(
    (select trip_id from deferred_terms_state),
    (select load_id from deferred_terms_state),
    'Urcos', 13, 'per_ton', null, 100,
    1, 'Otra empresa'
  )$$,
  'P0002', null, 'another company cannot see or edit the trip'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.create_trip_draft(
    'a2000000-0000-4000-8000-000000000001', 'Lima', null, 'Ica',
    now() + interval '1 day', 'Carga con monto conocido', null, 'total', 500, null
  )$$,
  'administration can record total freight while weight remains pending'
);
select is((select freight_amount from public.trips where origin = 'Lima'), 500::numeric, 'known total freight is preserved');

reset role;
update public.trips
set vehicle_id = 'a3000000-0000-4000-8000-000000000001'
where origin = 'Lima';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select is((select commercial_terms_complete from public.report_trip_facts where origin = 'Lima'), false, 'known freight without weight remains incomplete');
select is((select contracted_revenue from public.report_trip_facts where origin = 'Lima'), null::numeric, 'incomplete report revenue is not coerced to zero');
select lives_ok(
  $$select public.create_trip_with_load(
    'a2000000-0000-4000-8000-000000000001', 'Tacna', 'Moquegua', now() + interval '2 days',
    700, 'Carga compatible', null
  )$$,
  'legacy trip creation contract remains available'
);
select throws_ok(
  $$select public.create_trip_draft(
    'a2000000-0000-4000-8000-000000000001', 'Piura', null, 'Lima',
    now() + interval '3 days', 'Carga con cero inválido', null, 'total', 0, null
  )$$,
  '23514', null, 'new commands never use zero as a pending freight value'
);

select * from finish(true);
rollback;
