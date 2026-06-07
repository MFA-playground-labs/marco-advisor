create extension if not exists "pgcrypto";

drop policy if exists "users can upload own trip files" on storage.objects;
drop policy if exists "users can read own trip files" on storage.objects;
drop policy if exists "users can update own trip files" on storage.objects;
drop policy if exists "users can delete own trip files" on storage.objects;

drop table if exists public.audit_events cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_threads cascade;
drop table if exists public.itinerary_items cascade;
drop table if exists public.itinerary_days cascade;
drop table if exists public.preference_profiles cascade;
drop table if exists public.issue_events cascade;
drop table if exists public.issue_actions cascade;
drop table if exists public.upload_files cascade;
drop table if exists public.trip_issues cascade;
drop table if exists public.booking_segments cascade;
drop table if exists public.bookings cascade;
drop table if exists public.extracted_booking_candidates cascade;
drop table if exists public.extraction_jobs cascade;
drop table if exists public.uploads cascade;
drop table if exists public.travelers cascade;
drop table if exists public."public.trips" cascade;
drop table if exists public.trips cascade;
drop table if exists public.profiles cascade;
drop table if exists public.demo_trip_snapshots cascade;
drop function if exists public.set_updated_at() cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.demo_trip_snapshots (
  slug text primary key,
  title text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travelers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, name)
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  filename text not null,
  content_type text not null,
  storage_path text not null,
  status text not null check (status in ('uploaded', 'extracting', 'review_ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id),
  unique (storage_path)
);

create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  status text not null check (status in ('queued', 'processing', 'succeeded', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (upload_id, trip_id) references public.uploads(id, trip_id) on delete cascade
);

create table public.extracted_booking_candidates (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
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
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  missing_fields text[] not null default '{}',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (upload_id, trip_id) references public.uploads(id, trip_id) on delete cascade
);

create table public.bookings (
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
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  missing_fields text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id)
);

create table public.booking_segments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null check (type in ('hotel', 'flight', 'car', 'activity', 'other')),
  label text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  origin text,
  destination text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (booking_id, trip_id) references public.bookings(id, trip_id) on delete cascade
);

