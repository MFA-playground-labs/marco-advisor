# Scanner Page Roadmap

Route: `/scanner`
Status: Ready
Catalog reference: [Scanner page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Scanner is the risk and scheduling intelligence page. It runs deterministic checks over confirmed bookings and displays persisted trip issues with recommended actions.

## Current Behavior

- Loads active trip snapshot and summary.
- Shows scanner metrics, active issues, financial exposure, and severity/status counts.
- Allows running scanner for non-demo trips through `/api/scanner`.
- Scanner currently detects overlapping hotels, missing details, upcoming cancellation deadlines, outside-trip-date bookings, and lodging gaps.

## Primary User Jobs

- Run a full scan after accepting bookings.
- See active issues by severity and category.
- Understand recommended action for each issue.
- Use scanner output to improve dashboard readiness and trip planning.

## Related Routes, Components, And Workflows

- Routes: `/scanner`, `/api/scanner`.
- Components: `RunScannerButton`, `SeverityStripe`, `StatusPill`, `Card`.
- Workflows: `runTripScan()`, `scanTrip()`.
- Data: bookings, trip issues, trips.

## Current Dependencies

- Scanner reads confirmed bookings only.
- Scanner output is persisted by replacing trip issues for the active trip.
- Cancellation deadline logic depends on current wall-clock time.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Deterministic scanner clock | Draft | P1 | TBD | Make deadline tests stable with injectable/current date policy. |
| Issue lifecycle management | Draft | P2 | TBD | Resolve, dismiss, accept risk, and preserve issue history. |
| Scanner action handling | Draft | P2 | TBD | Turn recommended actions into page navigation/workflows. |
| Scanner rule expansion | Draft | P3 | TBD | Add travel-window, duplicate flight, and missing transport checks. |

## Cross-Page Impacts

- Bookings changes affect scanner inputs.
- Dashboard summarizes scanner output.
- Timeline visualizes conflict/gap consequences.

## Catalog Links

- [Scanner API](../../../docs/specification-catalog.md#post-apiscanner)
- [Run trip scan workflow](../../../docs/specification-catalog.md#runtripscanrepo)
- [Scanner domain](../../../docs/specification-catalog.md#scanner-domain)
- [Scanner page](../../../docs/specification-catalog.md#pages)

## Existing And Needed Tests

- Existing: scanner overlap/gap, exposure, readiness, and run-trip-scan workflow tests.
- Needed: missing details, cancellation deadline, outside trip dates, issue lifecycle, deterministic clock tests.
