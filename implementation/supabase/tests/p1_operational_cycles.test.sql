begin;
set local search_path = extensions, public, auth;
select plan(25);

select has_type('public', 'operational_cycle_leg_kind', 'cycle leg kind is explicit');
select has_column('public', 'operational_cycles', 'version', 'cycles use optimistic concurrency');
select has_column('public', 'operational_cycles', 'idempotency_key', 'cycles retain idempotency identity');
select has_column('public', 'trips', 'cycle_leg_kind', 'trips retain their cycle leg kind');
select has_column('public', 'trips', 'cycle_sequence', 'trips retain their cycle sequence');
select ok(
  not has_table_privilege('authenticated', 'public.operational_cycles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.operational_cycles', 'UPDATE'),
  'cycles cannot be written directly by authenticated users'
);
select has_function(
  'public', 'create_operational_cycle',
  array['uuid','text','uuid','uuid','return_status','text','uuid'],
  'cycle creation command exists'
);
select has_function(
  'public', 'add_trip_to_operational_cycle',
  array['uuid','uuid','operational_cycle_leg_kind','integer'],
  'cycle trip assignment command exists'
);
select has_function(
  'public', 'remove_trip_from_operational_cycle',
  array['uuid','uuid','integer','text'],
  'cycle trip removal command exists'
);
select ok(
  not has_function_privilege('anon', 'public.create_operational_cycle(uuid,text,uuid,uuid,return_status,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.create_operational_cycle(uuid,text,uuid,uuid,return_status,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_operational_cycle(uuid,integer,operational_cycle_status,return_status,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.update_operational_cycle(uuid,integer,operational_cycle_status,return_status,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.add_trip_to_operational_cycle(uuid,uuid,operational_cycle_leg_kind,integer)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.add_trip_to_operational_cycle(uuid,uuid,operational_cycle_leg_kind,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.remove_trip_from_operational_cycle(uuid,uuid,integer,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.remove_trip_from_operational_cycle(uuid,uuid,integer,text)', 'EXECUTE'),
  'cycle commands are not callable anonymously or by bare service role'
);

