begin;
set local search_path = extensions, public, auth;
select plan(47);

select has_column('public', 'work_orders', 'idempotency_key', 'work orders retain idempotency identity');
select has_column('public', 'work_order_parts', 'idempotency_key', 'part lines retain idempotency identity');
select has_table('public', 'work_order_evidence', 'optional work order evidence has an explicit table');
select has_function(
  'public', 'create_work_order',
  array['uuid','uuid','uuid','text','text','timestamp with time zone','boolean','text','uuid'],
  'work order creation command exists'
);
select has_function(
  'public', 'update_work_order_progress',
  array['uuid','uuid','work_order_status','timestamp with time zone','timestamp with time zone','text','text','text','boolean'],
  'work order progress command exists'
);
select has_function(
  'public', 'record_work_order_part',
  array['uuid','uuid','uuid','uuid','numeric','numeric','timestamp with time zone','numeric','text','uuid'],
  'work order part command exists'
);
select has_function(
  'public', 'attach_work_order_evidence',
  array['uuid','uuid','uuid','text','uuid'],
  'work order evidence command exists'
);
select ok(
  not has_table_privilege('authenticated', 'public.work_orders', 'INSERT')
  and not has_table_privilege('authenticated', 'public.work_orders', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.work_order_parts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.work_order_parts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.work_order_evidence', 'INSERT')
  and not has_table_privilege('authenticated', 'public.work_order_evidence', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.work_order_evidence', 'DELETE')
  and not has_table_privilege('anon', 'public.work_order_evidence', 'SELECT'),
  'authenticated users cannot bypass maintenance commands through direct writes'
);
select ok(
  has_function_privilege('authenticated', 'public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_work_order_progress(uuid,uuid,work_order_status,timestamptz,timestamptz,text,text,text,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.create_work_order(uuid,uuid,uuid,text,text,timestamptz,boolean,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_work_order_progress(uuid,uuid,work_order_status,timestamptz,timestamptz,text,text,text,boolean)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.update_work_order_progress(uuid,uuid,work_order_status,timestamptz,timestamptz,text,text,text,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.record_work_order_part(uuid,uuid,uuid,uuid,numeric,numeric,timestamptz,numeric,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.attach_work_order_evidence(uuid,uuid,uuid,text,uuid)', 'EXECUTE'),
  'maintenance commands are exposed only to authenticated sessions'
);

insert into public.companies (id, legal_name)
values
  ('b2000000-0000-4000-8000-000000000001', 'P2 MAINTENANCE COMPANY A'),
  ('b2000000-0000-4000-8000-000000000002', 'P2 MAINTENANCE COMPANY B');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('b2100000-0000-4000-8000-000000000001', 'p2-maintenance-management-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b2200000-0000-4000-8000-000000000002', 'p2-maintenance-administration-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b2300000-0000-4000-8000-000000000003', 'p2-maintenance-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b2400000-0000-4000-8000-000000000004', 'p2-maintenance-management-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role)
values
  ('b2100000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'P2 Management A', 'management'),
  ('b2200000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'P2 Administration A', 'administration'),
  ('b2300000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'P2 Driver A', 'driver'),
  ('b2400000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000002', 'P2 Management B', 'management');

insert into public.vehicles (id, company_id, plate, current_odometer_km)
values
  ('b2500000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000001', 'P2-MNT-01', 900),
  ('b2500000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000002', 'P2-MNT-02', 800);

insert into public.suppliers (id, company_id, legal_name, supplier_type, active)
values
  ('b2600000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000001', 'P2 Taller A', 'maintenance', true),
  ('b2600000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000001', 'P2 Taller Inactivo', 'maintenance', false);

insert into public.parts (id, company_id, name, unit, active)
values
  ('b2700000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-000000000001', 'P2 Buje A', 'unidad', true),
  ('b2700000-0000-4000-8000-00000000000a', 'b2000000-0000-4000-8000-000000000001', 'P2 Buje B', 'unidad', true);

insert into public.files (
  id, company_id, original_name, mime_type, size_bytes, storage_path, uploaded_by
) values
  (
    'b2800000-0000-4000-8000-00000000000b',
    'b2000000-0000-4000-8000-000000000001',
    'p2-evidence-a.pdf', 'application/pdf', 100,
    'companies/b2000000-0000-4000-8000-000000000001/maintenance/p2-evidence-a.pdf',
    'b2200000-0000-4000-8000-000000000002'
  ),
  (
    'b2800000-0000-4000-8000-00000000000c',
    'b2000000-0000-4000-8000-000000000001',
    'p2-evidence-b.jpg', 'image/jpeg', 100,
    'companies/b2000000-0000-4000-8000-000000000001/maintenance/p2-evidence-b.jpg',
    'b2200000-0000-4000-8000-000000000002'
  ),
  (
    'b2800000-0000-4000-8000-00000000000d',
    'b2000000-0000-4000-8000-000000000002',
    'p2-evidence-b-company.pdf', 'application/pdf', 100,
    'companies/b2000000-0000-4000-8000-000000000002/maintenance/p2-evidence-b-company.pdf',
    'b2400000-0000-4000-8000-000000000004'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2200000-0000-4000-8000-000000000002', true);

select lives_ok(
  $$select public.create_work_order(
    'b2900000-0000-4000-8000-00000000000e',
    'b2500000-0000-4000-8000-000000000005',
    'b2600000-0000-4000-8000-000000000007',
    'Correctivo', 'Ruido en suspensión', '2026-08-29T08:00:00Z', true,
    'Unidad inmovilizada', 'b2a00000-0000-4000-8000-00000000000f'
  )$$,
  'administration creates an auditable work order'
);
select ok(
  (select code like 'OT-%' and status = 'scheduled' and blocks_operation
   from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e'),
  'server assigns the code and keeps the explicit initial blocking decision'
);
select is(
  (public.create_work_order(
    'b2900000-0000-4000-8000-00000000000e',
    'b2500000-0000-4000-8000-000000000005',
    'b2600000-0000-4000-8000-000000000007',
    'Correctivo', 'Ruido en suspensión', '2026-08-29T08:00:00Z', true,
    'Unidad inmovilizada', 'b2a00000-0000-4000-8000-00000000000f'
  )).id,
  'b2900000-0000-4000-8000-00000000000e'::uuid,
  'an exact work order creation replay returns the original order'
);
select is(
  (select count(*)::integer from public.work_orders
   where company_id = 'b2000000-0000-4000-8000-000000000001'
     and idempotency_key = 'b2a00000-0000-4000-8000-00000000000f'),
  1,
  'work order creation replay does not duplicate the order'
);
select throws_ok(
  $$select public.create_work_order(
    'b2b00000-0000-4000-8000-000000000010',
    'b2500000-0000-4000-8000-000000000006', null,
    'Correctivo', 'Vehículo ajeno', null, false, null,
    'b2c00000-0000-4000-8000-000000000011'
  )$$,
  '23514', null,
  'administration cannot create a work order for another company vehicle'
);
select throws_ok(
  $$insert into public.work_orders (
    id, company_id, code, vehicle_id, maintenance_type, source, created_by
  ) values (
    'b2d00000-0000-4000-8000-000000000012',
    'b2000000-0000-4000-8000-000000000001', 'DIRECT-P2-OT',
    'b2500000-0000-4000-8000-000000000005', 'Correctivo', 'administration',
    'b2200000-0000-4000-8000-000000000002'
  )$$,
  '42501', null,
  'direct work order insert is denied'
);
select lives_ok(
  $$select public.update_work_order_progress(
    'b2900000-0000-4000-8000-00000000000e',
    'b2600000-0000-4000-8000-000000000007', 'in_workshop',
    '2026-08-29T08:00:00Z', '2026-08-29T09:00:00Z', null, null,
    'Esperando diagnóstico', true
  )$$,
  'administration records work order progress without inventing a diagnosis'
);
select ok(
  (select status = 'in_workshop'
      and diagnosis is null
      and work_performed is null
      and started_at = '2026-08-29T09:00:00Z'::timestamptz
   from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e'),
  'progress stores only the actual optional fields supplied'
);
select set_config('request.jwt.claim.sub', 'b2100000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.audit_events
   where company_id = 'b2000000-0000-4000-8000-000000000001'
     and entity_id = 'b2900000-0000-4000-8000-00000000000e'
     and action in ('WORK_ORDER_CREATED', 'WORK_ORDER_PROGRESS_UPDATED')),
  2,
  'work order creation and progress are audited'
);
select set_config('request.jwt.claim.sub', 'b2200000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.update_work_order_progress(
    'b2900000-0000-4000-8000-00000000000e', null, 'finished',
    null, null, null, null, null, true
  )$$,
  '23514', null,
  'progress cannot bypass the authoritative closing command'
);

select set_config('request.jwt.claim.sub', 'b2300000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.create_work_order(
    'b2e00000-0000-4000-8000-000000000013',
    'b2500000-0000-4000-8000-000000000005', null,
    'Correctivo', 'Conductor no autorizado', null, false, null,
    'b2f00000-0000-4000-8000-000000000014'
  )$$,
  '42501', null,
  'driver cannot create a work order'
);

select set_config('request.jwt.claim.sub', 'b2200000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.record_work_order_part(
    'b3000000-0000-4000-8000-000000000015',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-000000000009',
    'b2600000-0000-4000-8000-000000000007',
    1, 0.3350, '2026-08-29T10:00:00Z', 950, 'Línea uno',
    'b3100000-0000-4000-8000-000000000016'
  )$$,
  'administration records the first itemized part line'
);
select is(
  (public.record_work_order_part(
    'b3000000-0000-4000-8000-000000000015',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-000000000009',
    'b2600000-0000-4000-8000-000000000007',
    1, 0.3350, '2026-08-29T10:00:00Z', 950, 'Línea uno',
    'b3100000-0000-4000-8000-000000000016'
  )).id,
  'b3000000-0000-4000-8000-000000000015'::uuid,
  'an exact part-line replay returns the original line'
);
select throws_ok(
  $$select public.record_work_order_part(
    'b3000000-0000-4000-8000-000000000015',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-000000000009',
    'b2600000-0000-4000-8000-000000000007',
    1, 0.3350, '2026-08-29T10:00:00Z', 950, 'Otra nota',
    'b3100000-0000-4000-8000-000000000016'
  )$$,
  '23505', null,
  'part idempotency rejects a changed replay'
);
select lives_ok(
  $$select public.record_work_order_part(
    'b3200000-0000-4000-8000-000000000017',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-00000000000a',
    null, 1, 0.3350, null, null, 'Línea dos',
    'b3300000-0000-4000-8000-000000000018'
  )$$,
  'administration records a second itemized part line'
);
select is(
  (select count(*)::integer from public.work_order_parts
   where work_order_id = 'b2900000-0000-4000-8000-00000000000e'),
  2,
  'two itemized part lines are retained independently'
);
select throws_ok(
  $$insert into public.work_order_parts (
    id, company_id, work_order_id, part_id, quantity, unit_cost
  ) values (
    'b3400000-0000-4000-8000-000000000019',
    'b2000000-0000-4000-8000-000000000001',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-000000000009', 1, 1
  )$$,
  '42501', null,
  'direct part-line insert is denied'
);
select throws_ok(
  $$select public.complete_work_order(
    'b2900000-0000-4000-8000-00000000000e', 1000, 5, 0.67
  )$$,
  '23514', null,
  'closing rejects a total that differs from the sum of rounded part lines'
);
select ok(
  (select status = 'in_workshop' and parts_cost = 0
   from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e')
  and (select current_odometer_km = 900
       from public.vehicles where id = 'b2500000-0000-4000-8000-000000000005'),
  'a rejected parts total leaves the order and vehicle master unchanged'
);
select lives_ok(
  $$select public.complete_work_order(
    'b2900000-0000-4000-8000-00000000000e', 1000, 5, 0.68
  )$$,
  'closing accepts the sum of each line rounded to cents'
);
select is(
  (select parts_cost from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e'),
  0.68::numeric,
  'the itemized parts total is stored on closing'
);
select is(
  (select status::text from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e'),
  'finished',
  'the itemized order is finished only after the valid close'
);
select throws_ok(
  $$select public.record_work_order_part(
    'b3500000-0000-4000-8000-00000000001a',
    'b2900000-0000-4000-8000-00000000000e',
    'b2700000-0000-4000-8000-000000000009',
    null, 1, 1, null, null, null,
    'b3600000-0000-4000-8000-00000000001b'
  )$$,
  '23514', null,
  'finished work order cannot receive a later part line'
);

select lives_ok(
  $$select public.create_work_order(
    'b3700000-0000-4000-8000-00000000001c',
    'b2500000-0000-4000-8000-000000000005', null,
    'Preventivo', 'Cambio de aceite', null, false, null,
    'b3800000-0000-4000-8000-00000000001d'
  )$$,
  'administration creates a separate order with no part lines'
);
select is(
  (select count(*)::integer from public.work_order_evidence
   where work_order_id = 'b3700000-0000-4000-8000-00000000001c'),
  0,
  'evidence remains optional before closing a work order'
);
select throws_ok(
  $$select public.complete_work_order(
    'b3700000-0000-4000-8000-00000000001c', 1000, 20, 12.345
  )$$,
  '23514', null,
  'manual parts total rejects precision beyond cents'
);
select lives_ok(
  $$select public.complete_work_order(
    'b3700000-0000-4000-8000-00000000001c', 1000, 20, 12.34
  )$$,
  'closing permits a manual global parts total when no lines exist'
);
select ok(
  (select status = 'finished' and parts_cost = 12.34
   from public.work_orders where id = 'b3700000-0000-4000-8000-00000000001c'),
  'the manual global parts total is retained only for the no-line order'
);

select lives_ok(
  $$select public.attach_work_order_evidence(
    'b3900000-0000-4000-8000-00000000001e',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000b',
    'Foto antes del montaje', 'b3a00000-0000-4000-8000-00000000001f'
  )$$,
  'administration attaches optional private evidence after closing'
);
select is(
  (public.attach_work_order_evidence(
    'b3900000-0000-4000-8000-00000000001e',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000b',
    'Foto antes del montaje', 'b3a00000-0000-4000-8000-00000000001f'
  )).id,
  'b3900000-0000-4000-8000-00000000001e'::uuid,
  'an exact evidence replay returns the original association'
);
select lives_ok(
  $$select public.attach_work_order_evidence(
    'b3b00000-0000-4000-8000-000000000020',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000c',
    null, 'b3c00000-0000-4000-8000-000000000021'
  )$$,
  'administration can attach another optional private evidence file'
);
select is(
  (select count(*)::integer from public.work_order_evidence
   where work_order_id = 'b2900000-0000-4000-8000-00000000000e'),
  2,
  'multiple evidence files are associated explicitly with one order'
);
select throws_ok(
  $$select public.attach_work_order_evidence(
    'b3d00000-0000-4000-8000-000000000022',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000b',
    null, 'b3e00000-0000-4000-8000-000000000023'
  )$$,
  '23505', null,
  'one private file cannot be attached twice to the same work order'
);
select throws_ok(
  $$select public.attach_work_order_evidence(
    'b3f00000-0000-4000-8000-000000000024',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000d',
    null, 'b4000000-0000-4000-8000-000000000025'
  )$$,
  '23514', null,
  'evidence from another company cannot be attached'
);
select ok(
  (select status = 'finished'
      and diagnosis is null
      and work_performed is null
      and labor_cost = 5
      and parts_cost = 0.68
   from public.work_orders where id = 'b2900000-0000-4000-8000-00000000000e')
  and (select count(*) = 2 from public.work_order_parts
       where work_order_id = 'b2900000-0000-4000-8000-00000000000e'),
  'evidence association does not infer or alter technical, financial, or parts data'
);
select set_config('request.jwt.claim.sub', 'b2100000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.audit_events
   where company_id = 'b2000000-0000-4000-8000-000000000001'
     and action = 'WORK_ORDER_EVIDENCE_ATTACHED'),
  2,
  'each distinct evidence association is audited'
);

select set_config('request.jwt.claim.sub', 'b2300000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.attach_work_order_evidence(
    'b4100000-0000-4000-8000-000000000026',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000b',
    null, 'b4200000-0000-4000-8000-000000000027'
  )$$,
  '42501', null,
  'driver cannot attach work order evidence'
);

select set_config('request.jwt.claim.sub', 'b2200000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$insert into public.work_order_evidence (
    id, company_id, work_order_id, file_id, created_by, idempotency_key
  ) values (
    'b4300000-0000-4000-8000-000000000028',
    'b2000000-0000-4000-8000-000000000001',
    'b2900000-0000-4000-8000-00000000000e',
    'b2800000-0000-4000-8000-00000000000b',
    'b2200000-0000-4000-8000-000000000002',
    'b4400000-0000-4000-8000-000000000029'
  )$$,
  '42501', null,
  'direct evidence association insert is denied'
);

select * from finish(true);
rollback;
