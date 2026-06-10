alter table public.extraction_jobs
add column if not exists provider text not null default 'n8n',
add column if not exists model text,
add column if not exists started_at timestamptz,
add column if not exists warnings text[] not null default '{}',
add column if not exists raw_result jsonb not null default '{}'::jsonb;

create table if not exists public.upload_pages (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  job_id uuid not null references public.extraction_jobs(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  text text not null,
  char_count integer not null default 0 check (char_count >= 0),
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  created_at timestamptz not null default now(),
  foreign key (upload_id, trip_id) references public.uploads(id, trip_id) on delete cascade,
  unique (job_id, page_number)
);

alter table public.extracted_booking_candidates
add column if not exists source_job_id uuid references public.extraction_jobs(id) on delete set null,
add column if not exists source_pages integer[] not null default '{}',
add column if not exists source_snippets text[] not null default '{}',
add column if not exists extraction_method text not null default 'manual'
  check (extraction_method in ('rules', 'haiku', 'manual'));

create index if not exists upload_pages_upload_id_idx on public.upload_pages (upload_id);
create index if not exists upload_pages_job_id_page_number_idx on public.upload_pages (job_id, page_number);
create index if not exists extraction_jobs_upload_id_status_idx on public.extraction_jobs (upload_id, status);
create index if not exists extracted_booking_candidates_source_job_id_idx on public.extracted_booking_candidates (source_job_id);

alter table public.upload_pages enable row level security;

revoke all on public.upload_pages from anon;
grant select, insert, update, delete on public.upload_pages to authenticated;

drop policy if exists "upload pages trip owner access" on public.upload_pages;
create policy "upload pages trip owner access"
on public.upload_pages for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

select pg_notify('pgrst', 'reload schema');
