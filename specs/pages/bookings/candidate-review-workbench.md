# Page Feature: Candidate Review Workbench

Status: Ready
Owner: TBD
Page: `/bookings`
Catalog references:

- [Extraction Review Quality](../../features/extraction-review-quality.md)
- [Candidate review API](../../../docs/specification-catalog.md#post-apicandidatesid)
- [Candidate review workflow](../../../docs/specification-catalog.md#reviewcandidaterepo-id-intent)
- [Bookings page roadmap](README.md)

## Problem

Candidates can be accepted or rejected, but `/bookings` does not yet behave like a focused review workbench. Users need clear confidence, missing-field, source-evidence, and status context before turning extraction output into confirmed booking records.

## Goals

- Make `/bookings` the primary review workbench for extracted candidates.
- Show confidence bands, missing fields, source pages, and snippet previews.
- Keep accept/reject behavior simple and form-based.
- Preserve `/pipeline` as the full lineage and status trace.

## Non-Goals

- No candidate editing in this wave.
- No undo or audit trail in this wave.
- No transaction safety changes beyond linking the separate transaction-safety spec.
- No manual booking work in this spec.

## User Flow

1. User opens `/bookings`.
2. User sees a "Review Extracted Candidates" section when candidates need review.
3. User scans confidence, missing fields, source page numbers, and snippet previews.
4. User accepts candidates that are trustworthy or rejects candidates that are wrong.
5. Accepted candidates move to confirmed bookings after redirect/refresh.
6. Rejected and accepted candidates remain traceable on `/pipeline`.

## Current Behavior

- `CandidateCard` shows title, vendor, date range, location, confidence, missing fields, and accept/reject buttons.
- Source pages are shown in `/pipeline`, not in the card.
- Source snippets are not shown in candidate cards.
- The review list includes only `needs_review` candidates.

## Proposed Behavior

- Keep `/bookings` review queue limited to `needs_review`.
- Add source page display when `source_pages` exists.
- Add source snippet preview when `source_snippets` exists.
- Use confidence bands:
  - high: `>= 0.85`
  - review: `0.70` to `< 0.85`
  - low: `< 0.70`
- Show missing fields prominently but do not block accept.
- Maintain accept/reject form posts to `/api/candidates/[id]`.

## Data Contract

- Reads candidate fields: `confidence`, `missing_fields`, `source_pages`, `source_snippets`, `status`, booking details.
- Accept writes booking + segment + candidate accepted through current workflow.
- Reject writes candidate rejected only.
- No schema change required.

## API Contract

- Existing `POST /api/candidates/[id]` remains the only mutation route.
- Supported form intents remain `accept` and `reject`.
- Success remains 303 redirect to `/bookings`.
- Unsupported intent returns JSON error.

## UI Contract

- Candidate cards on `/bookings` display:
  - confidence percent and band
  - missing fields
  - source pages
  - capped source snippet preview
  - accept/reject controls
- Confirmed booking section remains below or near the review section.
- Empty review state remains clear when there are no `needs_review` candidates.

## Workflow Contract

- Accept and reject continue to call `reviewCandidate()`.
- Missing fields do not block acceptance.
- Accepted candidates should no longer appear in the active review queue after refresh.
- Rejected candidates should no longer appear in active review queue after refresh.

## Failure Modes

- Accept fails: candidate remains reviewable unless mutation has already partially completed; transaction safety is covered separately.
- Reject fails: candidate remains reviewable.
- Unsupported intent: no mutation.
- Candidate no longer exists: return 404 workflow error.

## Cross-Page Impacts

- Pipeline shows accepted/rejected status after review.
- Dashboard pending review count decreases after accept/reject.
- Scanner reads accepted bookings after user runs scan.

## Acceptance Criteria

- [ ] Review queue shows only `needs_review` candidates. Verification: page/component test or manual seeded state.
- [ ] Candidate card shows source pages and snippet preview when present. Verification: UI/component test.
- [ ] Confidence bands follow specified thresholds. Verification: unit/component test.
- [ ] Missing fields are visible and do not block accept. Verification: workflow/manual check.
- [ ] Accept/reject controls preserve existing route behavior. Verification: workflow/route regression.
- [ ] Pipeline remains the trace page for accepted/rejected candidates. Verification: manual check.

## Test Plan

- Unit: confidence band helper if extracted.
- Workflow: accept and reject paths.
- Route/API: existing candidate route regression.
- UI/manual: seed candidates with high/review/low confidence, missing fields, pages, and snippets.
- Regression: accepted booking appears in confirmed bookings and downstream pages.

## Open Questions

- None. Candidate editing and undo remain deferred.

## Implementation Notes

- Assumptions: snippet preview can be a capped plain-text block; no source document viewer is required.
- Suggested source areas: `CandidateCard`, bookings page, workflow tests.
- Migration/compatibility notes: no schema change expected.
