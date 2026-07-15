# Marco Advisor Specification Catalog

Generated from the codebase on 2026-06-14. This is a first-pass living specification intended to support a shift toward specification-driven development. It documents current behavior, not desired future behavior.

## 1. Product Boundary

Marco Advisor is an upload-first travel intelligence app. It shows a public read-only demo trip until the current Supabase session creates private trip data from uploaded evidence. User-owned data flows through upload records, async extraction jobs, reviewable booking candidates, accepted bookings, deterministic scanner issues, and dashboard/advisor views.

Primary stack:

- Next.js App Router, React, TypeScript, Tailwind.
- Supabase Auth, Postgres, Storage, RLS.
- OpenAI-first async extraction pipeline.
- OpenAI Responses API for Marco advisor chat and evidence extraction.
- Vitest unit coverage for extraction schema, workflow orchestration, scanner logic, and selected repository fallback behavior.

## 2. Core Runtime Rules

### Anonymous Session Middleware

Source: `middleware.ts`

Purpose:

- Create or refresh a Supabase SSR session before protected app routes and application API routes run.
- If no user exists and the path is an app/API path, call `signInAnonymously()`.
- Skip all Supabase behavior when public Supabase env vars are missing.

Path scope:

- App paths: `/`, `/dashboard`, `/bookings`, `/itinerary`, `/pipeline`, `/timeline`, `/scanner`, `/settings`, `/upload`.
- API paths: `/api/candidates`, `/api/extractions`, `/api/marco`, `/api/scanner`, `/api/trips`, `/api/upload`.

Acceptance criteria:

- Any scoped page/API request should have an authenticated Supabase user when anonymous sign-ins are enabled.
- Static assets and common image files are excluded by the matcher.
- Middleware must not throw when Supabase env vars are absent.

## 3. Environment Contract

Sources: `.env.example`, `lib/supabase-env.ts`, `lib/supabase.ts`, `app/(app)/settings/page.tsx`

