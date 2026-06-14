# Feature Specs

Feature specs describe intended future behavior. The current application behavior remains documented in [docs/specification-catalog.md](../../docs/specification-catalog.md).

## Status Legend

- `Draft`: still being shaped.
- `Ready`: reviewed and decision-complete.
- `In Progress`: implementation underway.
- `Implemented`: shipped and catalog updated.
- `Deferred`: intentionally postponed.

## First-Wave Upload/Extraction Specs

| Spec | Status | Purpose |
| --- | --- | --- |
| [Upload Image Evidence](upload-image-evidence.md) | Ready | Add screenshot/image evidence support to the upload and extraction pipeline. |
| [Extraction Pipeline Reliability](extraction-pipeline-reliability.md) | Ready | Make async extraction job states, failures, retries, and visibility decision-complete. |
| [Extraction Review Quality](extraction-review-quality.md) | Ready | Improve candidate review confidence, source evidence, and post-review behavior. |

## Page-Organized Specs

Use page specs when feature work is primarily experienced through one app screen. Existing cross-cutting feature specs remain valid and are linked from their owning page roadmaps.

- [Dashboard page specs](../pages/dashboard/README.md)
- [Bookings page specs](../pages/bookings/README.md)
- [Upload page specs](../pages/upload/README.md)
- [Pipeline page specs](../pages/pipeline/README.md)
- [Scanner page specs](../pages/scanner/README.md)
- [Timeline page specs](../pages/timeline/README.md)
- [Itinerary page specs](../pages/itinerary/README.md)
- [Settings page specs](../pages/settings/README.md)

## Related Catalog Sections

- [Upload API](../../docs/specification-catalog.md#post-apiupload)
- [Async extraction callback](../../docs/specification-catalog.md#post-apiextractionscallback)
- [Worker job metadata endpoint](../../docs/specification-catalog.md#get-apiextractionsjobsid)
- [Worker file endpoint](../../docs/specification-catalog.md#get-apiextractionsjobsidfile)
- [Candidate review API](../../docs/specification-catalog.md#post-apicandidatesid)
- [Upload workflow](../../docs/specification-catalog.md#uploadevidenceinput-deps)
- [Extraction completion workflow](../../docs/specification-catalog.md#completeextractionrepo-payload)
- [Candidate review workflow](../../docs/specification-catalog.md#reviewcandidaterepo-id-intent)
- [Test coverage map](../../docs/specification-catalog.md#10-test-coverage-map)
