alter table public.trips
add column if not exists archived_at timestamptz;

create index if not exists trips_owner_archived_updated_idx
on public.trips (owner_id, archived_at, updated_at desc);

select pg_notify('pgrst', 'reload schema');
