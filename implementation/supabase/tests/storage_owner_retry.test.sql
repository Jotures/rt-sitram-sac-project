begin;
set local search_path = extensions, public, auth, storage;
select plan(9);

select ok(
  exists (
    select 1
    from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname = 'private_documents_owner_retry_select'
      and polcmd = 'r'
      and polroles = array['authenticated'::regrole::oid]
  ),
  'authenticated owner retry SELECT policy exists'
);

insert into public.companies (id, legal_name) values
  ('40000000-0000-4000-8000-000000000001', 'STORAGE RETRY COMPANY A'),
  ('50000000-0000-4000-8000-000000000001', 'STORAGE RETRY COMPANY B');

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role
) values
  ('41000000-0000-4000-8000-000000000001', 'storage-driver-a@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('51000000-0000-4000-8000-000000000001', 'storage-driver-b@example.test', '', now(), '{}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, company_id, display_name, role) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Storage Driver A', 'driver'),
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Storage Driver B', 'driver');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      '42000000-0000-4000-8000-000000000001',
      'private-documents',
      'companies/40000000-0000-4000-8000-000000000001/trip-activity/expense/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000001-receipt.jpg',
      '41000000-0000-4000-8000-000000000001'
    )$$,
  'driver can upload its own correctly scoped trip evidence'
);

select is(
  (select count(*)::integer from storage.objects where id = '42000000-0000-4000-8000-000000000001'),
  1,
  'uploader can SELECT its orphaned object before files metadata exists'
);

select lives_ok(
  $$update storage.objects
    set user_metadata = '{"retry":"accepted"}'::jsonb
    where id = '42000000-0000-4000-8000-000000000001'$$,
  'uploader can perform the UPDATE phase required by Storage upsert'
);

select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      '42000000-0000-4000-8000-000000000002',
      'private-documents',
      'companies/40000000-0000-4000-8000-000000000001/admin/expense/43000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000002-receipt.jpg',
      '41000000-0000-4000-8000-000000000001'
    )$$,
  'existing INSERT contract remains independent from retry SELECT scope'
);

select is(
  (select count(*)::integer from storage.objects where id = '42000000-0000-4000-8000-000000000002'),
  0,
  'owner retry SELECT does not expose paths outside trip-activity convention'
);

select throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      '42000000-0000-4000-8000-000000000003',
      'private-documents',
      'companies/50000000-0000-4000-8000-000000000001/trip-activity/expense/43000000-0000-4000-8000-000000000003/44000000-0000-4000-8000-000000000003-receipt.jpg',
      '41000000-0000-4000-8000-000000000001'
    )$$,
  '42501', null,
  'uploader cannot create retry-readable evidence under another company'
);

select throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id)
    values (
      '42000000-0000-4000-8000-000000000004',
      'private-documents',
      'companies/40000000-0000-4000-8000-000000000001/trip-activity/expense/43000000-0000-4000-8000-000000000004/44000000-0000-4000-8000-000000000004-receipt.jpg',
      '51000000-0000-4000-8000-000000000001'
    )$$,
  '42501', null,
  'uploader cannot spoof another Storage owner'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from storage.objects where id = '42000000-0000-4000-8000-000000000001'),
  0,
  'another company cannot read the orphaned object'
);

select * from finish(true);
rollback;
