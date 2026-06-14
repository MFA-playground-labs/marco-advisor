# Feature: Extraction Review Quality

Status: Implemented
Owner: TBD
Catalog references:

- [Candidate review API](../../docs/specification-catalog.md#post-apicandidatesid)
- [Candidate review workflow](../../docs/specification-catalog.md#reviewcandidaterepo-id-intent)
- [Booking mapping domain](../../docs/specification-catalog.md#booking-mapping-domain)
- [Extraction schema domain](../../docs/specification-catalog.md#extraction-schema-domain)
- [Bookings and upload pages](../../docs/specification-catalog.md#pages)
- [Open specification gaps](../../docs/specification-catalog.md#11-open-specification-gaps)

## Problem

Extracted candidates are reviewable, but the review surface is thin. Users can accept or reject candidates, yet source evidence, confidence context, missing fields, and post-review visibility are not specified enough to safely improve review quality.

## Goals

- Make candidate review behavior explicit before changing UI or workflow code.
- Show enough extraction evidence for users to decide whether to accept or reject a candidate.
- Preserve the rule that bookings are created only after user review.
- Define confidence, missing-field, source page/snippet, and post-review behavior.

## Non-Goals

- No candidate editing in this wave.
- No undo/reopen rejected candidates in this wave.
- No audit trail migration in this wave.
- No transactional booking acceptance change unless separately specified.
- No new manual booking creation UI.

## User Flow

1. User uploads evidence and waits for extraction completion.
2. Candidate appears in the review queue on `/upload` and `/bookings`.
3. User sees title, vendor, date range, location, amount, confidence, missing fields, source pages/snippets when available, and accept/reject controls.
4. User accepts a candidate, creating a confirmed booking and booking segment.
5. User rejects a candidate, removing it from the active review queue.
6. `/pipeline` still shows the candidate status for traceability.

## Current Behavior

Current candidate behavior is documented in the linked catalog sections. Important current details:

- Candidates have statuses `needs_review`, `accepted`, and `rejected`.
- `CandidateCard` shows title, vendor, date range, location, confidence, missing fields, and accept/reject buttons.
- Accept creates a booking and booking segment, then marks candidate accepted.
- Reject marks candidate rejected.
- `/pipeline` displays candidate status, confidence, title, vendor, and source pages when present.

## Proposed Behavior

- Keep candidate statuses unchanged.
- Review queue shows only `needs_review` candidates.
- Accepted/rejected candidates remain visible in `/pipeline`.
- Candidate cards should show source snippets when present, capped to a short readable preview.
- Candidate cards should show source pages when present.
- Confidence should be visually categorized:
  - high: `>= 0.85`
  - review: `0.70` to `< 0.85`
  - low: `< 0.70`
- Missing fields should be prominent and should not block accept in this wave.
- Accept/reject posts remain form-based and redirect to `/bookings`.
- Rejected candidates should not create bookings or segments.

## Data Contract

- `extracted_booking_candidates.status` remains `needs_review`, `accepted`, or `rejected`.
- `source_pages`, `source_snippets`, `confidence`, and `missing_fields` are read for review display.
- Accept writes one `bookings` row and one `booking_segments` row using current mapping behavior.
- Reject writes only candidate status.
- No schema migration is required.

## API Contract

- `POST /api/candidates/[id]` keeps the existing form field `intent`.
- Supported intents remain `accept` and `reject`.
- Successful accept/reject redirects to `/bookings` with `303`.
- Unsupported intent returns JSON error with workflow status.
- Response shape does not need to expose booking data to the browser because the route redirects.

## UI Contract

- `/upload` and `/bookings` show active review queue from `needs_review` candidates.
- Candidate review UI displays:
  - title
  - vendor or Vendor TBD
  - date range
  - location or Location TBD
  - amount when available
  - confidence category and percent
  - missing fields
  - source pages when available
  - source snippet preview when available
  - accept/reject controls
- `/pipeline` remains the traceability page for all candidate statuses.
- Empty review queue states remain unchanged.

## Workflow Contract

- `reviewCandidate()` continues to require a user.
- Reject path marks candidate rejected and creates no booking/segment.
- Accept path fetches candidate, creates booking, creates booking segment, and marks candidate accepted.
- Candidate missing fields do not prevent accept.
- Transactional accept is deferred and must be handled by a separate reliability/spec decision.

## Failure Modes

- Unsupported intent: return workflow error and do not mutate candidate.
- Missing candidate: return 404 error and do not create booking/segment.
- Booking creation failure: candidate remains `needs_review`.
- Segment creation failure after booking creation: known current gap; do not change in this wave without separate transactional spec.
- User not authenticated: return 401 workflow error.

## Acceptance Criteria

- [ ] Review queue includes only `needs_review` candidates. Verification: UI/manual check or component/page test.
- [ ] Candidate card displays source pages and source snippet preview when present. Verification: component/source test or manual seeded data check.
- [ ] Confidence categories match the specified thresholds. Verification: unit/component test.
- [ ] Missing fields are visible and do not block accept. Verification: workflow/UI test.
- [ ] Accept creates one booking and one segment, then marks candidate accepted. Verification: existing workflow test remains green.
- [ ] Reject creates no booking/segment and marks candidate rejected. Verification: workflow test.
- [ ] `/pipeline` continues to show accepted and rejected candidates for traceability. Verification: manual UI check.

## Test Plan

- Unit: confidence category helper if one is introduced.
- Workflow: expand `reviewCandidate()` tests for reject path and unsupported intent.
- Route/API: add candidate route tests when route-test harness exists.
- UI/manual: seed candidates with source pages/snippets/missing fields and confirm `/upload`, `/bookings`, and `/pipeline` display behavior.
- Regression: confirm accepted bookings still feed dashboard, scanner, timeline, and itinerary.

## Open Questions

- None for this wave. Candidate editing, undo, audit trail, and transactional accept are deferred.

## Implementation Notes

- Assumptions: users can accept incomplete candidates for now because missing details are already carried into booking records and scanner issues.
- Suggested source areas: candidate card, candidate review workflow tests, pipeline page.
- Migration/compatibility notes: no schema changes expected.
