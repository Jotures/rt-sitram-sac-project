begin;
set local search_path = extensions, public, auth;
select plan(56);

insert into public.companies (id, legal_name)
values ('30000000-0000-0000-0000-000000000001', 'BACKEND INVARIANTS COMPANY');
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('31000000-0000-0000-0000-000000000001', 'management-invariants@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('31000000-0000-4000-8000-000000000002', 'administration-invariants@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('32000000-0000-0000-0000-000000000002', 'driver-invariants@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');
insert into public.profiles (id, company_id, display_name, role)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Management invariants', 'management'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-0000-0000-000000000001', 'Administration invariants', 'administration'),
  ('32000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Driver invariants', 'driver');
insert into public.clients (id, company_id, legal_name)
values ('33000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'CLIENT INVARIANTS');
insert into public.vehicles (id, company_id, plate, current_odometer_km)
values ('34000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'TST-401', 1000);
insert into public.drivers (id, company_id, profile_id, display_name)
values ('35000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', 'Driver invariants');
insert into public.expense_categories (id, company_id, code, name)
values ('36000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 'TST', 'Test expense');

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.create_trip_with_load(
    '33000000-0000-0000-0000-000000000003', 'Cusco', 'Lima', now(), 5000,
    'Carga de prueba', 30
  )$$,
  'trip and initial load are created atomically'
);
select is(
  (select count(*)::integer from public.trips where code like 'RT-%'),
  1,
  'atomic command created one trip'
);
select is(
  (select count(*)::integer from public.loads),
  1,
  'atomic command created its initial load'
);

reset role;
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, capture_mode_changed_at, operational_status, created_by
) values (
  '37000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001',
  'TEST-OFFLINE-1', '33000000-0000-0000-0000-000000000003',
  '34000000-0000-0000-0000-000000000004', '35000000-0000-0000-0000-000000000005',
  'Cusco', 'Lima', now() - interval '4 hours', now() - interval '4 hours', 'scheduled',
  '31000000-0000-0000-0000-000000000001'
);
update public.vehicles set current_status = 'scheduled'
where id = '34000000-0000-0000-0000-000000000004';
update public.drivers set current_status = 'assigned'
where id = '35000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  'trip advance is recorded before departure'
);
select is(
  public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  ),
  (select id from public.advances where idempotency_key = '3a000000-0000-0000-0000-00000000000a'),
  'exact advance replay returns the original row'
);
select is(
  (select count(*)::integer from public.advances
    where idempotency_key = '3a000000-0000-0000-0000-00000000000a'),
  1,
  'exact advance replay does not duplicate money'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '38000000-0000-0000-0000-000000000008',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another trip is rejected generically'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-4000-8000-000000000006',
    now() - interval '4 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another driver is rejected generically'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '3 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another delivery time is rejected generically'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 101, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another amount is rejected generically'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'transfer', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another delivery method is rejected generically'
);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'cash', 'Another advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision with another concept is rejected generically'
);
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.issue_trip_advance(
    '37000000-0000-0000-0000-000000000007',
    '35000000-0000-0000-0000-000000000005',
    now() - interval '4 hours', 100, 'cash', 'Test advance',
    '3a000000-0000-0000-0000-00000000000a'
  )$$,
  '23505', null,
  'advance key collision from another actor is rejected generically'
);

select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '37100000-0000-0000-0000-000000000011',
    '37000000-0000-0000-0000-000000000007', 'start', 1100, false,
    now() - interval '3 hours', 'test-device'
  )$$,
  'offline start is accepted'
);
select is(
  (select started_at from public.trips where id = '37000000-0000-0000-0000-000000000007'),
  now() - interval '3 hours',
  'trip start preserves physical occurrence time'
);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '37200000-0000-0000-0000-000000000012',
    '37000000-0000-0000-0000-000000000007', 'arrive', null, false,
    now() - interval '2 hours', 'test-device'
  )$$,
  'offline arrival is accepted after start'
);
select is(
  (select max(occurred_at) from public.trip_status_events
    where trip_id = '37000000-0000-0000-0000-000000000007' and new_status = 'unloading'),
  now() - interval '2 hours',
  'arrival event preserves physical occurrence time'
);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '37300000-0000-0000-0000-000000000013',
    '37000000-0000-0000-0000-000000000007', 'complete', 1200, true,
    now() - interval '1 hour', 'test-device'
  )$$,
  'offline completion is accepted after arrival'
);
select is(
  (select operational_finished_at from public.trips where id = '37000000-0000-0000-0000-000000000007'),
  now() - interval '1 hour',
  'trip completion preserves physical occurrence time'
);
select is(
  (select operational_status::text from public.trips where id = '37000000-0000-0000-0000-000000000007'),
  'completed',
  'offline transition sequence completes the trip'
);
select is(
  (select reading_at from public.odometer_entries
    where trip_id = '37000000-0000-0000-0000-000000000007' and reading_type = 'trip_finish'),
  now() - interval '1 hour',
  'completion odometer preserves physical occurrence time'
);