Required for normal app behavior:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` for Marco chat and upload extraction

Required for OpenAI extraction:

- `SUPABASE_SERVICE_ROLE_KEY`
- `EXTRACTION_RUN_SECRET` for the protected manual retry endpoint

Async extraction configuration:

- `OPENAI_EXTRACTION_MODEL`: defaults to `gpt-4.1-mini`.
- `OPENAI_EXTRACTION_MAX_ENCODED_BYTES`: defaults to `20971520`.
- `EXTRACTION_CONFIDENCE_THRESHOLD`: defaults to `0.85`.
- `EXTRACTION_MAX_PAGES`: defaults to `10`.
- `EXTRACTION_MAX_TEXT_CHARS`: defaults to `25000`.
- `EXTRACTION_STALE_PROCESSING_MS`: defaults to `900000`.

## 4. Persistent Data Contract

Sources: `supabase/migrations/20260607160000_upload_first_mvp.sql`, `supabase/migrations/20260609120000_async_extraction_pipeline.sql`, `lib/types.ts`, `lib/database.types.ts`

### Public Demo Data

Table: `public.demo_trip_snapshots`

Purpose:

- Stores a public read-only JSON snapshot keyed by `slug`.
- Seeded with `marco-demo-trip`.
- Used when no private trip exists for the current session.

Security:

- RLS enabled.
- `anon` and `authenticated` may select.
- No public write access.

### Private Tables

Tables:

- `profiles`
- `trips`
- `travelers`
- `uploads`
- `extraction_jobs`
- `upload_pages`
- `extracted_booking_candidates`
- `bookings`
- `booking_segments`
- `trip_issues`

Security:

- RLS is enabled on each table.
- `anon` access is revoked.
- `authenticated` receives CRUD grants.
- RLS policies scope access to `auth.uid()` ownership, usually by `trips.owner_id`.

### Storage

Bucket: `trip-uploads`

Purpose:

- Private storage for uploaded trip evidence.
- Storage object path begins with the authenticated user id.

Security:

- Bucket is private.
- Authenticated users can insert/select/update/delete only objects whose first folder path segment equals `auth.uid()::text`.

## 5. API Route Specifications

### `POST /api/upload`

Source: `app/api/upload/route.ts`

Purpose:

- Accept multipart trip evidence.
- Store file in Supabase Storage.
- Create or reuse the active trip.
- Create an upload row and queued extraction job.
- Schedule local OpenAI extraction.

Runtime:

- Node.js runtime.
- `maxDuration = 30`.

Request:

- `multipart/form-data`
- Required `file`.
- Optional `tripName`, `destination`, `startsOn`, `endsOn`.

Responses:

- `200` JSON: `{ upload, job, scheduled, warning? }`
- `400` JSON when no file is provided or workflow validation fails.
- `401` JSON when no Supabase user exists.
- `500` JSON when Supabase is not configured or unexpected failure occurs.

Delegates:

- `uploadEvidence()`

### `POST /api/candidates/[id]`

Source: `app/api/candidates/[id]/route.ts`

Purpose:

- Accept or reject one extracted booking candidate.

Request:

- `multipart/form-data`
- `intent`: `accept` or `reject`.

Responses:

- On success, redirects to `/bookings` with `303`.
- On failure, returns JSON `{ error }`.

Delegates:

- `reviewCandidate()`

### `POST /api/marco`

Source: `app/api/marco/route.ts`

Purpose:

- Answer user questions using current trip snapshot context.

Request:

- JSON body with `question`.

Responses:

- `200` JSON: `{ answer }`
- `400` JSON when `question` is blank.
- `401` JSON when a user session is unavailable.
- `500` JSON when Supabase is not configured or another error occurs.

Delegates:

- `getActiveTripSnapshot()`
- `askMarco()`

### `POST /api/extractions/jobs/[id]/run`

Source: `app/api/extractions/jobs/[id]/run/route.ts`

Purpose:

- Protected operator endpoint for retrying a queued or stale OpenAI extraction job.
- If a job is currently stale `processing`, requeue it before running the OpenAI worker.

Auth:

- Requires `Authorization: Bearer <EXTRACTION_RUN_SECRET>`.
- Uses Supabase service role admin client.

Responses:

- `200` JSON with the OpenAI worker result.
- `401` JSON for invalid run secret.
- `500` JSON when admin Supabase is not configured.

### `POST /api/trips`

Source: `app/api/trips/route.ts`

Purpose:

- Create a private trip for the current user.

Request:

- JSON body with optional `name`, `destination`, `starts_on`, `ends_on`.

Responses:

- `200` JSON: `{ trip }`
- Error JSON for missing auth/config/workflow failures.

### `POST /api/scanner`

Source: `app/api/scanner/route.ts`

Purpose:

- Run deterministic trip scanner for the current user's active trip and persist current issues.

Responses:

- `200` JSON: `{ issues: number }`
- `404` JSON when no active trip exists.

Delegates:

- `runTripScan()`

### `GET /auth/callback`

Source: `app/auth/callback/route.ts`

Purpose:

- Exchange Supabase auth code for a session, then redirect.

Query:

- `code`: optional.
- `next`: optional internal path. Defaults to `/dashboard`.

Security:

- Rejects external `next` values by falling back to `/dashboard`.

## 6. Server Workflow Specifications

### `uploadEvidence(input, deps)`

Source: `lib/server/workflows/upload-evidence.ts`

Purpose:

- Validate and store a user-uploaded evidence file.
- Ensure an active trip exists.
- Create upload and extraction job records.
- Schedule OpenAI extraction.
- Cleanup or mark failure on errors.

Inputs:

- `file`: `File`
- `tripName`, `destination`, `startsOn`, `endsOn`: strings
- Dependencies: subset of repository methods plus optional `scheduleExtraction`

Rules:

- Reject unsupported file types and files larger than 25 MB before side effects.
- Require a Supabase user with action label `uploading`.
- Reuse the current active trip if present; otherwise create a trip using form values or `fallbackTripName(file.name)`.
- Store the file under `<ownerId>/<uuid>-<sanitizedFilename>`.
- Create upload with status `uploaded`.
- Create extraction job with status `queued`, provider `openai`, and model from `OPENAI_EXTRACTION_MODEL` or `gpt-4.1-mini`.
- Schedule `{ jobId, uploadId, tripId }`.
- On failure after upload row exists, mark upload `failed`.
- On failure after job exists, mark job `failed` with `completed_at`.
- On failure before upload row exists, remove the uploaded storage object if possible.

Return:

- `{ upload, job, scheduled, warning? }`

### `reviewCandidate(repo, id, intent)`

Source: `lib/server/workflows/review-candidate.ts`

Purpose:

- Convert reviewable extraction candidates into confirmed bookings, or reject them.

Rules:

- Require a Supabase user with action label `reviewing candidates`.
- `reject`: mark candidate `rejected`, return `{ status: "rejected" }`.
- `accept`: fetch candidate, create booking, create booking segment, mark candidate `accepted`, return `{ status: "accepted", booking }`.
- Any other intent throws `WorkflowError("Unsupported candidate action.", 400)`.

### `runTripScan(repo)`

Source: `lib/server/workflows/run-trip-scan.ts`

Purpose:

- Run deterministic scanner over the current active trip.

Rules:

- Require a Supabase user with action label `scanning trips`.
- Require an active trip or throw `WorkflowError("No active trip.", 404)`.
- Load bookings for active trip.
- Compute issues with `scanTrip()`.
- Replace persisted trip issues with current scanner output.
- Return `{ issues: issues.length }`.

## 7. Repository Contract

Source: `lib/server/supabase-repository.ts`

Factory:

- `createSupabaseRepository(supabase)`

Error semantics:

- Supabase errors are wrapped in `WorkflowError`.
- Most data writes/read misses default to status `400`.
- `getExtractionJobWithUpload()` and `getCandidate()` use status `404` for missing records.
- `createExtractionJob()` contains a schema-cache fallback for deployments missing async extraction migration columns.

Methods:

- `getCurrentUser()`: returns Supabase auth user or null; throws `401` on auth error.
- `requireUser(action)`: returns current user or throws `401` with an anonymous-auth setup message.
- `getActiveTrip(ownerId)`: returns newest trip for owner or null.
- `createTrip(input)`: inserts and returns trip.
- `updateTrip(id, input)`: updates trip fields.
- `uploadFile(storagePath, file, contentType)`: uploads to `trip-uploads` with `upsert: false`.
- `removeUploadedFile(storagePath)`: deletes one storage object.
- `createSignedUploadUrl(storagePath, expiresIn = 300)`: returns a signed URL object.
- `createUploadRecord(input)`: inserts and returns upload record.
- `markUploadStatus(id, status)`: updates upload status.
- `createExtractionJob(input)`: inserts job and returns row; falls back to minimal old-schema insert if async columns are missing from schema cache.
- `markExtractionJob(id, input)`: updates job.
- `getExtractionJobWithUpload(id)`: loads job with joined upload.
- `replaceUploadPages(pages)`: deletes existing pages for first `job_id`, then inserts provided pages.
- `upsertTravelers(tripId, ownerId, names)`: upserts by `trip_id,name`.
- `createCandidates(candidates)`: inserts candidate rows.
- `getCandidate(id)`: returns candidate row.
- `markCandidateStatus(id, status)`: updates candidate status.
- `createBooking(input)`: inserts and returns booking.
- `createBookingSegment(input)`: inserts booking segment.
- `getBookingsForTrip(tripId)`: returns bookings for trip.
- `replaceTripIssues(tripId, issues)`: deletes existing trip issues, then inserts current issue list.
- `loadDemoTripSnapshot()`: returns public demo snapshot partial or null.
- `getTripSnapshotForUser(user)`: returns active private trip snapshot or null.
- `getPipelineSnapshotForUser(user)`: returns private trip snapshot plus extraction jobs/pages or null.

## 8. Domain Function Specifications

### Upload Domain

Source: `lib/domain/upload.ts`

- `maxUploadBytes`: 25 MB.
- `supportedUploadTypes`: `application/pdf`, `text/plain`, `text/html`.
- `validateUploadFile(file)`: returns an error string for unsupported MIME type or oversized file; otherwise null.
- `sanitizeStorageFilename(filename)`: replaces non word/dot/dash characters with `_`.
- `createUploadStoragePath(ownerId, filename, id = crypto.randomUUID())`: returns `<ownerId>/<id>-<sanitizedFilename>`.
- `fallbackTripName(filename)`: returns `Trip from <filename>`.

### Booking Mapping Domain

Source: `lib/domain/booking-mapping.ts`

- `bookingInsertFromCandidate(candidate)`: maps candidate to a confirmed booking insert. Throws when candidate lacks `trip_id`. Uses candidate vendor or falls back to candidate title.
- `bookingSegmentInsertFromCandidate(candidate, bookingId)`: maps candidate to one booking segment. Throws when candidate lacks `trip_id`. Segment origin/destination are currently null and location comes from the candidate.

### Scanner Domain

Source: `lib/domain/scanner.ts`

- `scanTrip(trip, bookings)`: returns sorted deterministic issues from confirmed bookings.
- `calculateFinancialExposure(bookings, issues)`: calculates current booked, locked, refundable, conflicting, clean estimate, missing TBD count, and currency.
- `calculateReadiness(issues)`: calculates score and severity counts from unresolved/in-progress issues.

Scanner rules:

- Only `confirmed` bookings are scanned.
- Hotel bookings with overlapping date ranges create high-severity `double_booking` issues.
- Bookings with missing fields create `missing_details` issues. Missing `starts_at` or `ends_at` is high severity; other missing fields are medium.
- Future cancellation deadlines within 10 days create `cancellation_deadline` issues. Deadlines within 4 days are high, otherwise medium.
- Bookings starting before `trip.starts_on` create medium `outside_trip_dates` issues.
- Trip nights not covered by hotel bookings create low `itinerary_gap` issues.
- Issues are sorted by severity descending.

Readiness rules:

- `critical`: 35 point penalty.
- `high`: 25 point penalty.
- `medium`: 12 point penalty.
- `low`: 5 point penalty.
- Score is `max(0, 100 - penalty)`.
- Labels: `Ready` at 90+, `Needs Review` at 65+, otherwise `Action Required`.

Financial exposure rules:

- Currency is first confirmed booking currency or `EUR`.
- `currentBooked` is total of confirmed booking amounts.
- `locked` includes confirmed non-refundable bookings.
- `refundable` includes confirmed bookings where refundable is not false.
- `conflicting` sums `double_booking` issue financial impacts.
- `cleanEstimate` is `max(currentBooked - conflicting, 0)`.

### Data Snapshot Domain

Source: `lib/data.ts`

- `getActiveTripSnapshot()`: returns private active trip snapshot when user exists and has a trip; otherwise returns public demo snapshot when available; otherwise returns empty snapshot.
- `getPipelineSnapshot()`: returns private pipeline snapshot for current user; unauthenticated/no-trip cases return empty pipeline snapshot.
- `emptySnapshot()`: returns empty non-demo trip snapshot.
- `emptyPipelineSnapshot()`: extends empty snapshot with empty jobs/pages.
- `summarizeSnapshot(snapshot)`: calculates exposure/readiness/counts and whether upload is needed.

### Extraction Schema Domain

Source: `lib/extraction-schema.ts`

- `extractedBookingSchema`: zod schema for reviewable extracted booking payloads.
- `extractionResultSchema`: zod schema for trip metadata, extracted bookings, and warnings.
- `extractionJsonSchema`: strict JSON schema used with OpenAI Responses API direct extraction helper.

Supported booking types:

- `hotel`
- `flight`
- `car`
- `activity`
- `other`

Supported extraction methods:

- `rules`
- `openai`
- `manual`

### OpenAI Service

Source: `lib/openai-extract.ts`

- `extractBookingsFromUpload(input)`: OpenAI extraction helper. Requires `OPENAI_API_KEY`, accepts text, image data URL, file data, or OpenAI file id, and validates output against `extractionResultSchema`.
- `askMarco(input)`: advisor chat helper. If `OPENAI_API_KEY` is missing, returns a configured-but-not-ready message. Otherwise asks OpenAI using trip context and a safety instruction that Marco must not claim to book or cancel anything.

Current architecture note:

- The active upload workflow schedules `runOpenAiExtractionJob()`, which downloads the private upload through the Supabase service-role client, prepares the OpenAI input, calls `extractBookingsFromUpload()`, and completes the job through the atomic database RPC.

### Supabase Client Services

Sources: `lib/supabase.ts`, `lib/supabase-browser.ts`, `lib/supabase-env.ts`

- `getSupabaseUrl()`: reads `NEXT_PUBLIC_SUPABASE_URL`.
- `getSupabasePublishableKey()`: reads publishable key or legacy anon key.
- `hasSupabaseEnv()`: true when URL and publishable/anon key are available.
- `createSupabaseServerClient()`: returns SSR Supabase client bound to Next cookies, or null when env is missing.
- `createSupabaseAdminClient()`: returns service-role Supabase client for server-only jobs, or null when URL/service role key is missing.
- `createSupabaseBrowserClient()`: returns browser Supabase client, or null when env is missing.

### Error Utilities

Source: `lib/server/errors.ts`

- `WorkflowError`: error class with HTTP-ish status.
- `asyncExtractionMigrationMessage`: user-facing migration guidance for stale async extraction schema.
- `isAsyncExtractionSchemaCacheError(message)`: detects Supabase schema cache messages involving async extraction columns/tables.
- `errorMessage(error, fallback)`: returns workflow/direct error message, replacing schema cache errors with migration guidance.
- `errorStatus(error, fallback)`: returns `WorkflowError.status`, otherwise fallback.

### Extraction Run Auth

Source: `lib/server/extraction-run-auth.ts`

- `requireExtractionRunAuth(request)`: requires configured `EXTRACTION_RUN_SECRET` and matching bearer token.

### Utility Functions

Source: `lib/utils.ts`

- `cn(...inputs)`: class name composition via `clsx`.
- `money(amount, currency = "EUR")`: displays currency with no fractional digits, or `TBD` for null/undefined.
- `compactDate(value)`: displays short month/day, or `TBD` for null/undefined.
- `dateRange(start, end)`: displays both dates, one date, or `Dates TBD`.

## 9. UI Surface Specifications

### App Shell

Source: `components/app-shell.tsx`

Purpose:

- Provides persistent navigation for app pages.
- Supports mobile open/close navigation state.
- Links to dashboard, bookings, itinerary, timeline, scanner, upload, pipeline, settings.

### Shared UI Components

Source: `components/ui.tsx`

- `PageHeader`: title, optional eyebrow, optional actions.
- `Card`: bordered white section container.
- `MetricCard`: icon metric display.
- `EmptyState`: empty data prompt with upload action by default.
- `StatusPill`: tone-coded pill.
- `SeverityStripe`: issue severity stripe.
- `AlertNote`: red alert note.

### Upload Panel

Source: `components/upload-panel.tsx`

Purpose:

- Collect evidence file and optional trip metadata.
- Calls `POST /api/upload`.
- Shows queued/success/warning/error status.
- Refreshes route data after successful upload.

Accepted file chooser hints:

- `.pdf`, `.txt`, `.html`, `.htm`, `application/pdf`, `text/plain`, `text/html`.

### Candidate and Booking Cards

Source: `components/booking-card.tsx`

- `BookingCard`: displays confirmed/pending/cancelled booking details, amount, date range, location, confirmation code, and missing-field warning.
- `CandidateCard`: displays reviewable extracted candidate, confidence, missing fields, and posts accept/reject intent to `/api/candidates/[id]`.

### Marco Chat

Source: `components/marco-chat.tsx`

Purpose:

- Calls `POST /api/marco` with a question.
- Displays answer or error text.

### Scanner Actions

Source: `components/scanner-actions.tsx`

Purpose:

- Runs `POST /api/scanner`.
- Reloads the page after completion.

### Financial Panel

Source: `components/financial-panel.tsx`

Purpose:

- Displays current booked exposure, duplicate exposure, clean estimate, locked/refundable/conflicting/TBD breakdown.

### Pages

Sources: `app/(app)/**/page.tsx`, `app/page.tsx`, `app/login/page.tsx`

- `/` redirects to `/dashboard`.
- `/login` redirects to `/dashboard`.
- `/dashboard`: loads active trip snapshot, shows empty state or trip hero, metrics, readiness, next actions, financial panel, and recent uploads.
- `/bookings`: shows pending candidates and confirmed bookings; candidate actions accept/reject through API.
- `/upload`: shows upload panel, review queue, pipeline state, and Marco chat.
- `/pipeline`: shows upload -> extraction jobs -> candidates -> accepted records trace for private pipeline data only.
- `/scanner`: shows persisted scanner issues and allows running scanner for non-demo trips.
- `/timeline`: renders accepted bookings on a simple type-based timeline and lists double-booking conflicts.
- `/itinerary`: shows preference sliders, accepted booking anchors, and Marco chat.
- `/settings`: shows environment readiness and runtime behavior notes.

## 10. Test Coverage Map

Sources: `tests/*.test.ts`

Current coverage:

- Upload file validation rejects unsupported MIME types.
- Upload file validation accepts first-wave image evidence types: PNG, JPEG, and WebP.
- `uploadEvidence()` stores upload, creates queued OpenAI job, schedules extraction, preserves fallback schema behavior, and returns migration warnings.
- Schema cache errors map to async extraction migration guidance.
- Repository retries extraction job insert against old schema when async columns are absent.
- Extraction run auth rejects missing/invalid secrets.
- OpenAI worker route retries queued and stale processing jobs.
- `reviewCandidate()` maps candidates into bookings and segments before accepting.
- `runTripScan()` replaces persisted issues for the active trip.
- `scanTrip()` detects hotel overlaps and gap nights.
- Financial exposure and readiness calculations are covered for a double-booking case.
- Extraction result schema accepts incomplete reviewable data and rejects unsupported booking types.

Recommended next specs/tests:

- API route contract tests for each route status branch.
- Repository integration tests against a local Supabase database for RLS assumptions and storage policies.
- Browser-level workflow test: upload -> OpenAI extraction -> candidate accept -> scanner -> dashboard update.
- Tests for `outside_trip_dates`, `missing_details`, and `cancellation_deadline` scanner rules.
- Tests for `/auth/callback` redirect safety.
- Tests for `getActiveTripSnapshot()` demo/private fallback precedence.

## 11. Open Specification Gaps

These are places where the code has behavior but future spec-driven development would benefit from firmer product decisions.

- Manual booking creation UI/API is not implemented, despite some copy saying manual entries may exist.
- Candidate rejection has no audit trail or undo behavior.
- `bookings` and `booking_segments` are created without transaction semantics; partial creation is possible if segment creation fails after booking insertion.
- `UploadRecord.trip_id` and `ExtractionJob.trip_id` are nullable in TypeScript but not nullable in the schema for current migrations.
- Scanner date logic uses current wall-clock time for cancellation deadlines, which makes tests around deadlines time-sensitive unless clock injection is introduced.
- Timeline positioning is index-based rather than date-proportional, so it is visual guidance rather than a precise calendar spec.
- Itinerary preference sliders are presentational and not persisted.
- Marco chat does not currently stream, persist conversations, or enforce prompt/token limits in app code.
- Manual extraction retry uses service role and bearer secret; operational rotation policy is not documented.
- Stale `processing` extraction jobs are visible but do not yet have an automatic retry scheduler or user-facing retry action.

## 12. Spec Visibility And Archive

Active feature specs live in `specs/features/` and should represent current implementation targets only. Implemented, superseded, deferred, or retired specs move to `specs/archive/` and remain version controlled through the archive index.

## 13. Suggested Spec-Driven Development Motion

1. Promote this catalog into one spec file per bounded area:
   - `specs/runtime.md`
   - `specs/api.md`
   - `specs/workflows.md`
   - `specs/domain-scanner.md`
   - `specs/data-contract.md`
   - `specs/ui-pages.md`
2. For each future feature, write acceptance criteria before code:
   - route contract
   - workflow contract
   - data/RLS impact
   - UI state changes
   - tests required
3. Convert "Open Specification Gaps" into tracked decisions before broadening behavior.
4. Keep specs aligned with tests: every important rule above should have at least one unit, integration, or route-level test.
