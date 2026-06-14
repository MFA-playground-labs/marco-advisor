# Upload Page Roadmap

Route: `/upload`
Status: Ready
Catalog reference: [Upload page](../../../docs/specification-catalog.md#pages)

## Page Purpose

Upload is the evidence intake page. It collects files and optional trip metadata, queues extraction, shows review queue status, and provides Marco chat alongside pipeline state.

## Current Behavior

- Renders `UploadPanel`, review queue, pipeline state, and `MarcoChat`.
- Accepts PDF, text, and HTML files in current validation.
- Posts multipart upload data to `/api/upload`.
- Shows upload/dispatch status and refreshes route data on success.

## Primary User Jobs

- Upload trip evidence.
- Create a private trip from the first upload.
- See whether extraction was queued.
- Review candidates once extraction completes.
- Ask Marco about current trip context.

## Related Routes, Components, And Workflows

- Routes: `/upload`, `/api/upload`, `/api/marco`, `/bookings`, `/pipeline`.
- Components: `UploadPanel`, `CandidateCard`, `MarcoChat`, `StatusPill`.
- Workflows: `uploadEvidence()`, `dispatchExtractionJob()`, `completeExtraction()`.
- Data: trips, uploads, extraction jobs, candidates.

## Current Dependencies

- Depends on Supabase anonymous session middleware.
- Extraction is n8n-first and asynchronous.
- Upload MIME support currently conflicts with screenshot-oriented copy.

## Feature Backlog

| Feature | Status | Priority | Spec | Notes |
| --- | --- | --- | --- | --- |
| Image evidence upload | Ready | P1 | [../../features/upload-image-evidence.md](../../features/upload-image-evidence.md) | Align screenshot copy with validation. |
| Upload validation feedback | Draft | P2 | TBD | Show file type/size constraints before submit. |
| Upload queue handoff clarity | Draft | P2 | TBD | Clarify queued, dispatched, warning, and failed states. |
| Review queue shortcuts | Draft | P3 | TBD | Improve movement from upload review to bookings workbench. |

## Cross-Page Impacts

- Pipeline displays upload and job lifecycle details.
- Bookings consumes extracted candidates.
- Dashboard reflects recent uploads and pending review count.

## Catalog Links

- [Upload API](../../../docs/specification-catalog.md#post-apiupload)
- [Upload workflow](../../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Upload domain](../../../docs/specification-catalog.md#upload-domain)
- [Upload page](../../../docs/specification-catalog.md#pages)

## Existing And Needed Tests

- Existing: upload validation and upload workflow tests.
- Needed: image evidence validation, upload route contract tests, page-level status behavior for dispatch warnings.