select lives_ok(
  $$select public.record_expense(
    '39000000-0000-0000-0000-000000000009',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 60, 'PEN', null, null, null,
    'Validated expense', 'test-device',
    '39100000-0000-0000-0000-000000000019'
  )$$,
  'driver expense is accepted'
);
select lives_ok(
  $$select public.record_expense(
    '39000000-0000-0000-0000-000000000009',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 60, 'PEN', null, null, null,
    'Validated expense', 'test-device',
    '39100000-0000-0000-0000-000000000019'
  )$$,
  'exact expense replay is idempotent'
);
select throws_ok(
  $$select public.record_expense(
    '39000000-0000-0000-0000-000000000009',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 61, 'PEN', null, null, null,
    'Validated expense', 'test-device',
    '39100000-0000-0000-0000-000000000019'
  )$$,
  '23505', null,
  'same expense key with another payload is rejected'
);
select lives_ok(
  $$select public.record_expense(
    '39200000-0000-0000-0000-000000000029',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 999, 'PEN', null, null, null,
    'Rejected expense', 'test-device',
    '39300000-0000-0000-0000-000000000039'
  )$$,
  'expense awaiting rejection is accepted'
);

select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.close_settlement(
    (select id from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
    'cash', 'TEST-RETURN', null
  )$$,
  '23514', null,
  'settlement cannot close with pending expenses'
);
select lives_ok(
  $$select public.review_expense(
    '39000000-0000-0000-0000-000000000009', 'validated', 60, null
  )$$,
  'expense is validated'
);
select lives_ok(
  $$select public.review_expense(
    '39200000-0000-0000-0000-000000000029', 'rejected', null, 'Not justified'
  )$$,
  'rejected expense reaches a terminal decision'
);
select throws_ok(
  $$select public.close_settlement(
    (select id from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
    null, null, null
  )$$,
  '23514', null,
  'non-zero balance requires resolution evidence'
);
select lives_ok(
  $$select public.close_settlement(
    (select id from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
    'cash', 'TEST-RETURN', 'Driver returned the difference'
  )$$,
  'non-zero settlement closes with evidence'
);
select is(
  (select balance from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  40::numeric,
  'settlement balance is recalculated from authoritative rows'
);
select is(
  (select resolution_direction from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  'DRIVER_RETURNS',
  'positive balance derives driver return direction'
);
select is(
  (select resolved_amount from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  40::numeric,
  'resolved amount stores the absolute balance'
);
select is(
  (select total_expenses from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  60::numeric,
  'rejected expense is excluded from settlement total'
);
select throws_ok(
  $$select public.review_expense(
    '39200000-0000-0000-0000-000000000029', 'validated', 999, 'Late revalidation'
  )$$,
  '55000', null,
  'rejected expense cannot be revalidated after settlement closure'
);
select throws_ok(
  $$update public.expenses
    set validation_status = 'validated', approved_amount = 999
    where id = '39200000-0000-0000-0000-000000000029'$$,
  '42501', null,
  'authenticated direct expense mutation is denied before it can bypass a closed settlement'
);
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.record_staff_trip_expense(
    '39600000-0000-0000-0000-000000000069',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 1, 'PEN', null, null, null,
    'New expense after closure', 'Attempted after financial closure',
    '39700000-0000-0000-0000-000000000079'
  )$$,
  '55000', null,
  'administration cannot record a new expense after settlement closure'
);
select throws_ok(
  $$insert into public.expenses (
    id, company_id, assignment_type, trip_id, vehicle_id, driver_id,
    category_id, incurred_at, amount, currency, source,
    validation_status, created_by, idempotency_key
  ) values (
    '39800000-0000-0000-0000-000000000089',
    '30000000-0000-0000-0000-000000000001',
    'trip',
    '37000000-0000-0000-0000-000000000007',
    '34000000-0000-0000-0000-000000000004',
    '35000000-0000-0000-0000-000000000005',
    '36000000-0000-0000-0000-000000000006',
    now() - interval '90 minutes', 1, 'PEN', 'manual_test',
    'pending_review',
    '31000000-0000-4000-8000-000000000002',
    '39900000-0000-0000-0000-000000000099'
  )$$,
  '55000', null,
  'direct staff expense insertion is rejected after settlement closure'
);
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.record_expense(
    '39000000-0000-0000-0000-000000000009',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '90 minutes', 60, 'PEN', null, null, null,
    'Validated expense', 'test-device',
    '39100000-0000-0000-0000-000000000019'
  )$$,
  'exact expense replay remains stable after settlement closure'
);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '37300000-0000-0000-0000-000000000013',
    '37000000-0000-0000-0000-000000000007', 'complete', 1200, true,
    now() - interval '1 hour', 'test-device'
  )$$,
  'exact transition replay remains stable after settlement closure'
);
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.reopen_settlement(
    (select id from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
    'Add missing validated expense'
  )$$,
  'management reopens a closed settlement'
);
select is(
  (select resolution_direction from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  null,
  'reopening clears balance resolution fields'
);
select lives_ok(
  $$select public.review_expense(
    '39200000-0000-0000-0000-000000000029', 'validated', 999, 'Revalidated after reopen'
  )$$,
  'reopening permits the rejected expense to be reviewed again'
);
select lives_ok(
  $$select public.review_expense(
    '39200000-0000-0000-0000-000000000029', 'rejected', null, 'Keep excluded from this settlement'
  )$$,
  'an open settlement permits a subsequent conservative rejection'
);

select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.record_expense(
    '39400000-0000-0000-0000-000000000049',
    '37000000-0000-0000-0000-000000000007',
    '36000000-0000-0000-0000-000000000006', null,
    now() - interval '75 minutes', 40, 'PEN', null, null, null,
    'Balancing expense', 'test-device',
    '39500000-0000-0000-0000-000000000059'
  )$$,
  'reopened settlement accepts activity captured before completion'
);
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.review_expense(
    '39400000-0000-0000-0000-000000000049', 'validated', 40, null
  )$$,
  'balancing expense is validated'
);
select lives_ok(
  $$select public.close_settlement(
    (select id from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
    null, null, 'Exact settlement'
  )$$,
  'zero balance closes without manual evidence'
);
select is(
  (select resolution_direction from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  'BALANCED',
  'zero balance derives balanced direction'
);
select is(
  (select resolution_method from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  'AUTO_BALANCED',
  'zero balance is marked automatically balanced'
);
select is(
  (select resolved_amount from public.settlements where trip_id = '37000000-0000-0000-0000-000000000007'),
  0::numeric,
  'zero balance stores a zero resolved amount'
);

reset role;
insert into public.trips (
  id, company_id, code, client_id, vehicle_id, driver_id, origin, destination,
  scheduled_at, capture_mode_changed_at, operational_status, created_by
) values (
  '38000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001',
  'TEST-OFFLINE-2', '33000000-0000-0000-0000-000000000003',
  '34000000-0000-0000-0000-000000000004', '35000000-0000-0000-0000-000000000005',
  'Lima', 'Cusco', now(), now() - interval '1 hour', 'scheduled',
  '31000000-0000-0000-0000-000000000001'
);
update public.vehicles set current_status = 'scheduled'
where id = '34000000-0000-0000-0000-000000000004';
update public.drivers set current_status = 'assigned'
where id = '35000000-0000-0000-0000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.apply_driver_trip_transition(
    '38100000-0000-0000-0000-000000000018',
    '38000000-0000-0000-0000-000000000008', 'start', 1200, false,
    now() + interval '1 hour', 'test-device'
  )$$,
  '22007', null,
  'future offline transition is rejected'
);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '38200000-0000-0000-0000-000000000028',
    '38000000-0000-0000-0000-000000000008', 'start', 1200, false,
    now() - interval '30 minutes', 'test-device'
  )$$,
  'second trip accepts a valid offline start'
);
select throws_ok(
  $$select public.apply_driver_trip_transition(
    '38300000-0000-0000-0000-000000000038',
    '38000000-0000-0000-0000-000000000008', 'arrive', null, false,
    now() - interval '30 minutes', 'test-device'
  )$$,
  '22007', null,
  'arrival at the start time is rejected'
);
select throws_ok(
  $$select public.record_fuel_entry(
    '38400000-0000-0000-0000-000000000048',
    '38000000-0000-0000-0000-000000000008', null,
    now() - interval '20 minutes', 'Lima', 1199, 10, 'gallon', 20, 200,
    'PEN', 'cash', null, null, null, 'test-device',
    '38500000-0000-0000-0000-000000000058'
  )$$,
  '23514', null,
  'fuel odometer cannot decrease'
);
select lives_ok(
  $$select public.apply_driver_trip_transition(
    '38200000-0000-0000-0000-000000000028',
    '38000000-0000-0000-0000-000000000008', 'start', 1200, false,
    now() - interval '30 minutes', 'test-device'
  )$$,
  'exact transition replay is idempotent'
);
select throws_ok(
  $$select public.apply_driver_trip_transition(
    '38200000-0000-0000-0000-000000000028',
    '38000000-0000-0000-0000-000000000008', 'start', 1201, false,
    now() - interval '30 minutes', 'test-device'
  )$$,
  '23505', null,
  'transition ID collision with another payload is rejected'
);

select * from finish(true);
rollback;
