-- Storage upload retries run before public.files metadata is guaranteed to
-- exist. Give only the authenticated uploader a narrow SELECT path so the
-- Storage API can detect and overwrite its own orphaned trip evidence.

drop policy if exists private_documents_owner_retry_select on storage.objects;

create policy private_documents_owner_retry_select
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and owner_id = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 5
  and (storage.foldername(name))[1] = 'companies'
  and (storage.foldername(name))[2] = (select private.current_company_id())::text
  and (storage.foldername(name))[3] = 'trip-activity'
  and (storage.foldername(name))[4] in ('fuel_entry', 'expense', 'incident')
  and (storage.foldername(name))[5] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-.+$'
);
