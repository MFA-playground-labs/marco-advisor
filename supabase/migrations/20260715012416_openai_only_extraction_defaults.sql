alter table public.extraction_jobs
alter column provider set default 'openai';

create or replace function public.complete_extraction_job(
  input_job_id uuid,
  input_status text,
  input_pages jsonb default '[]'::jsonb,
  input_trip jsonb default '{}'::jsonb,
  input_bookings jsonb default '[]'::jsonb,
  input_warnings text[] default '{}'::text[],
  input_provider text default 'openai',
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
    raise exception 'Extraction job not found: %', input_job_id using errcode = 'P0002';
  end if;

  select *
  into upload_row
  from public.uploads u
  where u.id = job_row.upload_id;

  if not found then
    raise exception 'Upload not found for extraction job: %', input_job_id using errcode = 'P0002';
  end if;

  if job_row.status in ('succeeded', 'failed') then
    select count(*)::integer
    into existing_candidate_count
    from public.extracted_booking_candidates ebc
    where ebc.source_job_id = job_row.id;

    return query select job_row.status, existing_candidate_count, true;
    return;
  end if;

  if input_status = 'failed' then
    update public.uploads
    set status = 'failed'
    where id = upload_row.id;

    update public.extraction_jobs
    set
      status = 'failed',
      completed_at = completed_time,
      provider = coalesce(nullif(input_provider, ''), provider),
      model = coalesce(input_model, model),
      warnings = input_warnings,
      error_message = coalesce(input_error_message, 'Extraction failed.'),
      raw_result = coalesce(input_raw_result, '{}'::jsonb)
    where id = job_row.id;

    return query select 'failed'::text, 0::integer, false;
    return;
  end if;

  delete from public.upload_pages where job_id = job_row.id;

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
    job_row.upload_id,
    job_row.trip_id,
    job_row.id,
    (page.value ->> 'page_number')::integer,
    coalesce(page.value ->> 'text', ''),
    char_length(coalesce(page.value ->> 'text', '')),
    nullif(page.value ->> 'extraction_confidence', '')::numeric
  from jsonb_array_elements(coalesce(input_pages, '[]'::jsonb)) as page(value);

  for traveler_name in
    select trim(value)
    from jsonb_array_elements_text(coalesce(input_trip -> 'travelers', '[]'::jsonb)) as travelers(value)
    where trim(value) <> ''
  loop
    insert into public.travelers (trip_id, owner_id, name, email)
    select job_row.trip_id, upload_row.owner_id, traveler_name, null
    where not exists (
      select 1
      from public.travelers t
      where t.trip_id = job_row.trip_id
        and t.name = traveler_name
    );
  end loop;

  insert into public.extracted_booking_candidates (
    upload_id,
    trip_id,
    source_job_id,
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
    source_pages,
    source_snippets,
    extraction_method,
    raw_json
  )
  select
    job_row.upload_id,
    job_row.trip_id,
    job_row.id,
    'needs_review',
    coalesce(booking ->> 'booking_type', 'other'),
    coalesce(booking ->> 'title', 'Untitled booking'),
    booking ->> 'vendor',
    booking ->> 'location',
    nullif(booking ->> 'starts_at', '')::timestamptz,
    nullif(booking ->> 'ends_at', '')::timestamptz,
    nullif(booking ->> 'total_amount', '')::numeric,
    booking ->> 'currency',
    case
      when booking ? 'refundable' then (booking ->> 'refundable')::boolean
      else null
    end,
    nullif(booking ->> 'cancellation_deadline', '')::timestamptz,
    coalesce(
      array(select jsonb_array_elements_text(coalesce(booking -> 'traveler_names', '[]'::jsonb))),
      '{}'::text[]
    ),
    nullif(booking ->> 'confirmation_code', ''),
    coalesce(nullif(booking ->> 'confidence', '')::numeric, 0),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(booking -> 'missing_fields', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(booking -> 'source_pages', '[]'::jsonb))::integer),
      '{}'::integer[]
    ),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(booking -> 'source_snippets', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(nullif(booking ->> 'extraction_method', ''), 'manual'),
    booking
  from jsonb_array_elements(coalesce(input_bookings, '[]'::jsonb)) as booking;

  get diagnostics candidate_count = row_count;

  update public.uploads
  set status = 'review_ready'
  where id = upload_row.id;

  update public.extraction_jobs
  set
    status = 'succeeded',
    completed_at = completed_time,
    provider = coalesce(nullif(input_provider, ''), provider),
    model = coalesce(input_model, model),
    warnings = input_warnings,
    error_message = null,
    raw_result = coalesce(input_raw_result, '{}'::jsonb)
  where id = job_row.id;

  return query select 'succeeded'::text, candidate_count, false;
end;
$$;

revoke all on function public.complete_extraction_job(uuid, text, jsonb, jsonb, jsonb, text[], text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_extraction_job(uuid, text, jsonb, jsonb, jsonb, text[], text, text, text, jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
