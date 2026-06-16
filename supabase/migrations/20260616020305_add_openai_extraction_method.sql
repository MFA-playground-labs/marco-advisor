alter table public.extracted_booking_candidates
drop constraint if exists extracted_booking_candidates_extraction_method_check;

alter table public.extracted_booking_candidates
add constraint extracted_booking_candidates_extraction_method_check
check (extraction_method in ('rules', 'haiku', 'openai', 'manual'));

select pg_notify('pgrst', 'reload schema');
