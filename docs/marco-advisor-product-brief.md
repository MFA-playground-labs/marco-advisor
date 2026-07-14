# Marco Advisor Product Brief

Last updated: 2026-06-16

This brief is portable project context for continuing Marco Advisor analysis in ChatGPT, Claude, or another AI workspace. It summarizes the current product, user goals, architecture, implementation shape, roadmap, and collaboration guidance without requiring direct access to the source repository.

## 1. AI Workspace Instructions

Use this document as authoritative project context for Marco Advisor unless newer repository files or explicit owner instructions supersede it.

When helping refine this project:

- Start with product value and user trust before proposing implementation details.
- Preserve the current product scope unless explicitly asked to expand it.
- Clearly separate current shipped behavior from roadmap or speculative ideas.
- Protect privacy and security boundaries. Do not request or include real API keys, service-role keys, webhook secrets, bearer tokens, private upload contents, or production user data.
- Keep recommendations architecture-aware and implementation-pragmatic. Prefer small, reversible improvements that fit the current stack.
- If proposing alternatives, explain what user outcome improves, what cost or operational complexity changes, and what migration risk is introduced.

Preferred collaboration style:

- Product-first: define the user problem, desired behavior, and success criteria.
- Architecture-aware: preserve system boundaries, data ownership, reliability, security, and observability.
- Implementation-pragmatic: use existing patterns, avoid broad rewrites, and add tests proportional to risk.

## 2. Executive Product Brief

Product name: Marco Advisor.

One-line description: Marco Advisor is upload-first travel intelligence for private trips.

Product purpose: Marco turns messy travel evidence into trusted trip records, risk detection, financial visibility, itinerary context, and advisor support. The product helps users move from scattered confirmations, screenshots, PDFs, emails, and documents into a structured trip operating surface.

Current stage: MVP / early product build.

Primary product promise: A user can upload booking evidence, review extracted records, accept trusted bookings, detect trip risks, and operate from one trip command center.

The product is intentionally review-first. Marco may extract, summarize, warn, and advise, but it should not claim to book, cancel, or modify real-world reservations on the user's behalf.

## 3. Product Strategy

### Target Users

- Private travelers planning trips with multiple bookings, vendors, dates, and documents.
- Trip organizers responsible for family, group, or high-stakes personal travel.
- Travelers who want risk visibility before departure, not just a passive itinerary list.
- Users with complex travel evidence spread across PDFs, screenshots, exported emails, text files, and manual records.

### Core Jobs To Be Done

- Collect travel evidence into one private workspace.
- Convert unstructured evidence into structured booking candidates.
- Review and trust extracted records before they become confirmed trip data.
- Detect conflicts, gaps, missing details, cancellation deadlines, outside-trip dates, and financial exposure.
- Use Marco for trip-aware advice without Marco pretending to book, cancel, or contact vendors.

### Product Goals

- Reduce trip coordination anxiety by making the state of a trip visible.
- Create a trustworthy private trip record from user-owned evidence.
- Surface risks early enough for users to act.
- Preserve user control over which extracted items become confirmed bookings.
- Make extraction status and failures understandable enough to diagnose.

### Non-Goals

- No autonomous booking or cancellation.
- No replacement for travel agencies yet.
- No public sharing or collaboration model yet.
- No fully generated itinerary persistence yet.
- No mobile-native app yet.
- No commercial billing or payment model yet.

## 4. Current User Experience

### Demo-To-Private Flow

Marco starts with a public read-only demo trip so new users can understand the product without setup. Middleware creates or refreshes a Supabase session for app and API paths. When the user uploads evidence, Marco creates private trip data owned by the current authenticated or anonymous Supabase user.

The demo snapshot and private data remain separate. Demo data should never mix with user-owned uploads, bookings, candidates, scanner output, or trip records.

### Product Surfaces

Dashboard:

- Route: `/dashboard`.
- Role: trip command center.
- Shows trip summary, readiness, financial exposure, next actions, confirmed and pending counts, conflicts, and recent uploads.
- Uses the public demo snapshot until private trip data exists.

Upload:

- Route: `/upload`.
- Role: evidence intake and extraction handoff.
- Accepts supported files, optional trip metadata, and submits to `/api/upload`.
- Shows upload status, review queue state, pipeline state, and Marco chat.

Bookings:

