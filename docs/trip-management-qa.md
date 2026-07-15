# Trip Management QA Plan

## Release Gates

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run e2e:ui`
- One staging browser smoke pass after the Supabase migration is applied.

## Automated Coverage

Vitest covers the trip resolver, stale selected-trip fallback, date validation, route failure branches, source-level UI contracts, and upload/scanner selected-trip behavior.

Playwright covers the browser journey for creating a named trip, confirming upload target copy, recovering from a stale selected-trip cookie, archiving, restoring, and confirming restored upload targeting.

## Local Data Path

Use local Supabase for repeatable lifecycle testing:

1. Apply migrations and confirm existing trips keep `archived_at = null`.
2. Create an anonymous/private session.
3. Create a trip from `/trips`.
4. Switch the selected trip from the sidebar.
5. Visit `/upload` and confirm the selected trip name is visible.
6. Archive the selected trip and confirm it disappears from active lists.
7. Restore the archived trip and confirm child data remains attached.
8. Set a stale `marco_selected_trip_id` cookie and confirm dashboard, upload, scanner, and pipeline fall back to the next active trip.
9. Archive all active trips and confirm authenticated pages show private no-active state, not public demo content.

## Staging Smoke Checklist

- Vercel deployment builds successfully and `/trips` loads.
- Supabase migration is applied in staging.
- Anonymous/private session can create, select, rename, archive, and restore a trip.
- Upload page shows the selected trip name before evidence is queued.
- Upload queues extraction against the selected trip.
- Scanner runs against the selected active trip.
- Archived-only account sees no-active/private empty state.
- Public demo still appears only when the user has no private trip data.

## Known Fixed Issues

- Archived-only authenticated users no longer see the public demo snapshot.
- Stale or archived selected-trip cookies no longer create the wrong upload trip when an active trip exists.
- Scanner now falls back from a stale selected-trip cookie to the next active trip.
- Trip mutation UI keeps controls disabled through the network request and announces status/errors with `aria-live`.
- Trip APIs reject invalid date strings and reversed date ranges.
- Trip lifecycle routes emit structured safe logs for create, list, update, select, archive, and restore outcomes.
