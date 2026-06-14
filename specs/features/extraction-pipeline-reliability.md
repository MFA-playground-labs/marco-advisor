# Feature: Extraction Pipeline Reliability

Status: Ready
Owner: TBD
Catalog references:

- [Async extraction worker endpoints](../../docs/specification-catalog.md#get-apiextractionsjobsid)
- [Async extraction callback](../../docs/specification-catalog.md#post-apiextractionscallback)
- [Upload workflow](../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Extraction completion workflow](../../docs/specification-catalog.md#completeextractionrepo-payload)
- [Pipeline page](../../docs/specification-catalog.md#pages)
- [Test coverage map](../../docs/specification-catalog.md#10-test-coverage-map)

## Problem

The async extraction path works, but its operational contract is spread across upload workflow code, worker endpoints, callback handling, and pipeline UI. Dispatch failures, callback failures, stale schema fallback, and status visibility need a decision-complete feature spec before reliability work expands.

## Goals

- Define the intended lifecycle for queued, processing, succeeded, and failed extraction jobs.
- Make dispatch failure, worker fetch, callback success, callback failure, and schema-cache fallback behavior explicit.
- Improve pipeline visibility without changing the core n8n-first architecture.
- Define tests that prove state transitions and user-visible status.

## Non-Goals

- No replacement of n8n.
- No new extraction provider abstraction.
- No automatic recurring retry scheduler in this first reliability wave.
- No changes to the service-role worker auth model.

## User Flow

1. User uploads supported evidence from `/upload`.
2. App creates an upload and queued extraction job.
3. App dispatches n8n.
4. n8n fetches job metadata, which marks queued jobs as processing.
5. n8n fetches a signed file URL.
6. n8n posts a success or failure callback.
7. User sees upload/job/candidate status on `/pipeline` and reviewable candidates on `/upload` or `/bookings`.

## Current Behavior

Current behavior is documented in the linked catalog sections. Important current details:

- Upload dispatch failures return `{ dispatched: false }` but keep the queued job.
- Worker metadata fetch marks queued jobs as processing with `started_at`.
- Callback failure marks upload and job failed.
- Callback success writes pages/candidates, marks upload `review_ready`, and marks job `succeeded`.
- Repository has a fallback for deployments missing async extraction columns in Supabase schema cache.

## Proposed Behavior

- Preserve existing states and add no new job statuses in this wave.
- Treat dispatch failure as a recoverable queued-job condition, not a failed extraction.
- Ensure pipeline UI clearly distinguishes:
  - queued and not dispatched or dispatch warning present
  - processing
  - succeeded with candidate count/page count
  - failed with error message
- Keep retry as a manual/operator follow-up in this wave. Do not add a retry endpoint unless a separate spec approves it.
- Preserve schema-cache fallback messaging and make it visible wherever upload warnings are already shown.
- Worker endpoints must continue to return JSON errors for invalid auth/configuration.

## Data Contract

- `extraction_jobs.status` remains one of `queued`, `processing`, `succeeded`, `failed`.
- `extraction_jobs.error_message` stores dispatch warnings or terminal failure messages.
- `extraction_jobs.warnings` stores non-terminal warnings where the async schema is available.
- `extraction_jobs.started_at` is set when the worker claims a queued job.
- `extraction_jobs.completed_at` is set for succeeded and failed callback completion.
- `upload_pages` remains the page text table keyed by `job_id`.
- No migration is required unless implementation discovers current generated types are stale.

## API Contract

- `POST /api/upload` response remains `{ upload, job, dispatched, warning? }`.
- `GET /api/extractions/jobs/[id]`:
  - Requires bearer secret.
  - Marks queued jobs processing.
  - Returns `job`, `upload`, and `limits`.
  - Does not mark already failed/succeeded jobs processing.
- `GET /api/extractions/jobs/[id]/file`:
  - Requires bearer secret.
  - Returns 300-second signed URL.
- `POST /api/extractions/callback`:
  - Requires bearer secret.
  - Accepts success and failure payloads matching `extractionCallbackSchema`.
  - Returns `{ status, candidates }`.

## UI Contract

- `/upload` continues to show immediate upload/dispatch feedback.
- `/pipeline` is the primary operational view for upload -> job -> pages -> candidates -> accepted records.
- `/pipeline` must display job status, provider, page count, candidate count, booking count, and any job error message.
- Dispatch warnings should be visible without requiring console/log access.
- No new admin-only UI is required in this wave.

## Workflow Contract

- `uploadEvidence()` creates upload and queued job before dispatch.
- Dispatch failure records warning/error metadata but does not mark the job failed.
- Worker metadata fetch is the only lifecycle point that moves `queued` to `processing`.
- `completeExtraction()` is the only lifecycle point that moves jobs to `succeeded` or terminal `failed`.
- Failed callbacks must not create candidates.
- Successful callbacks must mark upload `review_ready` after candidate/page persistence.

## Failure Modes

- Missing n8n URL: upload succeeds, job remains queued, warning is stored and surfaced.
- n8n non-2xx dispatch response: upload succeeds, job remains queued, HTTP status warning is stored and surfaced.
- Worker invalid secret: endpoint returns 401 JSON, no state mutation.
- Admin client missing: worker endpoint returns 500 JSON, no job processing.
- Callback failed payload: upload/job marked failed, no candidates created.
- Stale async schema cache: upload returns migration warning and avoids writing unavailable columns.

## Acceptance Criteria

- [ ] Dispatch failure keeps the job queued and stores a visible warning. Verification: workflow test and manual `/pipeline` check.
- [ ] Worker metadata fetch marks only queued jobs as processing. Verification: route/API test or focused repository/workflow test.
- [ ] Worker file endpoint returns a 300-second signed URL and original upload metadata. Verification: route/API test or manual worker call.
- [ ] Successful callback writes pages/candidates and marks upload/job complete. Verification: existing workflow test remains green or is expanded.
- [ ] Failed callback marks upload/job failed and creates no candidates. Verification: existing workflow test remains green or is expanded.
- [ ] Schema-cache fallback preserves user-facing migration warning. Verification: existing workflow/repository tests remain green.
- [ ] `/pipeline` surfaces job error messages/warnings. Verification: manual UI check or component test.

## Test Plan

- Unit: error utility tests for schema-cache fallback remain in place.
- Workflow: expand `uploadEvidence()` and `completeExtraction()` tests for warning visibility and terminal state fields.
- Route/API: add tests for worker metadata status transition, auth failure, and admin config failure when route-test harness exists.
- UI/manual: simulate dispatch warning and failed callback, confirm `/pipeline` shows status and error message.
- Regression: confirm normal upload -> callback -> review flow is unchanged.

## Open Questions

- None for this wave. Manual retry behavior is explicitly deferred.

## Implementation Notes

- Assumptions: keeping only existing statuses avoids a migration and keeps reliability work narrow.
- Suggested source areas: upload workflow, extraction route handlers, pipeline page, workflow tests.
- Migration/compatibility notes: avoid schema changes unless generated types are proven stale during implementation.
