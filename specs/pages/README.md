# Page-Organized Specs

Page specs organize feature development around the app screens users operate every day. They complement the current-state catalog in [docs/specification-catalog.md](../../docs/specification-catalog.md) and the cross-cutting feature specs in [specs/features](../features/README.md).

## How To Use

1. Open the roadmap for the page that owns the user workflow.
2. Check current behavior, dependencies, and cross-page impacts.
3. If the feature is already listed, promote it from backlog to a decision-complete page feature spec.
4. If the feature cuts across pages, keep the implementation spec in the page where the user starts and link impacted pages.
5. After implementation ships, update the page roadmap and the current-state catalog.

## Page Ownership Map

| Page | Route | Primary ownership |
| --- | --- | --- |
| [Dashboard](dashboard/README.md) | `/dashboard` | Trip summary, readiness, financial exposure, next actions, recent uploads. |
| [Bookings](bookings/README.md) | `/bookings` | Candidate review, confirmed booking management, manual entry, booking lifecycle. |
| [Upload](upload/README.md) | `/upload` | Evidence intake, validation, upload feedback, extraction handoff. |
| [Pipeline](pipeline/README.md) | `/pipeline` | Upload-to-extraction traceability, job state, errors, accepted record lineage. |
| [Scanner](scanner/README.md) | `/scanner` | Deterministic issue detection, issue visibility, scanner run controls. |
| [Timeline](timeline/README.md) | `/timeline` | Chronological booking visualization, conflicts, gaps. |
| [Itinerary](itinerary/README.md) | `/itinerary` | Preferences, itinerary anchors, Marco-assisted planning. |
| [Settings](settings/README.md) | `/settings` | Environment readiness, operational diagnostics, extraction worker status. |

## Templates

- [Page roadmap template](_templates/page-roadmap.md)
- [Page feature spec template](_templates/page-feature-spec.md)

## Current First Detail Area

Bookings is the first page with decision-complete feature specs:

- [Manual Booking Entry](bookings/manual-booking-entry.md)
- [Candidate Review Workbench](bookings/candidate-review-workbench.md)
- [Booking Edit And Cancel](bookings/booking-edit-and-cancel.md)
- [Booking Acceptance Transaction Safety](bookings/booking-acceptance-transaction-safety.md)
