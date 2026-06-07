# Marco Advisor

Upload-first travel intelligence for private trips. This MVP reconstructs the Marco/Base44 interface as a real Next.js app with no user-visible seeded data: pages render from uploaded documents, reviewed extraction candidates, accepted bookings, and scanner output.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Supabase Auth, Postgres, Storage, and RLS
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
   OPENAI_API_KEY=...
   OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
   OPENAI_ADVISOR_MODEL=gpt-4.1-mini
   SUPABASE_SERVICE_ROLE_KEY=... # optional; only needed for admin/server-only jobs
   ```

   Older Supabase projects may expose `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the app supports either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Apply Marco's Supabase migration in `supabase/migrations/20260607160000_upload_first_mvp.sql`.

   Use the hosted Supabase SQL Editor for the connected project. This migration creates Marco's travel tables, RLS policies, and the private `trip-uploads` storage bucket. Do not use the generic Supabase `notes` table demo or public anonymous read policies for this app.

4. Enable Supabase anonymous sign-ins.

   Marco creates a silent anonymous Supabase session in middleware. This removes the magic-link requirement while preserving RLS-backed `auth.uid()` ownership for uploads, trips, bookings, and scanner output. Anonymous user data remains tied to the browser session that created it.

5. Run the app:

   ```bash
   npm run dev
   ```

## MVP Flow

1. Open `/dashboard` or `/upload`; Marco starts an anonymous Supabase session automatically.
2. Upload a PDF, screenshot, text file, or exported email/document from `/upload`.
3. Marco stores the original in the private `trip-uploads` bucket.
4. OpenAI extracts booking candidates with a strict JSON schema.
5. Review candidates in `/upload` or `/bookings`.
6. Accept candidates to create confirmed bookings.
7. Run `/scanner` to persist deterministic issues.
8. Dashboard, bookings, timeline, itinerary, and financial exposure render from persisted records only.

## Verification

```bash
npm run typecheck
npm test
```

No seeded trip data is included. Automated test fixtures are confined to tests and do not populate the running app.

Manual Supabase verification:

1. Open `/dashboard` and confirm the app loads without a login prompt.
2. Upload a PDF, screenshot, text file, or exported booking document.
3. Confirm Supabase rows appear in `trips`, `uploads`, `extraction_jobs`, and `extracted_booking_candidates`.
4. Accept a candidate and confirm `bookings` plus `booking_segments`.
5. Run the scanner and confirm `trip_issues`.
6. Check dashboard, bookings, and scanner pages render persisted Supabase data for the anonymous session.
