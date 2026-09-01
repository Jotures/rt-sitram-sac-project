begin;
set local search_path = extensions, public, auth;
select plan(39);

insert into public.companies (id, legal_name)
values ('a0000000-0000-4000-8000-000000000001', 'P1 FINANCE CONTROLS COMPANY');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('a1000000-0000-4000-8000-000000000002', 'p1-management@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000003', 'p1-administration@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000004', 'p1-driver@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role)
values
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'P1 management', 'management'),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'P1 administration', 'administration'),
  ('a3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'P1 driver', 'driver');

insert into public.clients (id, company_id, legal_name)
values ('a4000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'P1 CLIENT');

insert into public.vehicles (id, company_id, plate, current_odometer_km)
values ('a5000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'P1-FIN-01', 1200);

insert into public.drivers (id, company_id, profile_id, display_name)
values ('a6000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000004', 'P1 driver');

insert into public.expense_categories (id, company_id, code, name)
values ('a7000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'P1', 'P1 expense');

insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, operational_status, administrative_status, created_by
) values
  (
    'a8000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000001',
    'P1-SCHEDULED',
    'a4000000-0000-4000-8000-000000000005',
    'a5000000-0000-4000-8000-000000000006',
    'a6000000-0000-4000-8000-000000000007',
    'Lima', 'Cusco', now() - interval '2 hours', 'scheduled', 'not_required',
    'a1000000-0000-4000-8000-000000000002'
  ),
  (
    'a9000000-0000-4000-8000-00000000000a',
    'a0000000-0000-4000-8000-000000000001',
    'P1-COMPLETED',
    'a4000000-0000-4000-8000-000000000005',
    'a5000000-0000-4000-8000-000000000006',
    'a6000000-0000-4000-8000-000000000007',
    'Cusco', 'Lima', now() - interval '3 hours', 'completed', 'settlement_pending',
    'a1000000-0000-4000-8000-000000000002'
  );

update public.trips
set operational_finished_at = now() - interval '1 hour'
where id = 'a9000000-0000-4000-8000-00000000000a';

insert into public.settlements (id, company_id, trip_id, driver_id, started_at)
values (
  'aa000000-0000-4000-8000-00000000000b',
  'a0000000-0000-4000-8000-000000000001',
  'a9000000-0000-4000-8000-00000000000a',
  'a6000000-0000-4000-8000-000000000007',
  now() - interval '1 hour'
);

insert into public.advances (
  id, company_id, trip_id, driver_id, delivered_at, amount, currency,
  delivery_method, concept, status, created_by, idempotency_key
) values
  (
    'ab000000-0000-4000-8000-00000000000c',
    'a0000000-0000-4000-8000-000000000001',
    'a9000000-0000-4000-8000-00000000000a',
    'a6000000-0000-4000-8000-000000000007',
    now() - interval '2 hours', 100, 'PEN', 'cash', 'Operating fund', 'delivered',
    'a1000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-00000000000d'
  ),
  (
    'ad000000-0000-4000-8000-00000000000e',
    'a0000000-0000-4000-8000-000000000001',
    'a9000000-0000-4000-8000-00000000000a',
    'a6000000-0000-4000-8000-000000000007',
    now() - interval '2 hours', 25, 'PEN', 'cash', 'Cancelled operating fund', 'cancelled',
    'a1000000-0000-4000-8000-000000000002',
    'ae000000-0000-4000-8000-00000000000f'
  );

select has_function(
  'public',
  'record_staff_trip_expense',
  array['uuid','uuid','uuid','uuid','timestamp with time zone','numeric','character','text','text','uuid','text','text','uuid'],
  'staff expense representation RPC exists'
);
select has_function(
  'public',
  'record_staff_trip_fuel_entry',
  array['uuid','uuid','uuid','timestamp with time zone','text','numeric','numeric','text','numeric','numeric','character','text','text','text','uuid','text','uuid'],
  'staff fuel representation RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)', 'EXECUTE'),
  'authenticated users receive the staff representation command surface'
);
select ok(
  not has_function_privilege('anon', 'public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.record_staff_trip_expense(uuid,uuid,uuid,uuid,timestamptz,numeric,char,text,text,uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.record_staff_trip_fuel_entry(uuid,uuid,uuid,timestamptz,text,numeric,numeric,text,numeric,numeric,char,text,text,text,uuid,text,uuid)', 'EXECUTE'),
  'staff representation RPCs are not callable anonymously or by bare service role'
);
select ok(
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.policyname in (
        'expenses_staff_append',
        'fuel_entries_staff_append',
        'expenses_staff_update',
        'fuel_staff_update'
      )
  ),
  'staff cannot bypass audited representation commands through direct append or update policies'
);
select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'fuel_entries'
      and t.tgname = 'fuel_entries_closed_guard'
      and not t.tgisinternal
  ),
  'fuel has the same closed-settlement mutation boundary as expenses'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);

