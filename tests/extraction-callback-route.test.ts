import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseRepository: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));

vi.mock("@/lib/server/supabase-repository", () => ({
  createSupabaseRepository: mocks.createSupabaseRepository
}));

import { POST } from "@/app/api/extractions/callback/route";

function request(body: unknown, secret = "secret") {
  return new Request("https://example.com/api/extractions/callback", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/extractions/callback", () => {
  const previousSecret = process.env.EXTRACTION_WEBHOOK_SECRET;
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXTRACTION_WEBHOOK_SECRET = "secret";
  });

  afterEach(() => {
    process.env.EXTRACTION_WEBHOOK_SECRET = previousSecret;
  });

  it("returns 401 for invalid worker auth without touching Supabase", async () => {
    const response = await POST(request({ job_id: "job-1", status: "succeeded" }, "wrong"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid extraction webhook secret." });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 500 when the admin client is not configured", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);

    const response = await POST(request({ job_id: "job-1", status: "succeeded" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Supabase admin client is not configured." });
    expect(mocks.createSupabaseRepository).not.toHaveBeenCalled();
  });

  it("completes successful callbacks through the repository rpc boundary", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "succeeded", candidates: 1, duplicate: false })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(
      request({
        job_id: "job-1",
        status: "succeeded",
        pages: [{ page_number: 1, text: "Hotel confirmation", extraction_confidence: 0.9 }],
        trip: { name: "Italy", destination: "Italy", starts_on: null, ends_on: null, travelers: ["Marco"] },
        bookings: [
          {
            booking_type: "hotel",
            title: "Hotel",
            vendor: "Hotel",
            location: "Ostuni",
            starts_at: null,
            ends_at: null,
            total_amount: null,
            currency: null,
            refundable: null,
            cancellation_deadline: null,
            traveler_names: ["Marco"],
            confirmation_code: "ABC123",
            confidence: 0.9,
            missing_fields: [],
            source_pages: [1],
            source_snippets: ["Hotel confirmation"],
            extraction_method: "haiku",
            notes: null
          }
        ]
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "succeeded", candidates: 1 });
    expect(repo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        status: "succeeded",
        pages: [expect.objectContaining({ page_number: 1 })],
        bookings: [expect.objectContaining({ confirmation_code: "ABC123" })]
      })
    );
    expect(consoleInfo).toHaveBeenCalledWith("marco.extraction_callback_completed", expect.objectContaining({ job_id: "job-1" }));
  });

  it("handles failed callbacks without creating candidates", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "failed", candidates: 0, duplicate: false })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(
      request({
        job_id: "job-1",
        status: "failed",
        warnings: ["No extractable text"],
        error_message: "No extractable text"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "failed", candidates: 0 });
    expect(repo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", status: "failed", errorMessage: "No extractable text" })
    );
    expect(consoleWarn).toHaveBeenCalledWith("marco.extraction_callback_failed", expect.objectContaining({ job_id: "job-1" }));
  });

  it("returns the existing terminal state for duplicate callbacks", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "succeeded", candidates: 1, duplicate: true })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(
      request({
        job_id: "job-1",
        status: "failed",
        warnings: ["late duplicate failure"],
        error_message: "late duplicate failure"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "succeeded", candidates: 1 });
    expect(consoleInfo).toHaveBeenCalledWith(
      "marco.extraction_callback_duplicate_ignored",
      expect.objectContaining({ job_id: "job-1", requested_status: "failed", current_status: "succeeded" })
    );
  });
});
