-- Documents were originally immutable metadata and therefore had no revision
-- timestamp.  Attaching a private file is now an audited, concurrent update,
-- so it needs the same optimistic-concurrency boundary as the other masters.

alter table public.documents
  add column updated_at timestamptz not null default now();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

comment on column public.documents.updated_at is
  'Last mutable document metadata revision; used by audited attachment commands to reject stale edits.';
