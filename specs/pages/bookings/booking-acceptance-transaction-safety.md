# Page Feature: Booking Acceptance Transaction Safety

Status: Ready
Owner: TBD
Page: `/bookings`
Catalog references:

- [Candidate review workflow](../../../docs/specification-catalog.md#reviewcandidaterepo-id-intent)
- [Repository contract](../../../docs/specification-catalog.md#7-repository-contract)
- [Open specification gaps](../../../docs/specification-catalog.md#11-open-specification-gaps)
- [Bookings page roadmap](README.md)

## Problem

Candidate acceptance currently creates a booking, creates a segment, then marks the candidate accepted as separate operations. If one operation fails after an earlier write succeeds, the database can contain a partial accepted record state.

## Goals

- Make candidate acceptance atomic from the user's perspective.
- Ensure acceptance either creates booking + segment + marks candidate accepted, or leaves the candidate reviewable with no partial booking state.
- Prefer a Supabase RPC for transactional behavior.
- Preserve the existing `/api/candidates/[id]` route contract.

## Non-Goals

- No candidate editing.
- No manual booking entry.
- No audit/event table in this wave.
- No broad repository rewrite.

## User Flow

1. User reviews a candidate on `/bookings`.
2. User clicks Accept.
3. Marco atomically creates the booking and segment and marks the candidate accepted.
4. User returns to `/bookings` and sees the record in confirmed bookings.
5. If acceptance fails, the candidate remains in the review queue and no partial confirmed booking appears.

## Current Behavior

- `reviewCandidate()` requires user, fetches candidate, creates booking, creates segment, marks candidate accepted.
- The operations are separate Supabase calls.
- Partial creation is listed as an open specification gap.

## Proposed Behavior

- Add a transactional acceptance implementation using a Supabase RPC as the default recommendation.
- RPC should:
  - verify candidate belongs to the current authenticated user's trip
  - verify candidate is `needs_review`
  - insert booking from candidate fields
  - insert matching booking segment
  - mark candidate `accepted`
  - return created booking
- Keep reject path as a simple candidate status update.
- Keep `/api/candidates/[id]` and form intent behavior unchanged.

## Data Contract

- Reads one `extracted_booking_candidates` row.
- Writes one `bookings` row.
- Writes one `booking_segments` row.
- Updates candidate status to `accepted`.
- All acceptance writes occur inside one database transaction.
- RPC must preserve RLS/ownership semantics and must not expose cross-user candidate acceptance.

## API Contract

- Existing `POST /api/candidates/[id]` remains.
- Request field remains `intent=accept`.
- Success remains 303 redirect to `/bookings`.
- Failure returns JSON `{ error }` with workflow status.
- No new public route is required for this spec.

## UI Contract

- Accept button behavior is unchanged.
- On failure, user should see an error response or existing error handling and candidate should remain reviewable after refresh.
- No new UI controls are required.

## Workflow Contract

- `reviewCandidate()` accept path should call the transactional acceptance operation.
- Reject path remains unchanged.
- Workflow still requires current user before mutation.
- Candidate missing fields continue not to block acceptance.

## Failure Modes

- Candidate already accepted/rejected: no new booking/segment; return validation/conflict-style error.
- Candidate missing or not owned: no mutation; return 404/authorization-safe error.
- Booking insert validation failure: no mutation.
- Segment insert validation failure: no mutation.
- Candidate status update failure: no booking/segment persists.

## Cross-Page Impacts

- Bookings no longer risks showing partial accepted records.
- Pipeline candidate status and accepted records remain consistent.
- Dashboard/scanner/timeline/itinerary only see fully accepted bookings.

## Acceptance Criteria

- [ ] Accepting a valid candidate creates booking, segment, and accepted candidate in one transaction. Verification: database/RPC integration test.
- [ ] If segment creation would fail, no booking persists and candidate remains `needs_review`. Verification: database/RPC integration test.
- [ ] Existing candidate accept route behavior remains a 303 redirect on success. Verification: route regression.
- [ ] Reject path remains unchanged. Verification: workflow test.
- [ ] Cross-user candidate acceptance is not possible. Verification: RLS/RPC integration test or explicit security review.

## Test Plan

- Unit: keep booking mapping tests for expected field mapping.
- Workflow: reviewCandidate accept delegates to transactional operation; reject remains simple.
- Route/API: `/api/candidates/[id]` accept/reject regression.
- Database/integration: RPC success, forced failure rollback, ownership enforcement.
- UI/manual: accept candidate from `/bookings`, confirm `/pipeline` consistency.

## Open Questions

- None. Supabase RPC is the default implementation recommendation.

## Implementation Notes

- Assumptions: RPC can be added via Supabase migration and typed manually or through generated types after migration.
- Suggested source areas: Supabase migration, repository candidate acceptance method, review workflow.
- Migration/compatibility notes: requires a database migration for the RPC; no table shape change expected.
