# Feature: Extraction Pipeline Reliability

Status: Ready
Owner: TBD
Catalog references:

- [OpenAI run endpoint](../../docs/specification-catalog.md#post-apiextractionsjobsidrun)
- [Upload workflow](../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Pipeline page](../../docs/specification-catalog.md#pages)
- [Spec archive](../archive/README.md)

## Problem

The upload-first pipeline now schedules local OpenAI extraction directly. Reliability work should focus on worker execution, stale processing jobs, provider failures, and pipeline visibility.

## Goals

- Keep upload creation and OpenAI job scheduling observable.
- Keep OpenAI worker completion transactional through the existing `complete_extraction_job(...)` RPC.
- Preserve operator retry for stale or queued OpenAI jobs.
- Keep active specs visible while preserving superseded external-worker specs in the archive.

## Non-Goals

- No external extraction provider.
- No recurring retry scheduler.
- No user-facing retry UI.

## User Flow

1. User uploads supported evidence from `/upload`.
2. App creates an upload and queued OpenAI extraction job, then schedules local extraction.
3. OpenAI worker claims the job, downloads the private upload with the service-role client, prepares input, and calls OpenAI.
4. Marco applies success or failure through `complete_extraction_job(...)`.
5. User sees job, warning, page, candidate, and booking status on `/pipeline`.

## Current Behavior

- Upload creates records and schedules OpenAI extraction.
- OpenAI worker claims work through the repository RPC.
- Completion is applied through one database RPC boundary.
- Manual run endpoint can requeue stale `processing` jobs before retrying.

## API Contract

- `POST /api/upload` response is `{ upload, job, scheduled, warning? }`.
- `POST /api/extractions/jobs/[id]/run` requires `Authorization: Bearer <EXTRACTION_RUN_SECRET>`.
- The run endpoint returns the OpenAI worker result and does not expose upload file URLs.

## Failure Modes

- Missing OpenAI key or service-role key: upload fails before storage writes.
- Missing/invalid run auth: return JSON 401 and do not touch Supabase.
- Missing admin client on manual run: return JSON 500 and do not mutate state.
- OpenAI/provider failure after claim: mark job/upload failed through completion RPC.
- Stale processing manual retry: requeue job and append retry warning before worker execution.

## Acceptance Criteria

- [ ] Upload creates OpenAI job and records a scheduled event. Verification: workflow tests.
- [ ] Manual run endpoint uses `EXTRACTION_RUN_SECRET`. Verification: route tests.
- [ ] OpenAI worker success/failure paths complete through the RPC boundary. Verification: worker tests.
- [ ] Active spec indexes exclude superseded external-worker specs. Verification: source test.

## Test Plan

- Unit/workflow: upload config failure, scheduled event, worker success/failure.
- Repository: RPC call shapes for claim and completion.
- Route/API: run endpoint auth/config/stale retry branches.
- Regression: `npm run test`, `npm run typecheck`, `npm run build`.
