# Timeline Page Roadmap

Route: `/timeline`
Status: Ready
Catalog reference: [Timeline page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Timeline visualizes confirmed bookings across the trip so users can see flights, stays, car rentals, activities, conflicts, and gaps in chronological context.

## Current Behavior

- Loads active trip snapshot.
- Filters to confirmed bookings.
- Renders a simple type-row timeline with index-based positioning.
- Highlights bookings related to issues.
- Lists double-booking conflict details.

## Primary User Jobs

- Understand how accepted bookings fit together over time.
- Spot conflicts and gaps visually.
- Connect conflict details to booking records.
- Validate trip coverage after upload/review work.

## Related Routes, Components, And Workflows

- Routes: `/timeline`, `/bookings`, `/scanner`.
- Components: `Card`, `StatusPill`.
- Workflows: active trip snapshot loading, scanner issue generation.
- Data: bookings, trip issues, trip dates.

## Current Dependencies

- Requires confirmed bookings.
- Conflict styling depends on issue `related_booking_ids`.
- Current positioning is visual guidance, not date-proportional.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Date-proportional layout | Draft | P2 | TBD | Position bookings by actual trip date/time range. |
| Conflict visualization v2 | Draft | P2 | TBD | Clarify overlapping bookings and affected intervals. |
| Gap display | Draft | P3 | TBD | Show scanner-generated lodging gaps directly on timeline. |
| Timeline-to-booking navigation | Draft | P3 | TBD | Link timeline items to booking detail/edit workflows. |

## Cross-Page Impacts

- Bookings create/edit/cancel changes timeline records.
- Scanner generates conflicts and gaps shown here.
- Dashboard links users to scanner/timeline for issue exploration.

## Catalog Links

- [Timeline page](../../../docs/specification-catalog.md#pages)
- [Scanner domain](../../../docs/specification-catalog.md#scanner-domain)
- [Booking type definitions](../../../docs/specification-catalog.md#8-domain-function-specifications)

## Existing And Needed Tests

- Existing: no direct timeline tests.
- Needed: date-proportional placement, conflict styling, gap rendering, empty states.
