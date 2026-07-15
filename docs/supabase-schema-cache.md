# Supabase Schema Cache Fix

If upload fails with:

```txt
Could not find the 'model' column of 'extraction_jobs' in the schema cache
```

the deployed database is behind the app code, or Supabase/PostgREST has not reloaded its schema cache.

## Fix

Run `supabase/migrations/20260609120000_async_extraction_pipeline.sql` in the Supabase SQL Editor for the hosted project.

Then reload the Data API schema cache:

```sql
select pg_notify('pgrst', 'reload schema');
```

## Verify

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'extraction_jobs'
  and column_name in ('provider', 'model', 'started_at', 'warnings', 'raw_result');

select to_regclass('public.upload_pages') as upload_pages_table;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'extracted_booking_candidates'
  and column_name in ('source_job_id', 'source_pages', 'source_snippets', 'extraction_method');
```

The app includes a temporary defensive fallback: upload can still create a minimal queued extraction job if `provider`/`model` are missing. Full OpenAI extraction and `/pipeline` verification still require this migration because they use `upload_pages` and candidate source fields.