- Route: `/bookings`.
- Role: candidate review and trusted booking management.
- Shows pending extracted candidates with accept/reject controls.
- Shows confirmed bookings.
- Future work includes manual booking creation, booking edit/cancel, and transactional acceptance safety.

Pipeline:

- Route: `/pipeline`.
- Role: operational trace for evidence ingestion.
- Shows how uploads flow through extraction jobs, page text, candidates, and accepted booking records.
- Helps users and operators diagnose failed or stalled extraction jobs.

Scanner:

- Route: `/scanner`.
- Role: deterministic risk and scheduling intelligence.
- Runs checks over confirmed bookings and persists trip issues.
- Displays severity, category, recommended actions, scanner metrics, and financial exposure.

Timeline:

- Route: `/timeline`.
- Role: chronological visualization.
- Shows accepted bookings across the trip and highlights conflicts generated by scanner issues.
- Current layout is useful guidance, not yet date-proportional.

Itinerary:

- Route: `/itinerary`.
- Role: planning anchors and advisor-assisted recommendations.
- Shows confirmed booking anchors and presentational preference controls.
- Includes Marco chat using current trip context.
- Does not yet persist preferences or generated day plans.

Settings:

- Route: `/settings`.
- Role: runtime readiness and operational diagnostics.
- Shows configuration status for Supabase, OpenAI, and service-role readiness.
- Future diagnostics should include extraction worker readiness, schema freshness, and operational runbook links.

### Primary User Journey

1. User opens Marco and sees the demo trip or their private trip.
2. User uploads evidence from `/upload`.
3. Marco validates the file, creates or reuses an active trip, stores the evidence, and queues extraction.
4. Extraction produces reviewable booking candidates.
5. User reviews candidates in `/upload` or `/bookings`.
6. User accepts trusted candidates into confirmed bookings or rejects bad candidates.
7. User runs scanner to detect issues.
8. Dashboard, timeline, itinerary, and financial exposure update from confirmed bookings and persisted issues.

## 5. Product Principles

- Trust over automation. Marco should help users understand and decide, not silently mutate trip truth.
- User review before confirmed records. Extracted evidence becomes a candidate first.
- Private by default. User data belongs to the session/user that created it.
- Operational transparency for extraction. Users and operators need to see where an upload is in the pipeline.
- Useful degraded states. Missing AI keys, worker config, or provider failures should produce understandable states.
- Diagnosis without leaking internals. Expose enough status to recover, but do not make users reason about implementation unless it helps them act.
- Small durable steps. Prefer focused workflow improvements over broad platform rewrites.

## 6. Current Full Project Spec

### Core Entities

Trip:

- User-owned trip container with name, destination, start date, end date, and owner.
- Source of truth for private trip context.

Traveler:

- Optional named traveler associated with a trip.

Upload:

- Stored evidence file metadata.
- Tracks filename, content type, storage path, status, owner, trip, and trace ID.

Extraction Job:

- Background extraction unit connected to an upload and trip.
- Tracks provider, model, status, trace ID, attempt ID, stage, provider request metadata, warnings, raw result, timestamps, and error message.

Upload Page Text:

- Extracted page-level text and metadata for an upload/job.
- Supports source traceability from evidence to candidate.

Extracted Booking Candidate:

- Reviewable structured booking extracted from evidence.
- Contains booking fields, confidence, missing fields, source pages, snippets, extraction method, raw JSON, and review status.

Booking:

- Trusted trip record used by dashboard, scanner, timeline, itinerary, and financial exposure.
- Can represent hotel, flight, car, activity, or other booking types.

Booking Segment:

- Normalized segment detail for a booking, such as flight legs or stay intervals.

Trip Issue:

- Persisted scanner output with severity, category, status, summary, timing, financial impact, related bookings, and recommended action.

Financial Exposure:

- Derived summary of current booked amount, locked amount, refundable amount, conflicting amount, missing TBD count, clean estimate, and currency.

Readiness:

- Derived risk posture with score, label, and issue counts by severity.

Trip Snapshot:

- Aggregated view of trip, travelers, bookings, segments, candidates, issues, uploads, and demo flag.

Pipeline Snapshot:

- Trip snapshot plus extraction jobs and upload page text.

### Status Contracts

Upload status:

- `uploaded`: evidence is stored.
- `extracting`: extraction is underway or expected.
- `review_ready`: extraction produced reviewable output.
- `failed`: upload or extraction failed.

Extraction job status:

- `queued`: waiting for processing.
- `processing`: claimed or actively running.
- `succeeded`: completed successfully.
- `failed`: terminal failure.