insert into public.companies (id, legal_name)
values ('d1000000-0000-4000-8000-000000000001', 'P1 CYCLES COMPANY');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('d1100000-0000-4000-8000-000000000001', 'p1-cycles-management@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('d1200000-0000-4000-8000-000000000002', 'p1-cycles-driver@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role)
values
  ('d1100000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'P1 Cycles Management', 'management'),
  ('d1200000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'P1 Cycles Driver', 'driver');
insert into public.clients (id, company_id, legal_name)
values ('d1300000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'P1 CYCLES CLIENT');
insert into public.vehicles (id, company_id, plate)
values
  ('d1400000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'CYC-001'),
  ('d1500000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000001', 'CYC-002');
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, origin, destination, scheduled_at,
  operational_status, created_by
) values
  ('d1600000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000001', 'CYCLE-OUTBOUND', 'd1300000-0000-4000-8000-000000000003', 'd1400000-0000-4000-8000-000000000004', 'Cusco', 'Lima', now(), 'scheduled', 'd1100000-0000-4000-8000-000000000001'),
  ('d1700000-0000-4000-8000-000000000007', 'd1000000-0000-4000-8000-000000000001', 'CYCLE-WRONG-VEHICLE', 'd1300000-0000-4000-8000-000000000003', 'd1500000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'scheduled', 'd1100000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.create_operational_cycle(
    'd1800000-0000-4000-8000-000000000008', 'CYC-2026-001',
    'd1400000-0000-4000-8000-000000000004', null, 'probable',
    'Retorno por confirmar', 'd1900000-0000-4000-8000-000000000009'
  )$$,
  'management creates a planned cycle for one vehicle'
);
select is(
  (select status::text from public.operational_cycles where id = 'd1800000-0000-4000-8000-000000000008'),
  'planned',
  'new cycle starts planned'
);
select is(
  (public.create_operational_cycle(
    'd1800000-0000-4000-8000-000000000008', 'CYC-2026-001',
    'd1400000-0000-4000-8000-000000000004', null, 'probable',
    'Retorno por confirmar', 'd1900000-0000-4000-8000-000000000009'
  )).id,
  'd1800000-0000-4000-8000-000000000008'::uuid,
  'exact cycle replay returns the original cycle'
);
select lives_ok(
  $$select public.add_trip_to_operational_cycle(
    'd1800000-0000-4000-8000-000000000008',
    'd1600000-0000-4000-8000-000000000006', 'outbound', 1
  )$$,
  'assigned trip is added as an outbound leg'
);
select is(
  (select cycle_leg_kind::text from public.trips where id = 'd1600000-0000-4000-8000-000000000006'),
  'outbound',
  'assigned trip retains its explicit leg kind'
);
select is(
  (select cycle_sequence from public.trips where id = 'd1600000-0000-4000-8000-000000000006'),
  1,
  'first cycle trip receives sequence one'
);
select throws_ok(
  $$select public.add_trip_to_operational_cycle(
    'd1800000-0000-4000-8000-000000000008',
    'd1700000-0000-4000-8000-000000000007', 'return', 2
  )$$,
  '23514', 'Cycle trip must use the cycle vehicle',
  'a trip from another vehicle cannot enter the cycle'
);
select lives_ok(
  $$select public.remove_trip_from_operational_cycle(
    'd1800000-0000-4000-8000-000000000008',
    'd1600000-0000-4000-8000-000000000006', 2, 'Servicio reasignado'
  )$$,
  'staff can remove a leg with an auditable reason while the cycle is open'
);
select ok(
  (select cycle_id is null and cycle_leg_kind is null and cycle_sequence is null
   from public.trips where id = 'd1600000-0000-4000-8000-000000000006'),
  'removing a cycle leg clears all cycle relationship fields'
);
select lives_ok(
  $$select public.add_trip_to_operational_cycle(
    'd1800000-0000-4000-8000-000000000008',
    'd1600000-0000-4000-8000-000000000006', 'continuation', 3
  )$$,
  'a removed trip can be explicitly re-added as a continuation'
);
select lives_ok(
  $$select public.update_operational_cycle(
    'd1800000-0000-4000-8000-000000000008', 4, 'active', 'confirmed', 'Retorno confirmado'
  )$$,
  'staff activates a cycle with an explicit return state'
);
select throws_ok(
  $$select public.update_operational_cycle(
    'd1800000-0000-4000-8000-000000000008', 5, 'completed', 'completed', 'Cierre anticipado'
  )$$,
  '23514', 'Every cycle trip must finish before completing the cycle',
  'open cycle cannot close while a constituent trip is still active'
);

reset role;
update public.trips
set operational_status = 'completed'
where id = 'd1600000-0000-4000-8000-000000000006';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1100000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.update_operational_cycle(
    'd1800000-0000-4000-8000-000000000008', 5, 'completed', 'completed', 'Ciclo terminado'
  )$$,
  'cycle closes only after every constituent trip ends'
);
select is(
  (select count(*)::integer from public.audit_events
   where entity_type = 'operational_cycle' and entity_id = 'd1800000-0000-4000-8000-000000000008'),
  6,
  'cycle creation, leg changes and lifecycle changes are audited'
);

select set_config('request.jwt.claim.sub', 'd1200000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.create_operational_cycle(
    'da000000-0000-4000-8000-00000000000a', 'DRIVER-CYCLE',
    'd1400000-0000-4000-8000-000000000004', null, 'unidentified', null,
    'db000000-0000-4000-8000-00000000000b'
  )$$,
  '42501', 'Not authorized for this operation',
  'driver cannot create an operational cycle'
);

select * from finish(true);
rollback;
