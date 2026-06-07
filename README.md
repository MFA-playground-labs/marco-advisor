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

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OPENAI_API_KEY=...
   OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
   OPENAI_ADVISOR_MODEL=gpt-4.1-mini
   ```

3. Apply the Supabase migration in `supabase/migrations/20260607160000_upload_first_mvp.sql`.

4. Enable Supabase magic-link auth and set the site URL to your local or deployed app URL. The app includes `/login` and `/auth/callback`.

5. Run the app:

   ```bash
   npm run dev
   ```

## MVP Flow

1. Sign in at `/login`.
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
