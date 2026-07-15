# Bookings Page Roadmap

Route: `/bookings`
Status: Ready
Catalog reference: [Bookings page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Bookings is the operating surface for turning extracted candidates into trusted trip records and managing confirmed bookings that feed dashboard, scanner, timeline, itinerary, and financial exposure.

## Current Behavior

- Loads `getActiveTripSnapshot()`.
- Shows pending candidates with accept/reject controls.
- Shows confirmed bookings.
- Redirecting candidate actions post to `/api/candidates/[id]`.
- Manual booking creation, booking editing, booking cancellation, and transactional acceptance safety are not implemented.

## Primary User Jobs

- Review extracted booking candidates.
- Accept trusted candidates into confirmed bookings.
- Reject bad candidates.
- Inspect confirmed booking details.
- Add or maintain booking records when extraction is incomplete.

## Related Routes, Components, And Workflows

- Routes: `/bookings`, `/api/candidates/[id]`, future `/api/bookings`.
- Components: `BookingCard`, `CandidateCard`, `PageHeader`, `StatusPill`.
- Workflows: `reviewCandidate()`, future manual booking/edit workflows.
- Data: extracted booking candidates, bookings, booking segments, uploads, trips.

## Current Dependencies

- Requires an active trip snapshot for private data.
- Candidate review depends on OpenAI extraction creating candidates.
- Confirmed bookings feed scanner, dashboard, timeline, itinerary, and financial exposure.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Manual booking entry | Ready | P1 | [manual-booking-entry.md](manual-booking-entry.md) | Create bookings without upload evidence. |
| Candidate review workbench | Ready | P1 | [candidate-review-workbench.md](candidate-review-workbench.md) | Rich review state for source evidence and confidence. |
| Booking edit and cancel | Ready | P1 | [booking-edit-and-cancel.md](booking-edit-and-cancel.md) | Maintain confirmed records after acceptance. |
| Booking acceptance transaction safety | Ready | P1 | [booking-acceptance-transaction-safety.md](booking-acceptance-transaction-safety.md) | Avoid partial booking/segment/candidate writes. |

## Cross-Page Impacts

- Dashboard counts, readiness, exposure, and next actions update from booking changes.
- Scanner reads confirmed bookings and ignores non-confirmed bookings.
- Timeline and itinerary render accepted/confirmed bookings.
- Pipeline remains the traceability page for extracted candidate lineage.

## Catalog Links

- [Candidate review API](../../../docs/specification-catalog.md#post-apicandidatesid)
- [Candidate review workflow](../../../docs/specification-catalog.md#reviewcandidaterepo-id-intent)
- [Booking mapping domain](../../../docs/specification-catalog.md#booking-mapping-domain)
- [Bookings page](../../../docs/specification-catalog.md#pages)
- [Open specification gaps](../../../docs/specification-catalog.md#11-open-specification-gaps)

## Existing And Needed Tests

- Existing: `reviewCandidate()` accept/reject/unsupported paths, booking mapping, confidence bands, and source evidence display source checks are covered.
- Needed: manual booking workflow, booking edit/cancel, transaction safety, page-level review states.
