create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (trip_id, name)
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  filename text not null,
  content_type text not null,
  storage_path text not null,
  status text not null check (status in ('uploaded', 'extracting', 'review_ready', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.upload_files (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text not null,
  byte_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  status text not null check (status in ('queued', 'processing', 'succeeded', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.extracted_booking_candidates (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  status text not null check (status in ('needs_review', 'accepted', 'rejected')),
  booking_type text not null check (booking_type in ('hotel', 'flight', 'car', 'activity', 'other')),
  title text not null,
  vendor text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  total_amount numeric,
  currency text,
  refundable boolean,
  cancellation_deadline timestamptz,
  traveler_names text[] not null default '{}',
  confirmation_code text,
  confidence numeric not null default 0,
  missing_fields text[] not null default '{}',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null check (type in ('hotel', 'flight', 'car', 'activity', 'other')),
  status text not null check (status in ('pending_review', 'confirmed', 'cancelled', 'rejected')),
  vendor text not null,
  title text not null,
  location text,
  confirmation_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  total_amount numeric,
  currency text,
  refundable boolean,
  cancellation_deadline timestamptz,
  traveler_names text[] not null default '{}',
  source_upload_id uuid references public.uploads(id) on delete set null,
  confidence numeric,
  missing_fields text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_segments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null check (type in ('hotel', 'flight', 'car', 'activity', 'other')),
  label text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  origin text,
  destination text,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_issues (
  id text primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null check (status in ('unresolved', 'in_progress', 'resolved', 'risk_accepted', 'dismissed')),
  category text not null,
  title text not null,
  summary text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  financial_impact numeric,
  currency text,
  related_booking_ids uuid[] not null default '{}',
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_actions (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.trip_issues(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null,
  status text not null default 'suggested',
  created_at timestamptz not null default now()
);

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.trip_issues(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.preference_profiles (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  title text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_day_id uuid not null references public.itinerary_days(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  cost_estimate numeric,
  source text not null default 'marco',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.chat_threads(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('trip-uploads', 'trip-uploads', false)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.travelers enable row level security;
alter table public.uploads enable row level security;
alter table public.upload_files enable row level security;
alter table public.extraction_jobs enable row level security;
alter table public.extracted_booking_candidates enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_segments enable row level security;
alter table public.trip_issues enable row level security;
alter table public.issue_actions enable row level security;
alter table public.issue_events enable row level security;
alter table public.preference_profiles enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles owner access" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "trips owner access" on public.trips for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "travelers trip owner access" on public.travelers for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "uploads owner access" on public.uploads for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "upload files owner access" on public.upload_files for all using (exists (select 1 from public.uploads u where u.id = upload_id and u.owner_id = auth.uid())) with check (exists (select 1 from public.uploads u where u.id = upload_id and u.owner_id = auth.uid()));
create policy "extraction jobs trip owner access" on public.extraction_jobs for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "candidates trip owner access" on public.extracted_booking_candidates for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "bookings trip owner access" on public.bookings for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "segments trip owner access" on public.booking_segments for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "issues trip owner access" on public.trip_issues for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "issue actions trip owner access" on public.issue_actions for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "issue events trip owner access" on public.issue_events for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "preferences trip owner access" on public.preference_profiles for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "itinerary days trip owner access" on public.itinerary_days for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "itinerary items trip owner access" on public.itinerary_items for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "chat threads owner access" on public.chat_threads for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "chat messages owner access" on public.chat_messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "audit events owner access" on public.audit_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "users can upload own trip files" on storage.objects for insert
with check (bucket_id = 'trip-uploads' and owner = auth.uid());

create policy "users can read own trip files" on storage.objects for select
using (bucket_id = 'trip-uploads' and owner = auth.uid());

create policy "users can update own trip files" on storage.objects for update
using (bucket_id = 'trip-uploads' and owner = auth.uid());
