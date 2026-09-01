-- Private object storage. Database metadata remains in public.files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-documents', 'private-documents', false, 52428800,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function private.can_access_file(target_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.files f
    where f.company_id = private.current_company_id() and f.storage_path = target_path
      and (
        f.uploaded_by = auth.uid()
        or exists (select 1 from public.expenses e where e.company_id = f.company_id and e.receipt_file_id = f.id and e.trip_id is not null and private.can_access_trip(e.trip_id))
        or exists (select 1 from public.fuel_entries fe where fe.company_id = f.company_id and fe.receipt_file_id = f.id and fe.trip_id is not null and private.can_access_trip(fe.trip_id))
        or exists (select 1 from public.incidents i where i.company_id = f.company_id and i.file_id = f.id and i.trip_id is not null and private.can_access_trip(i.trip_id))
        or exists (select 1 from public.documents d where d.company_id = f.company_id and d.file_id = f.id and d.trip_id is not null and private.can_access_trip(d.trip_id))
      )
  )
$$;
revoke all on function private.can_access_file(text) from public;
grant execute on function private.can_access_file(text) to authenticated;

create policy private_documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'companies'
  and (storage.foldername(name))[2] = (select private.current_company_id())::text
  and ((select private.is_staff()) or (select private.is_accounting()) or (select private.can_access_file(name)))
);

create policy private_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'companies'
  and (storage.foldername(name))[2] = (select private.current_company_id())::text
  and ((select private.is_staff()) or owner_id = (select auth.uid())::text)
);

create policy private_documents_update
on storage.objects for update to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[2] = (select private.current_company_id())::text
  and ((select private.is_staff()) or owner_id = (select auth.uid())::text)
)
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'companies'
  and (storage.foldername(name))[2] = (select private.current_company_id())::text
  and ((select private.is_staff()) or owner_id = (select auth.uid())::text)
);

-- No authenticated DELETE policy: documents are retained and superseded.
