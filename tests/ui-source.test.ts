import { readFileSync } from "node:fs";
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
});
