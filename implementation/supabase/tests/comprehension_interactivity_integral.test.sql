begin;
set local search_path = extensions, public, auth;
select plan(37);

select has_column('public', 'trips', 'freight_pricing_mode', 'trip capture stores its pricing mode');
select has_column('public', 'trips', 'freight_rate_per_ton', 'trip capture stores its rate only when applicable');
select has_column('public', 'documents', 'updated_at', 'documents expose a concurrency revision for private attachment');
select has_function('public', 'create_trip_with_load', array['uuid','text','text','timestamp with time zone','numeric','text','numeric','freight_pricing_mode','numeric'], 'per-ton trip command exists');
select has_function('public', 'update_client_master', array['uuid','timestamp with time zone','text','text','text','text','text','integer','client_relationship_type','boolean','text'], 'client master command exists');
select has_function('public', 'update_vehicle_master', array['uuid','timestamp with time zone','text','text','text','integer','numeric','vehicle_ownership_type','text','boolean','text'], 'vehicle master command exists');
select has_function('public', 'update_driver_master', array['uuid','timestamp with time zone','text','text','text','text','text','date','text','date','date','uuid','boolean','text'], 'driver master command exists');
select has_function('public', 'set_driver_availability', array['uuid','timestamp with time zone','driver_status','text'], 'controlled availability command exists');
select has_function('public', 'create_supplier', array['text','text','text','text','text','text','text'], 'supplier creation command exists');
select has_function('public', 'attach_document_file', array['uuid','uuid','timestamp with time zone'], 'document attachment command exists');
select ok(
  has_function_privilege('authenticated', 'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.attach_document_file(uuid,uuid,timestamptz)', 'EXECUTE'),
  'authenticated sessions receive the audited human-first commands'
);
select ok(
  not has_function_privilege('anon', 'public.create_trip_with_load(uuid,text,text,timestamptz,numeric,text,numeric,public.freight_pricing_mode,numeric)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_client_master(uuid,timestamptz,text,text,text,text,text,integer,public.client_relationship_type,boolean,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.attach_document_file(uuid,uuid,timestamptz)', 'EXECUTE'),
  'anonymous clients cannot call the new commands'
);

