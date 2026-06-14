# Feature: Upload Image Evidence

Status: Ready
Owner: TBD
Catalog references:

- [Upload API](../../docs/specification-catalog.md#post-apiupload)
- [Upload workflow](../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Upload domain](../../docs/specification-catalog.md#upload-domain)
- [Open specification gaps](../../docs/specification-catalog.md#11-open-specification-gaps)

## Problem

The product copy promises screenshots as valid trip evidence, but the upload validator and file input only support PDF, plain text, and HTML. Users with mobile screenshots or image confirmations cannot use the upload-first flow even though the UI says they should be able to.

## Goals

- Allow common screenshot/image evidence files through the same upload and extraction pipeline as existing document uploads.
- Keep the same ownership, storage, trip creation, upload record, extraction job, and n8n dispatch behavior.
- Make validation, UI copy, and tests agree on supported file types.

## Non-Goals

- No client-side image editing, compression, cropping, OCR, or preview tooling.
- No multi-file batch upload.
- No change to Supabase storage bucket or RLS policy shape.
- No direct OpenAI extraction path; extraction remains n8n-first.

## User Flow

1. User opens `/upload`.
2. User selects a PDF, TXT, HTML, PNG, JPEG, or WebP evidence file.
3. User optionally enters trip metadata.
4. User submits the form.
5. Marco stores the original file, creates or reuses the active trip, creates an upload row, creates a queued extraction job, and dispatches n8n.
6. The upload appears in pipeline state with the same status behavior as document uploads.

## Current Behavior

Current upload behavior is documented in the catalog sections linked above. The important current constraints are:

- `validateUploadFile()` accepts `application/pdf`, `text/plain`, and `text/html`.
- `maxUploadBytes` is 25 MB.
- The upload input hints `.pdf,.txt,.html,.htm,application/pdf,text/plain,text/html`.
- n8n receives only job/upload/trip ids during dispatch and fetches job metadata plus a signed file URL later.

## Proposed Behavior

- Extend supported upload MIME types to include `image/png`, `image/jpeg`, and `image/webp`.
- Extend the upload input accept list to include `.png`, `.jpg`, `.jpeg`, `.webp`, and matching MIME types.
- Keep the 25 MB maximum for all supported file types.
- Preserve current storage path generation and original filename behavior.
- Preserve current `/api/upload` response shape: `{ upload, job, dispatched, warning? }`.
- Preserve current n8n dispatch shape: `{ job_id, upload_id, trip_id }`.
- Worker metadata and file endpoints must expose the original image `content_type` exactly as stored.
- UI copy should say "PDFs, text/HTML confirmations, or screenshots" rather than implying unsupported formats.

## Data Contract

- `uploads.content_type` stores the image MIME type.
- `uploads.filename` stores the original filename.
- `uploads.status` uses existing statuses only: `uploaded`, `extracting`, `review_ready`, `failed`.
- `storage.objects` remains in the private `trip-uploads` bucket under the current user id folder.
- No schema migration is required.

## API Contract

- `POST /api/upload` accepts multipart `file` values with image MIME types listed above.
- Unsupported image formats such as HEIC, TIFF, GIF, BMP, and SVG are rejected with the existing unsupported file type error style.
- Oversized images are rejected with the existing maximum upload size error style.
- `GET /api/extractions/jobs/[id]` returns image `content_type` in the `upload` object without special-casing.
- `GET /api/extractions/jobs/[id]/file` returns a signed URL for image uploads using the same 300 second expiry.

## UI Contract

- `/upload` file chooser allows the supported image extensions and MIME types.
- `/upload` page copy mentions screenshots only after image validation supports them.
- Upload success, warning, and failure status display remain unchanged.
- `/pipeline` displays image upload filenames and content types the same way it displays documents.

## Workflow Contract

- `uploadEvidence()` must validate image files before any storage/database side effects.
- Successful image upload follows the same workflow as successful document upload.
- Failed image upload follows the same cleanup behavior as document upload.
- n8n is responsible for image parsing/OCR after it obtains the signed URL.

## Failure Modes

- Unsupported image type: reject before storage/database side effects and show the unsupported file type error.
- Oversized image: reject before storage/database side effects and show the maximum upload size error.
- Storage failure: preserve existing cleanup/error behavior.
- n8n dispatch failure: keep the queued job and record the warning exactly as current uploads do.

## Acceptance Criteria

- [ ] PNG, JPEG, and WebP files at or below 25 MB pass upload validation. Verification: unit test.
- [ ] HEIC, SVG, GIF, and empty/unknown MIME types are rejected. Verification: unit test.
- [ ] `/upload` accepts image extensions and MIME types in the file input. Verification: component/source inspection or UI test.
- [ ] A successful image upload creates the same trip/upload/job records as a document upload. Verification: workflow test.
- [ ] Image upload dispatch sends only job/upload/trip ids, preserving n8n-first extraction. Verification: workflow test.
- [ ] Pipeline displays uploaded image filename/content type and job state. Verification: manual UI check.
- [ ] No database migration is required. Verification: product decision.

## Test Plan

- Unit: extend upload-domain tests for image MIME allowlist and rejected image formats.
- Workflow: extend `uploadEvidence()` tests with an image `File`.
- Route/API: add or update `/api/upload` contract test if route tests exist in the implementation wave.
- UI/manual: upload PNG/JPEG/WebP through `/upload`, confirm `/pipeline` shows the file and queued/processing status.
- Regression: confirm PDF/TXT/HTML uploads still pass and oversized files still fail.

## Open Questions

- None. Assumptions are listed below.

## Implementation Notes

- Assumptions: PNG, JPEG, and WebP cover the first useful screenshot set; HEIC can be a later feature if needed.
- Suggested source areas: upload domain validation, upload panel accept list/copy, workflow tests.
- Migration/compatibility notes: no schema or RLS changes expected.
