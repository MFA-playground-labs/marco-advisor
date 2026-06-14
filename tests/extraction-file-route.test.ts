import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionJob, UploadRecord } from "@/lib/types";

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

import { GET } from "@/app/api/extractions/jobs/[id]/file/route";

const upload: UploadRecord = {
  id: "upload-1",
  owner_id: "user-1",
  trip_id: "trip-1",
  filename: "booking.png",
  content_type: "image/png",
  storage_path: "user-1/booking.png",
  status: "uploaded"
};

const job: ExtractionJob & { upload: UploadRecord } = {
  id: "job-1",
  upload_id: upload.id,
  trip_id: "trip-1",
  status: "processing",
  provider: "n8n",
  model: "claude-haiku",
  error_message: null,
  warnings: [],
  upload
};

function authedRequest() {
  return new Request("https://example.com/api/extractions/jobs/job-1/file", {
    headers: { Authorization: "Bearer secret" }
  });
}

function params() {
  return { params: Promise.resolve({ id: "job-1" }) };
}

describe("GET /api/extractions/jobs/[id]/file", () => {
  const previousSecret = process.env.EXTRACTION_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXTRACTION_WEBHOOK_SECRET = "secret";
  });

  afterEach(() => {
    process.env.EXTRACTION_WEBHOOK_SECRET = previousSecret;
  });

  it("returns 401 for invalid worker auth without touching Supabase", async () => {
    const response = await GET(new Request("https://example.com/api/extractions/jobs/job-1/file"), params());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid extraction webhook secret." });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 500 when the admin client is not configured", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);

    const response = await GET(authedRequest(), params());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Supabase admin client is not configured." });
    expect(mocks.createSupabaseRepository).not.toHaveBeenCalled();
  });

  it("returns a 300-second signed URL and original upload metadata", async () => {
    const repo = {
      getExtractionJobWithUpload: vi.fn().mockResolvedValue(job),
      createSignedUploadUrl: vi.fn().mockResolvedValue({ signedUrl: "https://signed.example/upload" })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await GET(authedRequest(), params());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      job_id: job.id,
      upload_id: upload.id,
      filename: "booking.png",
      content_type: "image/png",
      signed_url: "https://signed.example/upload",
      expires_in: 300
    });
    expect(repo.getExtractionJobWithUpload).toHaveBeenCalledWith(job.id);
    expect(repo.createSignedUploadUrl).toHaveBeenCalledWith(upload.storage_path, 300);
  });
});
