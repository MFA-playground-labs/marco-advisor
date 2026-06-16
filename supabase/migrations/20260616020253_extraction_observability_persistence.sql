alter table public.uploads
add column if not exists trace_id text;

alter table public.extraction_jobs
add column if not exists trace_id text,
add column if not exists attempt_id text,
add column if not exists last_stage text,
add column if not exists provider_request_id text,
add column if not exists provider_latency_ms integer,
add column if not exists provider_usage jsonb not null default '{}'::jsonb;

alter table public.extraction_jobs
drop constraint if exists extraction_jobs_provider_latency_ms_check;

alter table public.extraction_jobs
add constraint extraction_jobs_provider_latency_ms_check
check (provider_latency_ms is null or provider_latency_ms >= 0);

alter table public.extraction_jobs
drop constraint if exists extraction_jobs_provider_usage_object_check;

alter table public.extraction_jobs
add constraint extraction_jobs_provider_usage_object_check
check (jsonb_typeof(provider_usage) = 'object');

drop function if exists public.claim_extraction_job(uuid);

create function public.claim_extraction_job(input_job_id uuid)
returns table (
  id uuid,
  upload_id uuid,
  trip_id uuid,
  status text,
  provider text,
  model text,
  trace_id text,
  attempt_id text,
  last_stage text,
  provider_request_id text,
  provider_latency_ms integer,
  provider_usage jsonb,
  error_message text,
  warnings text[],
  raw_result jsonb,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  claimed boolean,
  upload_owner_id uuid,
  upload_trip_id uuid,
  upload_filename text,
  upload_content_type text,
  upload_storage_path text,
  upload_status text,
  upload_trace_id text,
  upload_created_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  job_row public.extraction_jobs%rowtype;
  upload_row public.uploads%rowtype;
  claim_time timestamptz := now();
  did_claim boolean := false;
begin
  update public.extraction_jobs ej
  set status = 'processing',
      started_at = coalesce(ej.started_at, claim_time),
      updated_at = claim_time
  where ej.id = input_job_id
    and ej.status = 'queued'
  returning * into job_row;

  if found then
    did_claim := true;
  else
    select *
    into job_row
    from public.extraction_jobs ej
    where ej.id = input_job_id;

    if not found then
      raise exception 'Extraction job not found.' using errcode = 'P0002';
    end if;
  end if;

  select *
  into upload_row
  from public.uploads u
  where u.id = job_row.upload_id;

  if not found then
    raise exception 'Extraction job is missing its upload.' using errcode = 'P0002';
  end if;

  return query
  select
    job_row.id,
    job_row.upload_id,
    job_row.trip_id,
    job_row.status,
    job_row.provider,
    job_row.model,
    job_row.trace_id,
    job_row.attempt_id,
    job_row.last_stage,
    job_row.provider_request_id,
    job_row.provider_latency_ms,
    job_row.provider_usage,
    job_row.error_message,
    job_row.warnings,
    job_row.raw_result,
    job_row.created_at,
    job_row.started_at,
    job_row.completed_at,
    did_claim,
    upload_row.owner_id,
    upload_row.trip_id,
    upload_row.filename,
    upload_row.content_type,
    upload_row.storage_path,
    upload_row.status,
    upload_row.trace_id,
    upload_row.created_at;
end;
$$;

revoke all on function public.claim_extraction_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_extraction_job(uuid) to service_role;

create table if not exists public.extraction_job_events (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  job_id uuid references public.extraction_jobs(id) on delete cascade,
  upload_id uuid references public.uploads(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  attempt_id text,
  event text not null,
  stage text,
  status text,
  provider text,
  model text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.extraction_job_events
drop constraint if exists extraction_job_events_metadata_object_check;

alter table public.extraction_job_events
add constraint extraction_job_events_metadata_object_check
check (jsonb_typeof(metadata) = 'object');

create index if not exists uploads_trace_id_idx
on public.uploads (trace_id)
where trace_id is not null;

create index if not exists extraction_jobs_trace_id_idx
on public.extraction_jobs (trace_id)
where trace_id is not null;

create index if not exists extraction_jobs_attempt_id_idx
on public.extraction_jobs (attempt_id)
where attempt_id is not null;

create index if not exists extraction_jobs_status_last_stage_idx
on public.extraction_jobs (status, last_stage, updated_at desc);

create index if not exists extraction_job_events_trace_id_created_at_idx
on public.extraction_job_events (trace_id, created_at desc);

create index if not exists extraction_job_events_job_id_created_at_idx
on public.extraction_job_events (job_id, created_at desc);

create index if not exists extraction_job_events_trip_id_created_at_idx
on public.extraction_job_events (trip_id, created_at desc);

alter table public.extraction_job_events enable row level security;

revoke all on public.extraction_job_events from public, anon, authenticated;
grant select on public.extraction_job_events to authenticated;
grant select, insert on public.extraction_job_events to service_role;

drop policy if exists "extraction job events trip owner read" on public.extraction_job_events;
create policy "extraction job events trip owner read"
on public.extraction_job_events for select
to authenticated
using (exists (
  select 1
  from public.trips t
  where t.id = trip_id
    and t.owner_id = (select auth.uid())
));
