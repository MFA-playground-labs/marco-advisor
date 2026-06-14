# Feature: Extraction Pipeline Reliability

Status: Ready
Owner: TBD
Catalog references:

- [Async extraction worker endpoints](../../docs/specification-catalog.md#get-apiextractionsjobsid)
- [Async extraction callback](../../docs/specification-catalog.md#post-apiextractionscallback)
- [Upload workflow](../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Extraction completion workflow](../../docs/specification-catalog.md#completeextractionrepo-payload)
- [Pipeline page](../../docs/specification-catalog.md#pages)
- [Spec archive](../archive/README.md)

## Problem

The upload-first pipeline has a working happy path, but worker claim and callback completion can be retried or duplicated by n8n. App-side multi-write completion can leave partial state if one write succeeds and a later write fails, and duplicate callbacks can create duplicate review candidates.

## Goals

- Make worker job claiming atomic.
- Make callback completion transactional and idempotent.
- Preserve existing public route contracts and n8n payload shapes.
- Keep active specs visible while preserving completed/superseded specs in the archive.

## Non-Goals

- No replacement of n8n.
- No recurring retry scheduler.
- No per-job worker token in this wave.
- No user-facing retry UI.

## User Flow

1. User uploads supported evidence from `/upload`.
2. App creates an upload and queued extraction job, then dispatches n8n.
3. n8n atomically claims the job through the metadata endpoint.
4. n8n fetches a short-lived signed file URL.
5. n8n posts one or more success/failure callbacks.
6. Marco applies the first terminal callback atomically and ignores duplicate terminal callbacks.
7. User sees job, warning, page, candidate, and booking status on `/pipeline`.

## Current Behavior

- Upload creates records and dispatches n8n.
- Worker metadata fetch currently claims work at the route/repository layer.
- Callback completion is validated in TypeScript and applied through multiple repository writes.
- Completed and superseded feature specs currently sit beside active specs.

## Proposed Behavior

- `claim_extraction_job(job_id)` atomically changes `queued` jobs to `processing`, sets `started_at`, and returns the current job/upload state for already claimed or terminal jobs.
- `complete_extraction_job(...)` locks the job row, no-ops duplicate terminal callbacks, and applies success/failure writes inside one database transaction.
- Successful completion replaces page text for the job, replaces unreviewed candidates for the job, applies trip/traveler updates, marks the upload `review_ready`, and marks the job `succeeded`.
- Failed completion marks upload/job failed and creates no candidates.
- Structured logs record worker claim, skipped claim, callback success, callback failure, and duplicate callback ignored.
- Specs that are not active move to `specs/archive/` and active README lists link only active work.

## Data Contract

- Existing tables and statuses remain unchanged.
- New database functions live in `public` and are executable only by `service_role`.
- `anon` and `authenticated` must not be able to execute ingest reliability RPCs.
- No new public table is introduced.

## API Contract

- `POST /api/upload` response remains `{ upload, job, dispatched, warning? }`.
- `GET /api/extractions/jobs/[id]` response remains `{ job, upload, limits }`.
- `GET /api/extractions/jobs/[id]/file` response remains `{ job_id, upload_id, filename, content_type, signed_url, expires_in }`.
- `POST /api/extractions/callback` response remains `{ status, candidates }`.

## UI Contract

- `/pipeline` remains the operational trace for upload, job, page, candidate, and booking state.
- Stale `processing` jobs remain visible as `processing`; manual/operator retry is deferred.
- Active spec indexes show only active specs and link to the archive separately.

## Workflow Contract

- Upload dispatch behavior is unchanged.
- Worker metadata route uses `claim_extraction_job`.
- Callback route validates payloads in TypeScript and delegates persistence to `complete_extraction_job`.
- Duplicate terminal callbacks return the current terminal state without rewriting data.

## Failure Modes

- Duplicate success callback: return existing `succeeded` state and do not duplicate candidates.
- Duplicate failure callback after success: return existing `succeeded` state and do not rewrite terminal success.
- Failed callback before success: atomically marks upload/job failed and creates no candidates.
- Missing/invalid worker auth: return JSON 401 and do not touch Supabase.
- Missing admin client: return JSON 500 and do not mutate state.

## Acceptance Criteria

- [ ] Atomic claim prevents duplicate `queued -> processing` worker claims. Verification: route/repository tests and migration review.
- [ ] Successful callback completion is delegated to one RPC boundary. Verification: workflow/repository tests.
- [ ] Duplicate terminal callbacks do not create duplicate candidates or rewrite terminal success. Verification: workflow/route tests and RPC contract review.
- [ ] Worker file endpoint returns a 300-second signed URL and upload metadata. Verification: route test.
- [ ] Active spec indexes exclude archived specs. Verification: source test.
- [ ] Archived specs remain linked from `specs/archive/README.md`. Verification: source test.

## Test Plan

- Unit/workflow: callback success, failure, and duplicate terminal behavior.
- Repository: RPC call shapes for claim and completion.
- Route/API: worker metadata, worker file, and callback auth/config/success/failure branches.
- Spec governance: active README and archive index source checks.
- Regression: `npm run test`, `npm run typecheck`, `npm run build`.

## Open Questions

- None. Manual retry and per-job worker tokens are deferred by product decision.

## Implementation Notes

- Assumptions: n8n remains the only worker and uses the service-role-backed app endpoints.
- Suggested source areas: Supabase migration, repository, extraction callback workflow, worker routes, specs.
- Migration/compatibility notes: run Supabase advisors when a local/linked Supabase environment is available.