Candidate status:

- `needs_review`: waiting for user decision.
- `accepted`: converted into trusted booking data.
- `rejected`: dismissed by the user.

Booking status:

- `pending_review`: not yet trusted as confirmed.
- `confirmed`: trusted booking record.
- `cancelled`: no longer active.
- `rejected`: not part of trip truth.

Issue status:

- `unresolved`: active issue.
- `in_progress`: user or operator is addressing it.
- `resolved`: issue fixed.
- `risk_accepted`: user accepts the risk.
- `dismissed`: no longer relevant.

### Supported Evidence

Current validation supports:

- PDF.
- Text.
- HTML.
- PNG.
- JPEG.
- WebP.

### Current Scanner Rules

The deterministic scanner currently covers:

- Overlapping hotel bookings.
- Missing booking details.
- Upcoming cancellation deadlines.
- Bookings outside trip dates.
- Lodging gaps across trip nights.

Scanner outputs feed dashboard readiness, issue lists, timeline conflict visibility, and financial exposure.

## 7. Technical Architecture Confirmation

### Stack

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Supabase Auth.
- Supabase Postgres.
- Supabase Storage.
- Supabase Row Level Security.
- OpenAI Responses API for extraction and Marco advisor functions.
- Optional n8n extraction path remains documented and supported where configured.
- Vitest for tests.
- Vercel deployment assumptions for the Next.js app.

### System Boundaries

`app/`:

- Pages, layouts, and route handlers.
- Route handlers should remain thin and delegate workflow behavior.

`components/`:

- Shared UI primitives and product components such as upload panel, booking cards, candidate cards, status pills, financial panel, scanner actions, and Marco chat.

`lib/domain/`:

- Pure domain rules such as upload validation, booking mapping, scanner logic, confidence bands, and source snippet display.

`lib/server/workflows/`:

- Server-side business workflows including upload evidence, complete extraction, run OpenAI extraction, review candidate, and run trip scan.

`lib/server/supabase-repository.ts`:

- Persistence boundary for Supabase database and storage operations.

`lib/openai-extract.ts`:

- OpenAI extraction and Marco advisor helper functions.

`supabase/migrations/`:

- Database schema, RLS, storage bucket setup, extraction reliability functions, and observability persistence.

### Data Ownership

- Public demo data lives in `demo_trip_snapshots` and is read-only.
- Private trip data is scoped to the authenticated or anonymous Supabase user.
- Private tables use RLS and owner-scoped access, usually through trip ownership.
- Uploaded files live in the private `trip-uploads` bucket under user-id-prefixed storage paths.
- Service-role access is reserved for server-only workflows and worker endpoints.

### Async Workflow

Upload flow:

- Validate file.
- Require or establish a user session.
- Create or reuse active trip.
- Store evidence in Supabase Storage.
- Create upload row.
- Create extraction job row.
- Dispatch extraction.
- Record observability events.

Extraction flow:

- Claim or run a job.
- Download or prepare input.
- Call configured extraction provider.
- Validate provider output against schema.
- Persist upload pages, candidates, provider metadata, warnings, and terminal status.

Review flow:

- User accepts or rejects a candidate.
- Accepted candidates map into bookings and segments.
- Candidate status updates after review.

Scanner flow:

- Load active trip and confirmed bookings.
- Run deterministic scanner rules.
- Replace current persisted issues for the trip.
- Dashboard and scanner surfaces use updated issues and derived summaries.

## 8. Security, Privacy, Reliability, Observability

### Security And Privacy

- Never expose service-role keys or OpenAI keys to client bundles.
- Keep `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EXTRACTION_WEBHOOK_SECRET`, and n8n webhook URLs server-only.
- Public Supabase values must use `NEXT_PUBLIC_` only when safe for browser exposure.
- RLS is required for tables in exposed schemas.
- Treat uploads, webhook payloads, OpenAI output, n8n output, and user input as untrusted.
- Do not log secrets, bearer tokens, auth headers, full webhook bodies, raw credentials, or sensitive private evidence.
- Signed file URLs should be short-lived and scoped to the intended worker use case.

### Reliability

- Extraction must be observable and recoverable.
- Failed jobs should preserve enough state for diagnosis.
- Duplicate worker callbacks should not duplicate candidates or overwrite terminal success.
- Candidate acceptance should become transactional to avoid partial booking/segment/candidate writes.
- Missing runtime configuration should fail early with clear user/operator feedback.
- Storage cleanup and failed-state marking should preserve the original error when cleanup fails.

