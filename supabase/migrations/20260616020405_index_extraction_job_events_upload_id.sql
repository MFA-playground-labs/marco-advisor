create index if not exists extraction_job_events_upload_id_created_at_idx
on public.extraction_job_events (upload_id, created_at desc)
where upload_id is not null;
