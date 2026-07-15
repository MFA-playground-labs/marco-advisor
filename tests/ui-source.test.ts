import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uploadAccept } from "@/lib/domain/upload";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("UI source contracts", () => {
  it("keeps upload image accept hints wired to the shared domain list", () => {
    expect(uploadAccept).toContain("image/png");
    expect(uploadAccept).toContain("image/jpeg");
    expect(uploadAccept).toContain("image/webp");
    expect(source("components/upload-panel.tsx")).toContain("accept={uploadAccept}");
  });

  it("captures the upload form before async work and avoids async event currentTarget reset", () => {
    const uploadPanel = source("components/upload-panel.tsx");

    expect(uploadPanel).toContain("const form = event.currentTarget");
    expect(uploadPanel).toContain("const formData = new FormData(form)");
    expect(uploadPanel).toContain("form.reset()");
    expect(uploadPanel).not.toContain("event.currentTarget.reset()");
    expect(uploadPanel).toContain("X-Marco-Upload-Interaction-Id");
  });

  it("keeps upload observability wired through client and server workflow milestones", () => {
    const uploadPanel = source("components/upload-panel.tsx");
    const uploadRoute = source("app/api/upload/route.ts");
    const uploadWorkflow = source("lib/server/workflows/upload-evidence.ts");

    expect(uploadPanel).toContain("marco.upload_submit_started");
    expect(uploadPanel).toContain("marco.upload_submit_succeeded");
    expect(uploadPanel).toContain("marco.upload_submit_failed");
    expect(uploadPanel).toContain("marco.upload_ui_cleanup_failed");
    expect(uploadRoute).toContain("marco.upload_request_received");
    expect(uploadRoute).toContain("marco.upload_validation_failed");
    expect(uploadWorkflow).toContain("marco.upload_storage_completed");
    expect(uploadWorkflow).toContain("marco.upload_record_created");
    expect(uploadWorkflow).toContain("marco.upload_extraction_job_created");
    expect(uploadWorkflow).toContain("marco.upload_dispatch_completed");
    expect(uploadWorkflow).toContain("marco.upload_dispatch_failed");
    expect(uploadWorkflow).toContain("marco.upload_workflow_failed");
  });

  it("surfaces trip management and selected upload context", () => {
    const appShell = source("components/app-shell.tsx");
    const tripPage = source("app/(app)/trips/page.tsx");
    const tripManager = source("components/trip-manager.tsx");
    const uploadPanel = source("components/upload-panel.tsx");

    expect(appShell).toContain("tripList");
    expect(appShell).toContain("/api/trips/${tripId}/select");
    expect(appShell).toContain("Manage");
    expect(tripPage).toContain("TripManager");
    expect(tripManager).toContain("Past Trip Cleanup");
    expect(tripManager).toContain("Archived Trips");
    expect(tripManager).toContain("/api/trips/${tripId}/archive");
    expect(tripManager).toContain("/api/trips/${tripId}/restore");
    expect(tripManager).toContain("busyAction");
    expect(tripManager).toContain("aria-live=\"polite\"");
    expect(appShell).toContain("selectionError");
    expect(appShell).toContain("Switching trip...");
    expect(uploadPanel).toContain("Evidence will be added to");
  });

  it("shows candidate evidence context in the review card", () => {
    const bookingCard = source("components/booking-card.tsx");

    expect(bookingCard).toContain("sourceSnippetPreview");
    expect(bookingCard).toContain("candidate.source_pages");
    expect(bookingCard).toContain("money(candidate.total_amount");
  });

  it("surfaces pipeline warnings and per-job candidate counts", () => {
    const pipeline = source("app/(app)/pipeline/page.tsx");

    expect(pipeline).toContain("job.warnings");
    expect(pipeline).toContain("jobCandidates.length");
    expect(pipeline).toContain("job.status === \"failed\"");
    expect(pipeline).toContain("job.trace_id");
    expect(pipeline).toContain("job.attempt_id");
    expect(pipeline).toContain("job.last_stage");
    expect(pipeline).toContain("job.provider_request_id");
    expect(pipeline).toContain("job.provider_latency_ms");
    expect(pipeline).toContain("isRetryableJob(job)");
  });

  it("keeps archived feature specs out of the active feature index", () => {
    const activeFeatures = source("specs/features/README.md");
    const archiveIndex = source("specs/archive/README.md");

    expect(activeFeatures).toContain("extraction-pipeline-reliability.md");
    expect(activeFeatures).not.toContain("upload-image-evidence.md");
    expect(activeFeatures).not.toContain("extraction-review-quality.md");
    expect(activeFeatures).toContain("../archive/README.md");

    expect(archiveIndex).toContain("features/upload-image-evidence.md");
    expect(archiveIndex).toContain("features/extraction-review-quality.md");
    expect(archiveIndex).toContain("features/extraction-pipeline-reliability-v1.md");
    expect(existsSync("specs/archive/features/upload-image-evidence.md")).toBe(true);
    expect(existsSync("specs/archive/features/extraction-review-quality.md")).toBe(true);
    expect(existsSync("specs/archive/features/extraction-pipeline-reliability-v1.md")).toBe(true);
  });
});
