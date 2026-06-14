# Pipeline Page Roadmap

Route: `/pipeline`
Status: Ready
Catalog reference: [Pipeline page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Pipeline is the operational trace for evidence ingestion. It shows how each upload flows through extraction jobs, extracted pages, candidates, and accepted booking records.

## Current Behavior

- Loads `getPipelineSnapshot()`.
- Shows private pipeline data only.
- Groups jobs, candidates, and accepted bookings by upload.
- Displays job status, provider, page count, candidate status/confidence, source pages, and booking records.

## Primary User Jobs

- Understand where an uploaded file is in the extraction lifecycle.
- Diagnose failed or stalled extraction jobs.
- Trace accepted bookings back to source uploads/candidates.
- Navigate to pages that resolve pipeline work.

## Related Routes, Components, And Workflows

- Routes: `/pipeline`, `/api/extractions/jobs/[id]`, `/api/extractions/jobs/[id]/file`, `/api/extractions/callback`.
- Components: `Card`, `StatusPill`.
- Workflows: `uploadEvidence()`, `completeExtraction()`, worker metadata/file endpoints.
- Data: uploads, extraction jobs, upload pages, candidates, bookings.

## Current Dependencies

- Depends on async extraction migration for provider/model/warnings/raw result/upload pages.
- Worker endpoints require service role and webhook secret.
- Retry behavior is not implemented.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Pipeline reliability | Ready | P1 | [../../features/extraction-pipeline-reliability.md](../../features/extraction-pipeline-reliability.md) | Atomic worker claim, idempotent callback completion, visibility. |
| Worker lifecycle diagnostics | Draft | P2 | TBD | Show limits, started/completed timestamps, warning details. |
| Manual retry strategy | Draft | P2 | TBD | Decide operator/user retry entrypoint. |
| Accepted record lineage | Draft | P3 | TBD | Make source candidate/upload lineage more inspectable. |

## Cross-Page Impacts

- Upload creates pipeline records.
- Bookings consumes candidates and creates accepted records shown here.
- Settings may surface worker readiness and environment diagnostics.

## Catalog Links

- [Worker metadata endpoint](../../../docs/specification-catalog.md#get-apiextractionsjobsid)
- [Worker file endpoint](../../../docs/specification-catalog.md#get-apiextractionsjobsidfile)
- [Extraction callback](../../../docs/specification-catalog.md#post-apiextractionscallback)
- [Pipeline page](../../../docs/specification-catalog.md#pages)

## Existing And Needed Tests

- Existing: extraction callback workflow tests, worker metadata route tests, file endpoint route tests, schema-cache fallback tests, and page-level warning visibility source checks.
- Needed: retry behavior tests after retry spec is approved.
