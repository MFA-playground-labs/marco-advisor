# Settings Page Roadmap

Route: `/settings`
Status: Ready
Catalog reference: [Settings page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Settings exposes runtime readiness and operational diagnostics so the team can tell whether Supabase, OpenAI, and extraction worker configuration are available.

## Current Behavior

- Shows environment checks for Supabase URL, Supabase publishable key, OpenAI API key, and Supabase service role.
- Shows static runtime behavior notes.
- Does not check schema freshness or worker reachability.

## Primary User Jobs

- Confirm required environment variables are configured.
- Understand demo/private data behavior.
- Diagnose extraction pipeline readiness.
- See operational setup issues before testing uploads.

## Related Routes, Components, And Workflows

- Routes: `/settings`.
- Components: `Card`, `PageHeader`, `StatusPill`.
- Workflows: Supabase env detection, future extraction diagnostics.
- Data: environment variables, optional health-check results.

## Current Dependencies

- Server-rendered environment checks only.
- Does not call external worker or Supabase diagnostic endpoints.
- No admin-only permission model is defined for richer diagnostics.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Environment diagnostics v2 | Draft | P2 | TBD | Include extraction limits, run secret, and service role readiness. |
| Extraction worker readiness | Draft | P2 | TBD | Show whether worker endpoints can be called safely. |
| Schema freshness indicator | Draft | P3 | TBD | Detect async extraction migration/schema cache mismatch. |
| Operational runbook links | Draft | P3 | TBD | Link docs for setup, OpenAI, Supabase, and verification. |

## Cross-Page Impacts

- Upload/Pipeline reliability depends on settings-visible extraction readiness.
- Marco chat readiness depends on OpenAI configuration.
- Supabase environment checks affect every app page.

## Catalog Links

- [Environment contract](../../../docs/specification-catalog.md#3-environment-contract)
- [Settings page](../../../docs/specification-catalog.md#pages)
- [Extraction run auth](../../../docs/specification-catalog.md#extraction-run-auth)

## Existing And Needed Tests

- Existing: no direct settings tests.
- Needed: environment status rendering, missing/optional env behavior, future diagnostic states.
