# Page Feature: Manual Booking Entry

Status: Ready
Owner: TBD
Page: `/bookings`
Catalog references:

- [Bookings page roadmap](README.md)
- [Bookings page](../../../docs/specification-catalog.md#pages)
- [Booking mapping domain](../../../docs/specification-catalog.md#booking-mapping-domain)
- [Open specification gaps](../../../docs/specification-catalog.md#11-open-specification-gaps)

## Problem

Marco currently creates confirmed bookings only by accepting extracted candidates. Users need a way to add a booking when no upload exists, extraction misses a record, or a record should be entered manually from another source.

## Goals

- Let users create a confirmed booking from `/bookings` without creating upload, extraction job, or candidate rows.
- Require the current authenticated session and an active private trip.
- Create one booking and one booking segment so scanner, dashboard, timeline, itinerary, and exposure calculations work consistently.
- Keep validation narrow and aligned with existing booking fields.

## Non-Goals

- No file upload or extraction behavior.
- No multi-segment flight builder in this wave.
- No recurring bookings.
- No external booking APIs or payment/refund actions.
- No traveler management UI beyond entering traveler names for the booking.

## User Flow

1. User opens `/bookings`.
2. User selects "Add booking".
3. User completes a compact booking form with type, title, vendor, dates, optional location, amount, currency, refundability, cancellation deadline, confirmation code, traveler names, and notes.
4. User saves.
5. Marco creates a confirmed booking and a matching booking segment.
6. User sees the new booking in Confirmed Bookings.

## Current Behavior

- `/bookings` shows pending candidates and confirmed bookings.
- The page has an "Add evidence" action rather than manual booking creation.
- No `/api/bookings` route exists.
- Accepted candidates create booking records through `reviewCandidate()`.

## Proposed Behavior

- Add a manual booking entry action to `/bookings`.
- Use an inline form or modal that keeps the user on `/bookings`.
- Create bookings only for the current active private trip.
- Default status is `confirmed`.
- Default `missing_fields` is empty.
- Default `source_upload_id` is null.
- Create a booking segment with the same type, label, date range, and location as the booking.
- After save, refresh `/bookings` so the confirmed booking list reflects the new record.

## Data Contract

- Writes one `bookings` row.
- Writes one `booking_segments` row.
- Does not write `uploads`, `extraction_jobs`, `upload_pages`, or `extracted_booking_candidates`.
- Uses existing booking types: `hotel`, `flight`, `car`, `activity`, `other`.
- Uses existing booking status `confirmed`.
- Ownership is inherited through active trip RLS.

## API Contract

- Add future route: `POST /api/bookings`.
- Request: JSON or form payload with booking type, title, vendor, starts_at, ends_at, location, total_amount, currency, refundable, cancellation_deadline, confirmation_code, traveler_names, notes.
- Success: redirect to `/bookings` if form-posted, or JSON `{ booking }` if implemented as fetch.
- Failure: JSON `{ error }` with workflow status.
- `401`: no Supabase user.
- `404`: no active private trip.
- `400`: invalid booking type or missing required title/vendor/type.

## UI Contract

- `/bookings` page gets a primary "Add booking" action in addition to or replacing "Add evidence" based on final design.
- Form fields:
  - required: booking type, title, vendor
  - optional: starts_at, ends_at, location, amount, currency, refundable, cancellation deadline, confirmation code, traveler names, notes
- Form should clearly communicate that manually entered bookings are treated as confirmed records.
- Empty state may offer both "Upload evidence" and "Add booking" once implemented.
- Success returns user to the confirmed bookings list.

## Workflow Contract

- New workflow should require a user.
- Workflow should require active trip.
- Workflow should validate booking input before side effects.
- Workflow should create booking and segment together.
- Workflow should not run scanner automatically in this wave; user can run scanner from `/scanner`.

## Failure Modes

- No active trip: show error asking user to upload evidence or create a trip first.
- Invalid required fields: show validation error and do not create records.
- Booking insert failure: no segment is created.
- Segment insert failure: implementation must either clean up the booking or use the transaction-safety approach specified separately.

## Cross-Page Impacts

- Dashboard booking counts and financial exposure include manual bookings.
- Scanner includes manual confirmed bookings.
- Timeline and itinerary show manual bookings.
- Pipeline does not show manual bookings under upload lineage because no upload exists.

## Acceptance Criteria

- [ ] User can create a manual confirmed booking from `/bookings`. Verification: route/workflow test and manual UI check.
- [ ] Manual booking creation requires a current user and active private trip. Verification: workflow/route test.
- [ ] Manual booking creates one booking and one matching segment. Verification: workflow test.
- [ ] Manual booking does not create upload, job, page, or candidate rows. Verification: workflow test or product decision.
- [ ] Manual booking appears in confirmed bookings after save. Verification: UI/manual check.
- [ ] Manual booking feeds dashboard, scanner, timeline, itinerary, and exposure through existing snapshot behavior. Verification: integration/manual regression.

## Test Plan

- Unit: validation helper for booking payload if introduced.
- Workflow: create booking + segment, reject missing active trip, reject invalid booking type.
- Route/API: `POST /api/bookings` success and error cases.
- UI/manual: add booking from `/bookings`, confirm list refresh and downstream pages.
- Regression: candidate acceptance still creates bookings as before.

## Open Questions

- None for v1. The implementation may choose inline form or modal, but must keep the behavior above.

## Implementation Notes

- Assumptions: active trip already exists before manual entry; separate trip creation UI is out of scope.
- Suggested source areas: bookings page, repository booking/segment methods, new server workflow, future `/api/bookings` route.
- Migration/compatibility notes: no schema change expected.
