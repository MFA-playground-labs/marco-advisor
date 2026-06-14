create or replace function public.claim_extraction_job(input_job_id uuid)
returns table (
  id uuid,
  upload_id uuid,
  trip_id uuid,
  status text,
  provider text,
  model text,
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
    upload_row.created_at;
end;
$$;

create or replace function public.complete_extraction_job(
  input_job_id uuid,
  input_status text,
  input_pages jsonb default '[]'::jsonb,
  input_trip jsonb default '{}'::jsonb,
  input_bookings jsonb default '[]'::jsonb,
  input_warnings text[] default '{}'::text[],
  input_provider text default 'n8n',
  input_model text default null,
  input_error_message text default null,
  input_raw_result jsonb default '{}'::jsonb
)
returns table (
  status text,
  candidates integer,
  duplicate boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  job_row public.extraction_jobs%rowtype;
  upload_row public.uploads%rowtype;
  completed_time timestamptz := now();
  candidate_count integer := 0;
  existing_candidate_count integer := 0;
  traveler_name text;
  booking jsonb;
begin
  if input_status not in ('succeeded', 'failed') then
    raise exception 'Unsupported extraction status: %', input_status using errcode = '22023';
  end if;

  select *
  into job_row
  from public.extraction_jobs ej
  where ej.id = input_job_id
  for update;

  if not found then
    raise exception 'Extraction job not found.' using errcode = 'P0002';
  end if;

  select *
  into upload_row
  from public.uploads u
  where u.id = job_row.upload_id
  for update;

  if not found then
    raise exception 'Extraction job is missing its upload.' using errcode = 'P0002';
  end if;

  if job_row.status in ('succeeded', 'failed') then
    select count(*)
    into existing_candidate_count
    from public.extracted_booking_candidates ebc
    where ebc.source_job_id = job_row.id;

    return query select job_row.status, existing_candidate_count, true;
    return;
  end if;

  if input_status = 'failed' then
    update public.uploads
    set status = 'failed',
        updated_at = completed_time
    where id = upload_row.id;

    update public.extraction_jobs
    set status = 'failed',
        error_message = coalesce(input_error_message, input_warnings[1], 'Extraction failed.'),
        provider = coalesce(nullif(input_provider, ''), provider),
        model = input_model,
        warnings = coalesce(input_warnings, '{}'::text[]),
        raw_result = coalesce(input_raw_result, '{}'::jsonb),
        completed_at = completed_time,
        updated_at = completed_time
    where id = job_row.id;

    return query select 'failed'::text, 0, false;
    return;
  end if;

  delete from public.upload_pages
  where job_id = job_row.id;

  insert into public.upload_pages (
    upload_id,
    trip_id,
    job_id,
    page_number,
    text,
    char_count,
    extraction_confidence
  )
  select
    upload_row.id,
    job_row.trip_id,
    job_row.id,
    (page.value ->> 'page_number')::integer,
    page.value ->> 'text',
    length(coalesce(page.value ->> 'text', '')),
    nullif(page.value ->> 'extraction_confidence', '')::numeric
  from jsonb_array_elements(coalesce(input_pages, '[]'::jsonb)) as page(value);

  update public.trips
  set name = coalesce(nullif(input_trip ->> 'name', ''), name),
      destination = coalesce(nullif(input_trip ->> 'destination', ''), destination),
      starts_on = coalesce(nullif(input_trip ->> 'starts_on', '')::date, starts_on),
      ends_on = coalesce(nullif(input_trip ->> 'ends_on', '')::date, ends_on),
      updated_at = completed_time
  where id = job_row.trip_id
    and (
      nullif(input_trip ->> 'name', '') is not null
      or nullif(input_trip ->> 'destination', '') is not null
      or nullif(input_trip ->> 'starts_on', '') is not null
      or nullif(input_trip ->> 'ends_on', '') is not null
    );

  for traveler_name in
    select trim(value)
    from jsonb_array_elements_text(coalesce(input_trip -> 'travelers', '[]'::jsonb)) as travelers(value)
    where trim(value) <> ''
  loop
    insert into public.travelers (trip_id, owner_id, name, email)
    values (job_row.trip_id, upload_row.owner_id, traveler_name, null)
    on conflict (trip_id, name) do update
    set owner_id = excluded.owner_id,
        updated_at = completed_time;
  end loop;

  delete from public.extracted_booking_candidates ebc
  where ebc.source_job_id = job_row.id
    and ebc.status = 'needs_review';

  for booking in
    select value
    from jsonb_array_elements(coalesce(input_bookings, '[]'::jsonb)) as bookings(value)
  loop
    insert into public.extracted_booking_candidates (
      upload_id,
      trip_id,
      status,
      booking_type,
      title,
      vendor,
      location,
      starts_at,
      ends_at,
      total_amount,
      currency,
      refundable,
      cancellation_deadline,
      traveler_names,
      confirmation_code,
      confidence,
      missing_fields,
      source_job_id,
      source_pages,
      source_snippets,
      extraction_method,
      raw_json
    )
    values (
      upload_row.id,
      job_row.trip_id,
      'needs_review',
      booking ->> 'booking_type',
      booking ->> 'title',
      nullif(booking ->> 'vendor', ''),
      nullif(booking ->> 'location', ''),
      nullif(booking ->> 'starts_at', '')::timestamptz,
      nullif(booking ->> 'ends_at', '')::timestamptz,
      nullif(booking ->> 'total_amount', '')::numeric,
      nullif(booking ->> 'currency', ''),
      case
        when booking ? 'refundable' and jsonb_typeof(booking -> 'refundable') <> 'null'
          then (booking ->> 'refundable')::boolean
        else null
      end,
      nullif(booking ->> 'cancellation_deadline', '')::timestamptz,
      array(
        select value
        from jsonb_array_elements_text(coalesce(booking -> 'traveler_names', '[]'::jsonb)) as names(value)
      ),
      nullif(booking ->> 'confirmation_code', ''),
      coalesce(nullif(booking ->> 'confidence', '')::numeric, 0),
      array(
        select value
        from jsonb_array_elements_text(coalesce(booking -> 'missing_fields', '[]'::jsonb)) as fields(value)
      ),
      job_row.id,
      array(
        select value::integer
        from jsonb_array_elements_text(coalesce(booking -> 'source_pages', '[]'::jsonb)) as pages(value)
      ),
      array(
        select value
        from jsonb_array_elements_text(coalesce(booking -> 'source_snippets', '[]'::jsonb)) as snippets(value)
      ),
      coalesce(nullif(booking ->> 'extraction_method', ''), 'manual'),
      booking
    );

    candidate_count := candidate_count + 1;
  end loop;

  update public.uploads
  set status = 'review_ready',
      updated_at = completed_time
  where id = upload_row.id;

  update public.extraction_jobs
  set status = 'succeeded',
      provider = coalesce(nullif(input_provider, ''), provider),
      model = input_model,
      warnings = coalesce(input_warnings, '{}'::text[]),
      raw_result = coalesce(input_raw_result, '{}'::jsonb),
      completed_at = completed_time,
      updated_at = completed_time
  where id = job_row.id;

  return query select 'succeeded'::text, candidate_count, false;
end;
$$;

revoke all on function public.claim_extraction_job(uuid) from public, anon, authenticated;
revoke all on function public.complete_extraction_job(uuid, text, jsonb, jsonb, jsonb, text[], text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.claim_extraction_job(uuid) to service_role;
grant execute on function public.complete_extraction_job(uuid, text, jsonb, jsonb, jsonb, text[], text, text, text, jsonb) to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "profiles owner access" on public.profiles;
create policy "profiles owner access"
on public.profiles for all
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "trips owner access" on public.trips;
create policy "trips owner access"
on public.trips for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "travelers trip owner access" on public.travelers;
create policy "travelers trip owner access"
on public.travelers for all
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
)
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
);

drop policy if exists "uploads trip owner access" on public.uploads;
create policy "uploads trip owner access"
on public.uploads for all
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
)
with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid()))
);

drop policy if exists "extraction jobs trip owner access" on public.extraction_jobs;
create policy "extraction jobs trip owner access"
on public.extraction_jobs for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

drop policy if exists "candidates trip owner access" on public.extracted_booking_candidates;
create policy "candidates trip owner access"
on public.extracted_booking_candidates for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

drop policy if exists "bookings trip owner access" on public.bookings;
create policy "bookings trip owner access"
on public.bookings for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

drop policy if exists "segments trip owner access" on public.booking_segments;
create policy "segments trip owner access"
on public.booking_segments for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

drop policy if exists "issues trip owner access" on public.trip_issues;
create policy "issues trip owner access"
on public.trip_issues for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

drop policy if exists "upload pages trip owner access" on public.upload_pages;
create policy "upload pages trip owner access"
on public.upload_pages for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

select pg_notify('pgrst', 'reload schema');
