# Itinerary Page Roadmap

Route: `/itinerary`
Status: Ready
Catalog reference: [Itinerary page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Itinerary turns confirmed bookings and user preferences into planning anchors for daily activity planning and Marco-assisted recommendations.

## Current Behavior

- Loads active trip snapshot.
- Shows presentational preference sliders that are not persisted.
- Shows confirmed booking anchors.
- Includes Marco chat.
- Does not generate or persist itinerary days.

## Primary User Jobs

- Review accepted bookings as itinerary anchors.
- Express planning preferences.
- Ask Marco for day-plan guidance using trip context.
- Eventually persist itinerary preferences and plans.

## Related Routes, Components, And Workflows

- Routes: `/itinerary`, `/api/marco`.
- Components: `MarcoChat`, `Card`, `StatusPill`.
- Workflows: active trip snapshot loading, Marco advisor chat.
- Data: bookings, trip, future preferences/itinerary records.

## Current Dependencies

- Depends on confirmed bookings for itinerary anchors.
- Preferences are currently static UI and not saved.
- Marco chat uses current trip snapshot context.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Persisted preferences | Draft | P2 | TBD | Save sliders per trip/session. |
| Itinerary anchor rules | Draft | P2 | TBD | Define how flights/hotels/activities constrain day plans. |
| Marco-assisted day planning | Draft | P3 | TBD | Generate suggestions without claiming bookings/cancellations. |
| Itinerary day persistence | Draft | P3 | TBD | Store generated or user-edited daily plans. |

## Cross-Page Impacts

- Bookings provide itinerary anchors.
- Marco chat hardening affects itinerary guidance.
- Settings may show OpenAI readiness for advisor features.

## Catalog Links

- [Itinerary page](../../../docs/specification-catalog.md#pages)
- [Marco API](../../../docs/specification-catalog.md#post-apimarco)
- [OpenAI service](../../../docs/specification-catalog.md#openai-service)

## Existing And Needed Tests

- Existing: no direct itinerary tests.
- Needed: preference persistence, booking-anchor rendering, Marco prompt/context behavior for itinerary planning.
