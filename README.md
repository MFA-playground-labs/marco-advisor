# Marco Advisor

Upload-first travel intelligence for private trips. Marco shows a public read-only demo trip until the current Supabase session creates private trip data from uploaded documents, reviewed extraction candidates, accepted bookings, and scanner output.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Supabase Auth, Postgres, Storage, RLS, and a public demo snapshot
- OpenAI Responses API for PDF/image/text booking extraction and Marco advisor chat
- Vitest for scanner and extraction-schema tests

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Connect the existing Vercel project and pull local environment variables, or create `.env.local` manually:

   ```bash
   vercel link
   vercel env pull .env.development.local
   ```

   Next.js loads `.env.development.local` for local development. `.env.local` also works if you prefer that filename.

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   OPENAI_API_KEY=
   OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
   OPENAI_ADVISOR_MODEL=gpt-4.1-mini
   SUPABASE_SERVICE_ROLE_KEY=... # optional; only needed for admin/server-only jobs
   ```

   Older Supabase projects may expose `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the app supports either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Apply Marco's replacement Supabase migration in `supabase/migrations/20260607160000_upload_first_mvp.sql`.

   Use the hosted Supabase SQL Editor for the connected project. This migration replaces the earlier broad MVP schema with Marco's lightweight baseline, seeds the read-only `demo_trip_snapshots` row, creates private travel tables, applies RLS policies, and creates the private `trip-uploads` storage bucket. Current Supabase data is treated as disposable for this baseline.

4. Enable Supabase anonymous sign-ins.

   Marco creates a silent anonymous Supabase session in middleware. This removes the magic-link requirement while preserving RLS-backed `auth.uid()` ownership for uploads, trips, bookings, and scanner output. Anonymous users use the authenticated Supabase role, so their private data remains tied to the browser session that created it.

5. Run the app:

   ```bash
   npm run dev
   ```

## MVP Flow

1. Open `/dashboard`; Marco reads the public `marco-demo-trip` snapshot if the session has no private trip yet.
2. Upload a PDF, screenshot, text file, or exported email/document from `/upload`.
3. Marco stores the original in the private `trip-uploads` bucket under the current user id path.
4. OpenAI extracts booking candidates with a strict JSON schema.
5. Review candidates in `/upload` or `/bookings`.
6. Accept candidates to create confirmed private bookings.
7. Run `/scanner` to persist deterministic private issues.
8. Dashboard, bookings, timeline, itinerary, and financial exposure prefer private records once they exist.

## Verification

```bash
npm run typecheck
npm test
```

A public read-only seeded demo trip is included in `demo_trip_snapshots`. It is intentionally separate from private trip tables, so demo data never mixes with user-owned uploads, bookings, candidates, or scanner output. Automated test fixtures remain confined to tests.

Manual Supabase verification:

1. Open `/dashboard` and confirm the public demo trip loads without a login prompt.
2. Confirm unauthenticated/public table access is limited to `demo_trip_snapshots`.
3. Upload a PDF, screenshot, text file, or exported booking document.
4. Confirm Supabase rows appear in `trips`, `uploads`, `extraction_jobs`, and `extracted_booking_candidates` for the current `auth.uid()`.
5. Accept a candidate and confirm `bookings` plus `booking_segments`.
6. Run the scanner and confirm `trip_issues`.
7. Check dashboard, bookings, and scanner pages switch from the public demo snapshot to persisted private Supabase data for the anonymous session.