select lives_ok(
  $$select public.record_staff_trip_expense(
    'af000000-0000-4000-8000-000000000010',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '30 minutes', 25, 'PEN', null, null, null,
    'Centralized toll transcription', 'Reported by the assigned driver',
    'b0000000-0000-4000-8000-000000000011'
  )$$,
  'administration can register an expense from scheduling onward'
);
select lives_ok(
  $$select public.record_staff_trip_expense(
    'af000000-0000-4000-8000-000000000010',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '30 minutes', 25, 'PEN', null, null, null,
    'Centralized toll transcription', 'Reported by the assigned driver',
    'b0000000-0000-4000-8000-000000000011'
  )$$,
  'exact staff expense replay does not duplicate the activity'
);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select ok(
  exists (
    select 1
    from public.audit_events a
    where a.company_id = 'a0000000-0000-4000-8000-000000000001'
      and a.action = 'STAFF_TRIP_EXPENSE_RECORDED'
      and a.entity_id = 'af000000-0000-4000-8000-000000000010'
      and a.actor_id = 'a2000000-0000-4000-8000-000000000003'
      and a.reason = 'Reported by the assigned driver'
  ),
  'staff expense representation records actor and mandatory reason in audit'
);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.record_staff_trip_expense(
    'af000000-0000-4000-8000-000000000010',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '30 minutes', 25, 'PEN', null, null, null,
    'Centralized toll transcription', 'A different reason',
    'b0000000-0000-4000-8000-000000000011'
  )$$,
  '23505', null,
  'staff expense idempotency includes the representation reason'
);
select throws_ok(
  $$select public.record_staff_trip_expense(
    'b1000000-0000-4000-8000-000000000012',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now(), 1, 'PEN', null, null, null,
    'No reason', '   ', 'b2000000-0000-4000-8000-000000000013'
  )$$,
  '23514', null,
  'staff expense representation requires a reason'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.record_staff_trip_expense(
    'b3000000-0000-4000-8000-000000000014',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now(), 1, 'PEN', null, null, null,
    'Driver bypass', 'Not allowed', 'b4000000-0000-4000-8000-000000000015'
  )$$,
  '42501', null,
  'driver cannot invoke a staff representation command'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.record_expense(
    'b5000000-0000-4000-8000-000000000016',
    'a8000000-0000-4000-8000-000000000009',
    'a7000000-0000-4000-8000-000000000008', null,
    now(), 1, 'PEN', null, null, null,
    'Unreasoned staff bypass', 'browser', 'b6000000-0000-4000-8000-000000000017'
  )$$,
  '42501', null,
  'administration cannot bypass the reason through the driver expense RPC'
);
select throws_ok(
  $$select public.record_fuel_entry(
    'b7000000-0000-4000-8000-000000000018',
    'a8000000-0000-4000-8000-000000000009', null,
    now(), 'Lima', 1200, 1, 'gallon', 10, 10,
    'PEN', 'cash', null, null, null, 'browser',
    'b8000000-0000-4000-8000-000000000019'
  )$$,
  '42501', null,
  'administration cannot bypass the reason through the driver fuel RPC'
);
select throws_ok(
  $$insert into public.expenses (
    id, company_id, assignment_type, trip_id, vehicle_id, driver_id,
    category_id, incurred_at, amount, currency, source, validation_status,
    created_by, idempotency_key
  ) values (
    'b9000000-0000-4000-8000-00000000001a',
    'a0000000-0000-4000-8000-000000000001', 'trip',
    'a8000000-0000-4000-8000-000000000009',
    'a5000000-0000-4000-8000-000000000006',
    'a6000000-0000-4000-8000-000000000007',
    'a7000000-0000-4000-8000-000000000008', now(), 1, 'PEN',
    'staff_representative', 'pending_review',
    'a2000000-0000-4000-8000-000000000003',
    'ba000000-0000-4000-8000-00000000001b'
  )$$,
  '42501', null,
  'direct staff expense append is denied while the trip remains open'
);
select throws_ok(
  $$update public.expenses
    set description = 'Unaudited staff rewrite'
    where id = 'af000000-0000-4000-8000-000000000010'$$,
  '42501', null,
  'direct staff expense update is denied while the trip remains open'
);