### Observability

Preserve and extend:

- Trace IDs.
- Interaction IDs.
- Attempt IDs.
- Job events.
- Provider and model metadata.
- Provider request IDs.
- Latency.
- Error messages.
- Job stage and terminal state.
- Upload lifecycle events.

The `/pipeline` page is the primary user/operator trace surface for ingestion. Settings should evolve into a clearer readiness and diagnostics surface.

## 9. Roadmap And Open Product Work

### P1

- Manual booking entry.
- Candidate review workbench.
- Booking edit and cancel.
- Booking acceptance transaction safety.
- Deterministic scanner clock.

### P2

- Dashboard readiness summary v2.
- Upload queue handoff clarity.
- Worker lifecycle diagnostics.
- Environment diagnostics v2.
- Scanner issue lifecycle.
- Persisted itinerary preferences.

### P3

- Timeline-to-booking navigation.
- Accepted record lineage.
- Marco-assisted day planning.
- Itinerary day persistence.

### Deferred Work

- Collaboration and multi-user trips.
- Payment or commercial model.
- Autonomous booking or cancellation.
- Mobile-native application.
- Full retry scheduler unless separately specified.
- Public sharing model.
- Rich admin/operator console.

## 10. AI Collaboration Prompts

Use these prompts when uploading this file into another AI workspace.

### Product Refinement Prompt

```text
You are helping refine Marco Advisor using the attached product brief as project context. Start from the user jobs, current MVP scope, and product principles. Recommend improvements that increase trust, reduce trip coordination anxiety, and preserve user control. Clearly separate current shipped behavior from roadmap ideas. Do not propose autonomous booking or cancellation unless explicitly requested.
```

### Architecture Review Prompt

```text
You are reviewing Marco Advisor architecture using the attached brief. Focus on system boundaries, data ownership, async extraction flow, Supabase RLS, reliability, observability, and operational recovery. Preserve the current Next.js, Supabase, OpenAI, and optional n8n architecture unless you explicitly justify a different path with migration costs and user benefits.
```

### Engineering Implementation Prompt

```text
You are planning an implementation for Marco Advisor using the attached brief. Prefer small, cohesive changes that follow existing repo boundaries: route handlers stay thin, domain logic stays in lib/domain, workflows stay in lib/server/workflows, and Supabase access goes through the repository layer. Include tests proportional to risk and avoid exposing secrets or service-role capabilities to client code.
```

### QA And Release Readiness Prompt

```text
You are validating Marco Advisor release readiness using the attached brief. Build a test plan around the full user journey: upload evidence, extraction lifecycle, candidate review, accepted bookings, scanner issues, dashboard summary, timeline, itinerary context, and settings diagnostics. Include failure states for missing config, provider failure, invalid input, duplicate callbacks, and permission boundaries.
```

## 11. Review Confirmation

Product Leader review:

- This brief centers user value, trust, reviewability, privacy, and clear non-goals.
- It frames Marco as a trip operating surface rather than a generic itinerary viewer.
- It keeps the primary product journey concrete: evidence -> extraction -> review -> trusted records -> scanner -> command center.

Chief Architect review:

- This brief captures system boundaries across UI, API routes, workflows, domain logic, repository, database, storage, and external integrations.
- It names data ownership, async workflow stages, reliability constraints, security requirements, observability needs, and future architectural risks.
- It preserves reversible early-stage architecture choices and avoids broad platform replacement.

Chief Engineer review:

- This brief reflects the current implementation shape: Next.js App Router, Supabase repository boundary, workflow modules, domain helpers, migrations, and Vitest coverage.
- It reinforces maintainability standards: thin route handlers, centralized domain rules, explicit contracts, structured validation, meaningful observability, and scoped tests.
- It flags operational constraints and known follow-up work without turning roadmap ideas into shipped claims.

## 12. Source Context

This brief is synthesized from the current repository context:

- `README.md`.
- `docs/specification-catalog.md`.
- `specs/pages/**`.
- `specs/features/**`.
- `lib/types.ts`.
- `lib/data.ts`.
- `lib/domain/**`.
- `lib/server/workflows/**`.
- `lib/server/supabase-repository.ts`.
- `app/**` routes and pages.
- `supabase/migrations/**`.

It should be refreshed after major product, schema, route, or workflow changes.
