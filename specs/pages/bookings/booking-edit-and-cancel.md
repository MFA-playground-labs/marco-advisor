# Page Feature: Booking Edit And Cancel

Status: Ready
Owner: TBD
Page: `/bookings`
Catalog references:

- [Bookings page roadmap](README.md)
- [Bookings page](../../../docs/specification-catalog.md#pages)
- [Scanner domain](../../../docs/specification-catalog.md#scanner-domain)
- [Data snapshot domain](../../../docs/specification-catalog.md#data-snapshot-domain)

## Problem

Once a booking is accepted, users cannot correct details or cancel a record. Bad dates, amounts, refundability, or status can flow into dashboard exposure, scanner output, timeline, and itinerary with no page-level correction path.

## Goals

- Let users edit key fields of confirmed booking records from `/bookings`.
- Let users mark bookings cancelled without deleting source history.
- Keep downstream pages consistent by relying on existing snapshot and scanner behavior.
- Avoid changing candidate records during booking edits.

## Non-Goals

- No source document editing.
- No external cancellation or booking provider action.
- No delete-hard booking operation in this wave.
- No audit trail migration in this wave.

## User Flow

1. User opens `/bookings`.
2. User selects Edit on a confirmed booking.
3. User updates booking fields and saves.
4. User sees the updated booking in the confirmed list.
5. User may mark a booking cancelled.
6. Cancelled booking remains visible or filterable but is excluded from scanner calculations because scanner reads confirmed bookings.

## Current Behavior

- `BookingCard` displays booking data but has no edit/cancel controls.
- Booking status supports `pending_review`, `confirmed`, `cancelled`, and `rejected`.
- Scanner filters to `confirmed` bookings.

## Proposed Behavior

- Add edit action for confirmed booking cards.
- Add cancel action that sets status `cancelled`.
- Editing should allow title, vendor, type, location, dates, amount, currency, refundability, cancellation deadline, confirmation code, traveler names, notes, and missing fields when needed.
- Saving edits should update the booking and matching primary segment where fields overlap.
- Cancelling should not delete the booking or segment.
- Scanner is not automatically re-run in this wave; UI can indicate scanner should be rerun after booking changes.

## Data Contract

- Updates `bookings`.
- Updates associated `booking_segments` for overlapping display fields: type, label/title, starts_at, ends_at, location.
- Does not update source upload or candidate records.
- Status `cancelled` remains a booking status, not a candidate status.
- No migration required.

## API Contract

- Proposed future route: `PATCH /api/bookings/[id]`.
- Request supports partial booking updates and status changes.
- Success returns JSON `{ booking }` or redirects to `/bookings` if form-posted.
- `400`: invalid fields/status/type.
- `401`: no user.
- `404`: booking not found or not owned through current trip.

## UI Contract

- Booking cards gain Edit and Cancel actions.
- Edit form should use current booking values.
- Cancel action should require a confirmation interaction.
- Cancelled bookings should not appear as active confirmed records unless a filter is added; if shown, they must be clearly marked cancelled.
- Page should communicate that scanner may need to be rerun after booking changes.

## Workflow Contract

- Require current user.
- Verify booking belongs to a trip owned by the current user through repository/RLS.
- Validate allowed update fields before mutation.
- Update booking and segment together where possible.
- Do not mutate candidates.

## Failure Modes

- Invalid update payload: no mutation and validation error.
- Booking not found or not owned: 404 error.
- Booking update succeeds but segment update fails: implementation must use transaction safety or compensating update before this feature is considered complete.
- Cancel confirmation dismissed: no mutation.

## Cross-Page Impacts

- Dashboard counts/exposure update after snapshot refresh.
- Scanner ignores cancelled bookings on next run.
- Timeline/itinerary should not show cancelled bookings as active confirmed anchors.
- Pipeline accepted record lineage remains unchanged.

## Acceptance Criteria

- [ ] User can edit allowed booking fields from `/bookings`. Verification: route/workflow/UI test.
- [ ] Editing updates matching segment display fields. Verification: workflow test.
- [ ] User can mark a booking cancelled. Verification: route/workflow/UI test.
- [ ] Cancelled bookings are excluded from scanner inputs. Verification: scanner regression/manual check.
- [ ] Candidate records are not changed by booking edits/cancellations. Verification: workflow test/product decision.
- [ ] UI communicates scanner rerun need after booking changes. Verification: manual UI check.

## Test Plan

- Unit: booking update validation if introduced.
- Workflow: edit success, cancel success, unauthorized/not-found cases.
- Route/API: `PATCH /api/bookings/[id]` success and validation errors.
- UI/manual: edit/cancel from `/bookings`, confirm downstream pages.
- Regression: candidate review and manual booking entry still work.

## Open Questions

- None for v1. Hard delete and audit history are deferred.

## Implementation Notes

- Assumptions: cancellation is an internal record status only; Marco never claims to cancel with a vendor.
- Suggested source areas: booking card, new booking workflow, repository update methods, future booking route.
- Migration/compatibility notes: no schema change expected.