select lives_ok(
  $$select public.record_staff_trip_expense(
    'bb000000-0000-4000-8000-00000000001c',
    'a9000000-0000-4000-8000-00000000000a',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '90 minutes', 40, 'PEN', null, null, null,
    'Late completed-trip expense', 'Receipt delivered after the trip',
    'bc000000-0000-4000-8000-00000000001d'
  )$$,
  'staff can regularize an expense after completion with its historical time'
);
select throws_ok(
  $$select public.record_staff_trip_expense(
    'bd000000-0000-4000-8000-00000000001e',
    'a9000000-0000-4000-8000-00000000000a',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '30 minutes', 1, 'PEN', null, null, null,
    'After completion', 'Invalid physical time',
    'be000000-0000-4000-8000-00000000001f'
  )$$,
  '22007', null,
  'staff expense cannot claim an occurrence after operational completion'
);
select lives_ok(
  $$select public.record_staff_trip_fuel_entry(
    'bf000000-0000-4000-8000-000000000020',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 10, 'gallon', 10, 100,
    'PEN', 'cash', null, null, null,
    'Fuel receipt transcribed by administration',
    'c0000000-0000-4000-8000-000000000021'
  )$$,
  'staff can regularize historical fuel after completion'
);
select is(
  (
    select v.current_odometer_km
    from public.vehicles v
    where v.id = 'a5000000-0000-4000-8000-000000000006'
  ),
  1200::numeric,
  'historical late fuel evidence never regresses the vehicle odometer master'
);
select throws_ok(
  $$select public.record_staff_trip_fuel_entry(
    'c1000000-0000-4000-8000-000000000022',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '30 minutes', 'Cusco', 1200, 1, 'gallon', 10, 10,
    'PEN', 'cash', null, null, null,
    'Invalid post-completion fuel',
    'c2000000-0000-4000-8000-000000000023'
  )$$,
  '22007', null,
  'staff fuel cannot claim an occurrence after operational completion'
);
select lives_ok(
  $$select public.record_staff_trip_fuel_entry(
    'bf000000-0000-4000-8000-000000000020',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 10, 'gallon', 10, 100,
    'PEN', 'cash', null, null, null,
    'Fuel receipt transcribed by administration',
    'c0000000-0000-4000-8000-000000000021'
  )$$,
  'exact staff fuel replay is idempotent'
);
select throws_ok(
  $$select public.record_staff_trip_fuel_entry(
    'bf000000-0000-4000-8000-000000000020',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 10, 'gallon', 10, 100,
    'PEN', 'cash', null, null, null,
    'Different representation reason',
    'c0000000-0000-4000-8000-000000000021'
  )$$,
  '23505', null,
  'staff fuel idempotency includes the representation reason'
);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select ok(
  exists (
    select 1
    from public.audit_events a
    where a.company_id = 'a0000000-0000-4000-8000-000000000001'
      and a.action = 'STAFF_TRIP_FUEL_RECORDED'
      and a.entity_id = 'bf000000-0000-4000-8000-000000000020'
      and a.actor_id = 'a2000000-0000-4000-8000-000000000003'
      and a.reason = 'Fuel receipt transcribed by administration'
  ),
  'staff fuel representation records actor and mandatory reason in audit'
);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$update public.fuel_entries
    set location = 'Unaudited staff rewrite'
    where id = 'bf000000-0000-4000-8000-000000000020'$$,
  '42501', null,
  'direct staff fuel update is denied while the trip remains open'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.review_expense(
    'bb000000-0000-4000-8000-00000000001c', 'validated', 40,
    'Validated against the submitted receipt'
  )$$,
  'late staff expense can be reviewed before settlement closure'
);
select lives_ok(
  $$select public.close_settlement(
    'aa000000-0000-4000-8000-00000000000b',
    'cash', 'P1-RETURN', 'Operating fund balance returned'
  )$$,
  'settlement closes after the late expense is validated'
);
select is(
  (
    select s.total_expenses
    from public.settlements s
    where s.id = 'aa000000-0000-4000-8000-00000000000b'
  ),
  40::numeric,
  'late fuel remains a trip cost and does not change the driver settlement expense total'
);
select is(
  (
    select s.balance
    from public.settlements s
    where s.id = 'aa000000-0000-4000-8000-00000000000b'
  ),
  60::numeric,
  'late fuel does not change the driver settlement balance'
);
select is(
  (
    select s.total_advances
    from public.settlements s
    where s.id = 'aa000000-0000-4000-8000-00000000000b'
  ),
  100::numeric,
  'only non-cancelled operating funds contribute to the settlement advance total'
);
select is(
  (
    select a.status::text
    from public.advances a
    where a.id = 'ab000000-0000-4000-8000-00000000000c'
  ),
  'settled',
  'closing the settlement marks its operating fund as settled'
);
select is(
  (
    select a.status::text
    from public.advances a
    where a.id = 'ad000000-0000-4000-8000-00000000000e'
  ),
  'cancelled',
  'a cancelled operating fund remains cancelled at settlement closure'
);
select ok(
  exists (
    select 1
    from public.audit_events a
    where a.company_id = 'a0000000-0000-4000-8000-000000000001'
      and a.action = 'OPERATING_FUND_SETTLED'
      and a.entity_type = 'advance'
      and a.entity_id = 'ab000000-0000-4000-8000-00000000000c'
  ),
  'operating-fund settlement is independently auditable'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.record_staff_trip_expense(
    'c3000000-0000-4000-8000-000000000024',
    'a9000000-0000-4000-8000-00000000000a',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '90 minutes', 1, 'PEN', null, null, null,
    'Blocked closed expense', 'Settlement must be reopened',
    'c4000000-0000-4000-8000-000000000025'
  )$$,
  '55000', null,
  'closed settlement blocks a new staff expense until it is reopened'
);
select throws_ok(
  $$select public.record_staff_trip_fuel_entry(
    'c5000000-0000-4000-8000-000000000026',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 1, 'gallon', 10, 10,
    'PEN', 'cash', null, 'Blocked closed fuel', null,
    'Settlement must be reopened',
    'c6000000-0000-4000-8000-000000000027'
  )$$,
  '55000', null,
  'closed settlement blocks a new staff fuel entry until it is reopened'
);
select lives_ok(
  $$select public.record_staff_trip_fuel_entry(
    'bf000000-0000-4000-8000-000000000020',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 10, 'gallon', 10, 100,
    'PEN', 'cash', null, null, null,
    'Fuel receipt transcribed by administration',
    'c0000000-0000-4000-8000-000000000021'
  )$$,
  'exact staff fuel replay remains safe after closure'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.reopen_settlement(
    'aa000000-0000-4000-8000-00000000000b',
    'Add omitted historical trip activity'
  )$$,
  'management can reopen a closed settlement to regularize activity'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$select public.record_staff_trip_expense(
    'c7000000-0000-4000-8000-000000000028',
    'a9000000-0000-4000-8000-00000000000a',
    'a7000000-0000-4000-8000-000000000008', null,
    now() - interval '90 minutes', 1, 'PEN', null, null, null,
    'Accepted after reopen', 'Missing receipt located',
    'c8000000-0000-4000-8000-000000000029'
  )$$,
  'reopened settlement permits a staff expense regularization'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.record_staff_trip_fuel_entry(
    'c9000000-0000-4000-8000-00000000002a',
    'a9000000-0000-4000-8000-00000000000a', null,
    now() - interval '90 minutes', 'Cusco', 1150, 1, 'gallon', 10, 10,
    'PEN', 'cash', null, null, null,
    'Management regularization after reopen',
    'ca000000-0000-4000-8000-00000000002b'
  )$$,
  'management can register fuel in representation after reopening'
);

select * from finish(true);
rollback;
