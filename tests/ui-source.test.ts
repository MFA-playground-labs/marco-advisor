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
