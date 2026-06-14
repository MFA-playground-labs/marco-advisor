import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseRepository: vi.fn(),
  uploadEvidence: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

vi.mock("@/lib/server/supabase-repository", () => ({
  createSupabaseRepository: mocks.createSupabaseRepository
}));

vi.mock("@/lib/server/workflows/upload-evidence", () => ({
  uploadEvidence: mocks.uploadEvidence
}));

import { POST } from "@/app/api/upload/route";

function uploadRequest(formData: FormData) {
  return new Request("https://example.com/api/upload", {
    method: "POST",
    headers: {
      "X-Marco-Upload-Interaction-Id": "interaction-1"
    },
    body: formData
  });
}

describe("POST /api/upload", () => {
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleInfo.mockClear();
    consoleWarn.mockClear();
  });

  it("passes the interaction id through the workflow without changing the response shape", async () => {
    const formData = new FormData();
    formData.set("file", new File(["pdf"], "booking.pdf", { type: "application/pdf" }));
    formData.set("tripName", "Paris");
    const result = {
      upload: { id: "upload-1" },
      job: { id: "job-1" },
      dispatched: true
    };
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.createSupabaseRepository.mockReturnValue({ repo: true });
    mocks.uploadEvidence.mockResolvedValue(result);

    const response = await POST(uploadRequest(formData));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(mocks.uploadEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        tripName: "Paris",
        file: expect.any(File)
      }),
      {
        repo: { repo: true },
        observability: { interactionId: "interaction-1" }
      }
    );
    expect(consoleInfo).toHaveBeenCalledWith(
      "marco.upload_request_received",
      expect.objectContaining({
        interaction_id: "interaction-1",
        content_type: "application/pdf",
        file_extension: "pdf",
        size_bytes: 3
      })
    );
  });

  it("logs missing files as validation failures", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({});

    const response = await POST(uploadRequest(new FormData()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "A file is required." });
    expect(mocks.uploadEvidence).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      "marco.upload_validation_failed",
      expect.objectContaining({
        interaction_id: "interaction-1",
        reason: "missing_file"
      })
    );
  });
});