create table public.trip_issues (
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

create trigger set_demo_trip_snapshots_updated_at before update on public.demo_trip_snapshots for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
create trigger set_travelers_updated_at before update on public.travelers for each row execute function public.set_updated_at();
create trigger set_uploads_updated_at before update on public.uploads for each row execute function public.set_updated_at();
create trigger set_extraction_jobs_updated_at before update on public.extraction_jobs for each row execute function public.set_updated_at();
create trigger set_extracted_booking_candidates_updated_at before update on public.extracted_booking_candidates for each row execute function public.set_updated_at();
create trigger set_bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger set_booking_segments_updated_at before update on public.booking_segments for each row execute function public.set_updated_at();
create trigger set_trip_issues_updated_at before update on public.trip_issues for each row execute function public.set_updated_at();

create index trips_owner_id_created_at_idx on public.trips (owner_id, created_at desc);
create index travelers_owner_id_idx on public.travelers (owner_id);
create index travelers_trip_id_idx on public.travelers (trip_id);
create index uploads_owner_id_created_at_idx on public.uploads (owner_id, created_at desc);
create index uploads_trip_id_created_at_idx on public.uploads (trip_id, created_at desc);
create index extraction_jobs_upload_id_idx on public.extraction_jobs (upload_id);
create index extraction_jobs_trip_id_status_idx on public.extraction_jobs (trip_id, status);
create index extracted_booking_candidates_upload_id_idx on public.extracted_booking_candidates (upload_id);
create index extracted_booking_candidates_trip_id_created_at_idx on public.extracted_booking_candidates (trip_id, created_at desc);
create index bookings_trip_id_starts_at_idx on public.bookings (trip_id, starts_at);
create index booking_segments_booking_id_idx on public.booking_segments (booking_id);
create index booking_segments_trip_id_starts_at_idx on public.booking_segments (trip_id, starts_at);
create index trip_issues_trip_id_status_severity_idx on public.trip_issues (trip_id, status, severity);

insert into public.demo_trip_snapshots (slug, title, snapshot)
values (
  'marco-demo-trip',
  'Marco Demo Trip',
  $json$
  {
    "trip": {
      "id": "00000000-0000-4000-8000-000000000101",
      "owner_id": "00000000-0000-4000-8000-000000000000",
      "name": "Paris Recovery Weekend",
      "destination": "Paris, France",
      "starts_on": "2026-07-12",
      "ends_on": "2026-07-16",
      "created_at": "2026-06-07T00:00:00Z"
    },
    "travelers": [
      {
        "id": "00000000-0000-4000-8000-000000000201",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "name": "Maya Chen",
        "email": null
      },
      {
        "id": "00000000-0000-4000-8000-000000000202",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "name": "Jordan Lee",
        "email": null
      }
    ],
    "bookings": [
      {
        "id": "00000000-0000-4000-8000-000000000301",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "flight",
        "status": "confirmed",
        "vendor": "Air France",
        "title": "AF 23 JFK to CDG",
        "location": "New York to Paris",
        "confirmation_code": "AF7K92",
        "starts_at": "2026-07-12T00:20:00Z",
        "ends_at": "2026-07-12T07:45:00Z",
        "total_amount": 1280,
        "currency": "USD",
        "refundable": false,
        "cancellation_deadline": null,
        "traveler_names": ["Maya Chen", "Jordan Lee"],
        "source_upload_id": null,
        "confidence": 0.96,
        "missing_fields": [],
        "notes": "Overnight arrival into CDG."
      },
      {
        "id": "00000000-0000-4000-8000-000000000302",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "hotel",
        "status": "confirmed",
        "vendor": "Hotel Saint-Germain",
        "title": "Hotel Saint-Germain",
        "location": "Saint-Germain-des-Pres",
        "confirmation_code": "HSG-4812",
        "starts_at": "2026-07-12T15:00:00Z",
        "ends_at": "2026-07-15T11:00:00Z",
        "total_amount": 960,
        "currency": "USD",
        "refundable": true,
        "cancellation_deadline": "2026-07-08T23:59:00Z",
        "traveler_names": ["Maya Chen", "Jordan Lee"],
        "source_upload_id": null,
        "confidence": 0.93,
        "missing_fields": [],
        "notes": "Refundable until the deadline."
      },
      {
        "id": "00000000-0000-4000-8000-000000000303",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "hotel",
        "status": "confirmed",
        "vendor": "Canal Boutique Hotel",
        "title": "Canal Boutique Hotel",
        "location": "Canal Saint-Martin",
        "confirmation_code": "CBH-9031",
        "starts_at": "2026-07-14T15:00:00Z",
        "ends_at": "2026-07-16T11:00:00Z",
        "total_amount": 720,
        "currency": "USD",
        "refundable": false,
        "cancellation_deadline": null,
        "traveler_names": ["Maya Chen", "Jordan Lee"],
        "source_upload_id": null,
        "confidence": 0.91,
        "missing_fields": [],
        "notes": "Overlaps the Saint-Germain stay by one night."
      },
      {
        "id": "00000000-0000-4000-8000-000000000304",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "activity",
        "status": "confirmed",
        "vendor": "Musee d'Orsay",
        "title": "Timed entry at Musee d'Orsay",
        "location": "Musee d'Orsay",
        "confirmation_code": "ORSAY-214",
        "starts_at": "2026-07-13T13:30:00Z",
        "ends_at": "2026-07-13T15:30:00Z",
        "total_amount": 64,
        "currency": "USD",
        "refundable": true,
        "cancellation_deadline": null,
        "traveler_names": ["Maya Chen", "Jordan Lee"],
        "source_upload_id": null,
        "confidence": 0.89,
        "missing_fields": [],
        "notes": "Good anchor for a left-bank afternoon."
      }
    ],
    "segments": [
      {
        "id": "00000000-0000-4000-8000-000000000401",
        "booking_id": "00000000-0000-4000-8000-000000000301",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "flight",
        "label": "AF 23 JFK to CDG",
        "starts_at": "2026-07-12T00:20:00Z",
        "ends_at": "2026-07-12T07:45:00Z",
        "origin": "JFK",
        "destination": "CDG",
        "location": null
      },
      {
        "id": "00000000-0000-4000-8000-000000000402",
        "booking_id": "00000000-0000-4000-8000-000000000302",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "hotel",
        "label": "Hotel Saint-Germain",
        "starts_at": "2026-07-12T15:00:00Z",
        "ends_at": "2026-07-15T11:00:00Z",
        "origin": null,
        "destination": null,
        "location": "Saint-Germain-des-Pres"
      },
      {
        "id": "00000000-0000-4000-8000-000000000403",
        "booking_id": "00000000-0000-4000-8000-000000000303",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "type": "hotel",
        "label": "Canal Boutique Hotel",
        "starts_at": "2026-07-14T15:00:00Z",
        "ends_at": "2026-07-16T11:00:00Z",
        "origin": null,
        "destination": null,
        "location": "Canal Saint-Martin"
      }
    ],
    "candidates": [],
    "issues": [
      {
        "id": "double_booking:00000000-0000-4000-8000-000000000302:00000000-0000-4000-8000-000000000303",
        "trip_id": "00000000-0000-4000-8000-000000000101",
        "severity": "high",
        "status": "unresolved",
        "category": "double_booking",
        "title": "Hotel Saint-Germain overlaps Canal Boutique Hotel",
        "summary": "Two hotel bookings overlap on July 14. Review which stay should remain active.",
        "starts_at": "2026-07-14T15:00:00Z",
        "ends_at": "2026-07-15T11:00:00Z",
        "financial_impact": 1680,
        "currency": "USD",
        "related_booking_ids": [
          "00000000-0000-4000-8000-000000000302",
          "00000000-0000-4000-8000-000000000303"
        ],
        "recommended_action": "Compare cancellation terms and keep only the hotel you intend to use."
      }
    ],
    "uploads": [],
    "isDemo": true
  }
  $json$::jsonb
)
on conflict (slug) do update
set title = excluded.title,
    snapshot = excluded.snapshot,
    updated_at = now();

insert into storage.buckets (id, name, public)
values ('trip-uploads', 'trip-uploads', false)
on conflict (id) do update
set public = false;

alter table public.demo_trip_snapshots enable row level security;
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.travelers enable row level security;
alter table public.uploads enable row level security;
alter table public.extraction_jobs enable row level security;
alter table public.extracted_booking_candidates enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_segments enable row level security;
alter table public.trip_issues enable row level security;

revoke all on public.demo_trip_snapshots from anon, authenticated;
grant select on public.demo_trip_snapshots to anon, authenticated;

revoke all on public.profiles from anon;
revoke all on public.trips from anon;
revoke all on public.travelers from anon;
revoke all on public.uploads from anon;
revoke all on public.extraction_jobs from anon;
revoke all on public.extracted_booking_candidates from anon;
revoke all on public.bookings from anon;
revoke all on public.booking_segments from anon;
revoke all on public.trip_issues from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.travelers to authenticated;
grant select, insert, update, delete on public.uploads to authenticated;
grant select, insert, update, delete on public.extraction_jobs to authenticated;
grant select, insert, update, delete on public.extracted_booking_candidates to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.booking_segments to authenticated;
grant select, insert, update, delete on public.trip_issues to authenticated;

create policy "demo trip snapshots are public read only"
on public.demo_trip_snapshots for select
to anon, authenticated
using (true);

create policy "profiles owner access"
on public.profiles for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "trips owner access"
on public.trips for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "travelers trip owner access"
on public.travelers for all
to authenticated
using (
  owner_id = auth.uid()
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
)
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
);

create policy "uploads trip owner access"
on public.uploads for all
to authenticated
using (
  owner_id = auth.uid()
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
)
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
);

create policy "extraction jobs trip owner access"
on public.extraction_jobs for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "candidates trip owner access"
on public.extracted_booking_candidates for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "bookings trip owner access"
on public.bookings for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "segments trip owner access"
on public.booking_segments for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "issues trip owner access"
on public.trip_issues for all
to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "users can upload own trip files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can read own trip files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trip-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update own trip files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'trip-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'trip-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete own trip files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trip-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
