begin;
set local search_path = extensions, public, auth;
select plan(8);

select has_function(
  'public',
  'schedule_trip',
  array['uuid','uuid','uuid','integer'],
  'versioned scheduling primitive exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.schedule_trip(uuid,uuid,uuid,integer)',
    'EXECUTE'
  ),
  'versioned scheduling primitive remains internal to the RPC adapter'
);

insert into public.companies (id, legal_name)
values ('60000000-0000-4000-8000-000000000001', 'SCHEDULING PROFILE COMPANY');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('61000000-0000-4000-8000-000000000001', 'schedule-management@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('62000000-0000-4000-8000-000000000002', 'schedule-valid-driver@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('63000000-0000-4000-8000-000000000003', 'schedule-inactive-driver@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('64000000-0000-4000-8000-000000000004', 'schedule-assigned-driver@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role, active)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Scheduling management', 'management', true),
  ('62000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'Scheduling valid driver', 'driver', true),
  ('63000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', 'Scheduling inactive driver', 'driver', false),
  ('64000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', 'Scheduling assigned driver', 'driver', true);

insert into public.clients (id, company_id, legal_name)
values ('65000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', 'SCHEDULING PROFILE CLIENT');

insert into public.vehicles (id, company_id, plate)
values ('66000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000001', 'TST-DRV-01');

insert into public.drivers (id, company_id, profile_id, display_name, current_status)
values
  ('67000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000001', null, 'Unlinked scheduling driver', 'available'),
  ('68000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Wrong role scheduling driver', 'available'),
  ('69000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000003', 'Inactive profile scheduling driver', 'available'),
  ('6a000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000004', 'Assigned scheduling driver', 'assigned'),
  ('6b000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', 'Valid scheduling driver', 'available');

insert into public.trips (
  id, company_id, code, client_id, origin, destination, scheduled_at,
  operational_status, created_by
) values
  ('6c000000-0000-4000-8000-00000000000c', '60000000-0000-4000-8000-000000000001', 'PROFILE-UNLINKED', '65000000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'approved', '61000000-0000-4000-8000-000000000001'),
  ('6d000000-0000-4000-8000-00000000000d', '60000000-0000-4000-8000-000000000001', 'PROFILE-WRONG-ROLE', '65000000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'approved', '61000000-0000-4000-8000-000000000001'),
  ('6e000000-0000-4000-8000-00000000000e', '60000000-0000-4000-8000-000000000001', 'PROFILE-INACTIVE', '65000000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'approved', '61000000-0000-4000-8000-000000000001'),
  ('6f000000-0000-4000-8000-00000000000f', '60000000-0000-4000-8000-000000000001', 'PROFILE-ASSIGNED', '65000000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'approved', '61000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000001', 'PROFILE-VALID', '65000000-0000-4000-8000-000000000005', 'Lima', 'Cusco', now(), 'approved', '61000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.schedule_trip(
    '6c000000-0000-4000-8000-00000000000c',
    '66000000-0000-4000-8000-000000000006',
    '67000000-0000-4000-8000-000000000007'
  )$$,
  '23514',
  'Driver must be available and linked to an active driver profile',
  'unlinked driver cannot be scheduled'
);
select throws_ok(
  $$select public.schedule_trip(
    '6d000000-0000-4000-8000-00000000000d',
    '66000000-0000-4000-8000-000000000006',
    '68000000-0000-4000-8000-000000000008'
  )$$,
  '23514',
  'Driver must be available and linked to an active driver profile',
  'profile without the driver role cannot be scheduled'
);
select throws_ok(
  $$select public.schedule_trip(
    '6e000000-0000-4000-8000-00000000000e',
    '66000000-0000-4000-8000-000000000006',
    '69000000-0000-4000-8000-000000000009'
  )$$,
  '23514',
  'Driver must be available and linked to an active driver profile',
  'inactive driver profile cannot be scheduled'
);
select throws_ok(
  $$select public.schedule_trip(
    '6f000000-0000-4000-8000-00000000000f',
    '66000000-0000-4000-8000-000000000006',
    '6a000000-0000-4000-8000-00000000000a'
  )$$,
  '23514',
  'Driver must be available and linked to an active driver profile',
  'assigned driver cannot be scheduled again'
);
select lives_ok(
  $$select public.schedule_trip(
    '70000000-0000-4000-8000-000000000010',
    '66000000-0000-4000-8000-000000000006',
    '6b000000-0000-4000-8000-00000000000b'
  )$$,
  'active available driver linked to an active driver profile is scheduled'
);
select is(
  (select operational_status::text from public.trips where id = '70000000-0000-4000-8000-000000000010'),
  'scheduled',
  'valid driver scheduling changes the trip state'
);

select * from finish(true);
rollback;
