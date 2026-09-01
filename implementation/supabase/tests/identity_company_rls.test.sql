begin;
set local search_path = extensions, public, auth;
select plan(10);

select has_table('public','companies','companies exists');
select has_table('public','profiles','profiles exists');
select has_table('public','trips','trips exists');
select has_table('public','odometer_entries','canonical odometer_entries exists');

insert into public.companies (id,legal_name) values
  ('10000000-0000-0000-0000-000000000001','TEST COMPANY A'),
  ('20000000-0000-0000-0000-000000000002','TEST COMPANY B');
insert into auth.users (id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role) values
  ('11000000-0000-0000-0000-000000000001','management-a@example.test','',now(),'{}','{}','authenticated','authenticated'),
  ('12000000-0000-0000-0000-000000000002','driver-a@example.test','',now(),'{}','{}','authenticated','authenticated'),
  ('21000000-0000-0000-0000-000000000001','management-b@example.test','',now(),'{}','{}','authenticated','authenticated');
insert into public.profiles (id,company_id,display_name,role) values
  ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Management A','management'),
  ('12000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Driver A','driver'),
  ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Management B','management');
insert into public.clients (id,company_id,legal_name)
values ('13000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','CLIENT A');

select throws_ok(
  $$insert into public.trips (company_id,code,client_id,origin,destination,scheduled_at,created_by)
    values ('20000000-0000-0000-0000-000000000002','CROSS-COMPANY','13000000-0000-0000-0000-000000000003','A','B',now(),'21000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'cross-company foreign key is rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-0000-0000-000000000001',true);
select is((select count(*)::integer from public.companies),1,'management A sees one company');
select is((select count(*)::integer from public.profiles),2,'management A sees company A profiles');

select set_config('request.jwt.claim.sub','12000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.profiles),1,'driver sees only own profile');
select throws_ok(
  $$update public.profiles set company_id = '20000000-0000-0000-0000-000000000002' where id = '12000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'driver cannot move profile to another company'
);

select set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true);
select is((select id from public.companies),'20000000-0000-0000-0000-000000000002'::uuid,'management B sees only company B');

select * from finish(true);
rollback;
