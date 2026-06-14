# Dashboard Page Roadmap

Route: `/dashboard`
Status: Ready
Catalog reference: [Dashboard page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Dashboard is the trip command center. It summarizes the active private trip or public demo trip with readiness, financial exposure, next actions, confirmed/pending counts, conflicts, and recent uploads.

## Current Behavior

- Loads `getActiveTripSnapshot()` and `summarizeSnapshot()`.
- Shows an empty state when no trip snapshot exists.
- Shows active trip hero, metric cards, readiness panel, next actions, financial panel, and recent uploads when a snapshot exists.
- Uses demo snapshot until the session has private trip data.

## Primary User Jobs

- Understand whether the trip is ready or risky.
- See immediate next actions from scanner output.
- Review current financial exposure.
- Jump to upload, scanner, or bookings workflows.

## Related Routes, Components, And Workflows

- Routes: `/dashboard`, `/upload`, `/scanner`, `/bookings`.
- Components: `FinancialPanel`, `MetricCard`, `StatusPill`, `Card`.
- Workflows: active trip snapshot loading, scanner summarization.
- Data: trips, bookings, candidates, uploads, trip issues, demo snapshots.

## Current Dependencies

- Scanner issues must already be persisted for next actions to appear.
- Financial exposure is derived from confirmed bookings and double-booking issues.
- Upload counts and pending review counts depend on extraction pipeline data.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Readiness summary v2 | Draft | P2 | TBD | Add clearer severity breakdown and stale-scan signal. |
| Financial exposure drilldown | Draft | P2 | TBD | Explain locked, refundable, duplicate, and TBD amounts. |
| Next action workflow | Draft | P2 | TBD | Let users jump from dashboard issue to resolving page. |
| Recent uploads diagnostics | Draft | P3 | TBD | Surface failed/queued extraction warnings from pipeline. |

## Cross-Page Impacts

- Bookings changes affect confirmed counts, exposure, readiness, and next actions.
- Scanner changes affect readiness and issue lists.
- Upload/Pipeline changes affect recent uploads and pending review counts.

## Catalog Links

- [Data snapshot domain](../../../docs/specification-catalog.md#data-snapshot-domain)
- [Scanner domain](../../../docs/specification-catalog.md#scanner-domain)
- [Dashboard page](../../../docs/specification-catalog.md#pages)
- [Test coverage map](../../../docs/specification-catalog.md#10-test-coverage-map)

## Existing And Needed Tests

- Existing: scanner and summarization are indirectly covered by scanner/workflow tests.
- Needed: page-level snapshot fallback, dashboard count calculations, stale-scan/readiness behavior when those features are specified.