insert into public.companies (id, legal_name)
values
  ('c0000000-0000-4000-8000-000000000001', 'COMPREHENSION COMPANY A'),
  ('c0000000-0000-4000-8000-000000000002', 'COMPREHENSION COMPANY B');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('c1000000-0000-4000-8000-000000000001', 'comprehension-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('c2000000-0000-4000-8000-000000000002', 'comprehension-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('c3000000-0000-4000-8000-000000000003', 'comprehension-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Comprehension management A', 'management'),
  ('c2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Comprehension driver A', 'driver'),
  ('c3000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Comprehension management B', 'management');

insert into public.clients (id, company_id, legal_name, trade_name)
values
  ('c4000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'COMPREHENSION CLIENT A', 'Cliente humano A'),
  ('c4000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'COMPREHENSION CLIENT B', 'Cliente humano B');

insert into public.vehicles (id, company_id, plate, current_odometer_km)
values
  ('c5000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'CMP-A01', 1234),
  ('c5000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'CMP-B01', 5678);

insert into public.drivers (id, company_id, profile_id, display_name)
values
  ('c6000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'Conductor humano A');

insert into public.files (id, company_id, original_name, mime_type, size_bytes, storage_path, uploaded_by)
values
  ('c7000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'documento-a.pdf', 'application/pdf', 20, 'companies/c0000000-0000-4000-8000-000000000001/documento-a.pdf', 'c1000000-0000-4000-8000-000000000001'),
  ('c7000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000002', 'documento-b.pdf', 'application/pdf', 20, 'companies/c0000000-0000-4000-8000-000000000002/documento-b.pdf', 'c3000000-0000-4000-8000-000000000003');

insert into public.documents (id, company_id, document_type, entity_type, vehicle_id, created_by)
values ('c8000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000001', 'SOAT', 'vehicle', 'c5000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.create_trip_with_load(
    'c4000000-0000-4000-8000-000000000004', 'Lima', 'Arequipa', now() + interval '1 day', 999,
    'Carga por tonelada', 2.5, 'per_ton'::public.freight_pricing_mode, 10.1234
  )$$,
  'management can create a trip with a per-ton rate'
);
select is((select freight_amount from public.trips where origin = 'Lima' and destination = 'Arequipa'), 25.31::numeric, 'server rounds the per-ton total to two decimals');
select is((select freight_rate_per_ton from public.trips where origin = 'Lima' and destination = 'Arequipa'), 10.1234::numeric, 'server retains the rate at four decimals');
select is((select tons from public.loads l join public.trips t on t.id = l.trip_id where t.origin = 'Lima' and t.destination = 'Arequipa'), 2.5::numeric, 'loads retain canonical tons');
select lives_ok(
  $$select public.create_trip_with_load(
    'c4000000-0000-4000-8000-000000000004', 'Lima', 'Ica', now() + interval '2 days', 350,
    'Carga histórica sin tonelaje', null
  )$$,
  'legacy trip command remains compatible with omitted historic tonnage'
);
select is((select freight_pricing_mode::text from public.trips where origin = 'Lima' and destination = 'Ica'), 'total', 'legacy trip calls remain total-price records');
select is((select freight_rate_per_ton from public.trips where origin = 'Lima' and destination = 'Ica'), null::numeric, 'legacy trip calls do not invent a rate');
select throws_ok(
  $$select public.create_trip_with_load(
    'c4000000-0000-4000-8000-000000000004', 'Lima', 'Tacna', now() + interval '3 days', 1,
    'Carga inválida', 1, 'per_ton'::public.freight_pricing_mode, null
  )$$,
  '23514', null, 'per-ton capture requires a positive rate'
);

select lives_ok(
  $$select public.create_supplier('GRIFO HUMANO A', 'Grifo visible', '20100000001', 'grifo', '999000111', null, 'Prueba')$$,
  'management can create a supplier through the audited command'
);
select ok(exists (select 1 from public.audit_events where action = 'SUPPLIER_CREATED' and entity_type = 'supplier'), 'supplier creation has an audit event');

select lives_ok(
  $$select public.update_client_master(
    'c4000000-0000-4000-8000-000000000004',
    (select updated_at from public.clients where id = 'c4000000-0000-4000-8000-000000000004'),
    'COMPREHENSION CLIENT A', 'Cliente humano actualizado', null, '999888777', 'Lima', 30,
    'direct'::public.client_relationship_type, true, 'Pago mensual'
  )$$,
  'management can update only authorized client master data'
);
select is((select trade_name from public.clients where id = 'c4000000-0000-4000-8000-000000000004'), 'Cliente humano actualizado', 'client changes are saved');
select ok(exists (select 1 from public.audit_events where action = 'CLIENT_MASTER_UPDATED' and entity_id = 'c4000000-0000-4000-8000-000000000004'), 'client master change is audited');

select lives_ok(
  $$select public.update_vehicle_master(
    'c5000000-0000-4000-8000-000000000006',
    (select updated_at from public.vehicles where id = 'c5000000-0000-4000-8000-000000000006'),
    'CMP-A01', 'Volvo', 'FH', 2024, 28, 'owned'::public.vehicle_ownership_type, null, true, 'Unidad principal'
  )$$,
  'management can update vehicle identity without an odometer input'
);
select is((select current_odometer_km from public.vehicles where id = 'c5000000-0000-4000-8000-000000000006'), 1234::numeric, 'vehicle master command cannot change the official odometer');
select ok(not has_table_privilege('authenticated', 'public.vehicles', 'UPDATE'), 'direct vehicle master updates are revoked');

select throws_ok(
  $$select public.set_driver_availability(
    'c6000000-0000-4000-8000-000000000008',
    (select updated_at from public.drivers where id = 'c6000000-0000-4000-8000-000000000008'),
    'rest'::public.driver_status, null
  )$$,
  '23514', null, 'a non-available driver status requires a reason'
);
select lives_ok(
  $$select public.set_driver_availability(
    'c6000000-0000-4000-8000-000000000008',
    (select updated_at from public.drivers where id = 'c6000000-0000-4000-8000-000000000008'),
    'rest'::public.driver_status, 'Descanso semanal'
  )$$,
  'management can set a controlled driver availability'
);
select is((select current_status::text from public.drivers where id = 'c6000000-0000-4000-8000-000000000008'), 'rest', 'controlled availability updates the driver projection');
select ok(exists (select 1 from public.audit_events where action = 'DRIVER_AVAILABILITY_SET' and entity_id = 'c6000000-0000-4000-8000-000000000008'), 'driver availability is audited');

select set_config('request.jwt.claim.sub', 'c2000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.update_client_master(
    'c4000000-0000-4000-8000-000000000004', now(), 'No permitido', null, null, null, null, 0,
    'direct'::public.client_relationship_type, true, null
  )$$,
  '42501', null, 'drivers cannot change a client master record'
);

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.attach_document_file(
    'c8000000-0000-4000-8000-00000000000b',
    'c7000000-0000-4000-8000-000000000009',
    (select updated_at from public.documents where id = 'c8000000-0000-4000-8000-00000000000b')
  )$$,
  'management can attach a private file that belongs to its company'
);
select is((select file_id from public.documents where id = 'c8000000-0000-4000-8000-00000000000b'), 'c7000000-0000-4000-8000-000000000009'::uuid, 'document retains only the authorized file ID');
select ok(exists (select 1 from public.audit_events where action = 'DOCUMENT_FILE_ATTACHED' and entity_id = 'c8000000-0000-4000-8000-00000000000b'), 'document attachment is audited');
select throws_ok(
  $$select public.attach_document_file(
    'c8000000-0000-4000-8000-00000000000b',
    'c7000000-0000-4000-8000-00000000000a',
    (select updated_at from public.documents where id = 'c8000000-0000-4000-8000-00000000000b')
  )$$,
  '23514', null, 'a document cannot attach a private file from another company'
);

select * from finish(true);
rollback;
