import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionJob, UploadRecord } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseRepository: vi.fn(),
  runOpenAiExtractionJob: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));

vi.mock("@/lib/server/supabase-repository", () => ({
  createSupabaseRepository: mocks.createSupabaseRepository
}));

vi.mock("@/lib/server/workflows/run-openai-extraction-job", () => ({
  runOpenAiExtractionJob: mocks.runOpenAiExtractionJob
}));

import { GET } from "@/app/api/extractions/jobs/[id]/route";
import { POST } from "@/app/api/extractions/jobs/[id]/run/route";

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
  status: "queued",
  provider: "n8n",
  model: "claude-haiku",
  error_message: null,
  warnings: [],
  upload
};

function authedRequest() {
  return new Request("https://example.com/api/extractions/jobs/job-1", {
    headers: { Authorization: "Bearer secret" }
  });
}

function params() {
  return { params: Promise.resolve({ id: "job-1" }) };
}

describe("GET /api/extractions/jobs/[id]", () => {
  const previousSecret = process.env.EXTRACTION_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXTRACTION_WEBHOOK_SECRET = "secret";
  });

  afterEach(() => {
    process.env.EXTRACTION_WEBHOOK_SECRET = previousSecret;
  });

  it("returns 401 for invalid worker auth without touching Supabase", async () => {
    const response = await GET(new Request("https://example.com/api/extractions/jobs/job-1"), params());

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

  it("marks queued jobs processing and returns the claimed status", async () => {
    const repo = {
      claimExtractionJob: vi.fn().mockResolvedValue({
        ...job,
        status: "processing",
        started_at: "2026-06-14T00:00:00.000Z",
        claimed: true
      })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await GET(authedRequest(), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(repo.claimExtractionJob).toHaveBeenCalledWith(job.id);
    expect(payload).toMatchObject({
      job: {
        id: job.id,
        status: "processing",
        started_at: "2026-06-14T00:00:00.000Z",
        warnings: []
      },
      upload: {
        id: upload.id,
        content_type: "image/png"
      },
      limits: {
        max_pages: 10,
        max_text_chars: 25000,
        confidence_threshold: 0.85
      }
    });
  });

  it("does not reclaim already terminal jobs", async () => {
    const repo = {
      claimExtractionJob: vi.fn().mockResolvedValue({
        ...job,
        status: "succeeded",
        started_at: "2026-06-14T00:00:00.000Z",
        claimed: false
      })
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await GET(authedRequest(), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(repo.claimExtractionJob).toHaveBeenCalledWith(job.id);
    expect(payload.job).toMatchObject({
      id: job.id,
      status: "succeeded",
      started_at: "2026-06-14T00:00:00.000Z"
    });
  });
});

describe("POST /api/extractions/jobs/[id]/run", () => {
  const previousSecret = process.env.EXTRACTION_WEBHOOK_SECRET;
  const previousStaleMs = process.env.EXTRACTION_STALE_PROCESSING_MS;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env.EXTRACTION_WEBHOOK_SECRET = "secret";
    process.env.EXTRACTION_STALE_PROCESSING_MS = "900000";
    mocks.runOpenAiExtractionJob.mockResolvedValue({ status: "succeeded", claimed: true });
  });

  afterEach(() => {
    process.env.EXTRACTION_WEBHOOK_SECRET = previousSecret;
    process.env.EXTRACTION_STALE_PROCESSING_MS = previousStaleMs;
    vi.useRealTimers();
  });

  it("returns 401 for invalid worker auth without touching Supabase", async () => {
    const response = await POST(new Request("https://example.com/api/extractions/jobs/job-1/run"), params());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid extraction webhook secret." });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.runOpenAiExtractionJob).not.toHaveBeenCalled();
  });

  it("returns 500 when the admin client is not configured", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(null);

    const response = await POST(authedRequest(), params());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Supabase admin client is not configured." });
    expect(mocks.createSupabaseRepository).not.toHaveBeenCalled();
    expect(mocks.runOpenAiExtractionJob).not.toHaveBeenCalled();
  });

  it("runs queued jobs through the OpenAI worker", async () => {
    const repo = {
      getExtractionJobWithUpload: vi.fn().mockResolvedValue(job),
      markExtractionJob: vi.fn()
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(authedRequest(), params());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "succeeded", claimed: true });
    expect(repo.getExtractionJobWithUpload).toHaveBeenCalledWith(job.id);
    expect(repo.markExtractionJob).not.toHaveBeenCalled();
    expect(mocks.runOpenAiExtractionJob).toHaveBeenCalledWith({ jobId: job.id });
  });

  it("requeues stale processing jobs before running the OpenAI worker", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T01:00:00.000Z"));
    const repo = {
      getExtractionJobWithUpload: vi.fn().mockResolvedValue({
        ...job,
        status: "processing",
        started_at: "2026-06-16T00:40:00.000Z",
        warnings: ["Earlier warning"]
      }),
      markExtractionJob: vi.fn()
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(authedRequest(), params());

    expect(response.status).toBe(200);
    expect(repo.markExtractionJob).toHaveBeenCalledWith(job.id, {
      status: "queued",
      error_message: "Retrying stale OpenAI extraction job.",
      warnings: ["Earlier warning", "Retrying stale OpenAI extraction job."]
    });
    expect(mocks.runOpenAiExtractionJob).toHaveBeenCalledWith({ jobId: job.id });
  });

  it("does not requeue fresh processing jobs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T01:00:00.000Z"));
    const repo = {
      getExtractionJobWithUpload: vi.fn().mockResolvedValue({
        ...job,
        status: "processing",
        started_at: "2026-06-16T00:58:00.000Z"
      }),
      markExtractionJob: vi.fn()
    };
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.createSupabaseRepository.mockReturnValue(repo);

    const response = await POST(authedRequest(), params());

    expect(response.status).toBe(200);
    expect(repo.markExtractionJob).not.toHaveBeenCalled();
    expect(mocks.runOpenAiExtractionJob).toHaveBeenCalledWith({ jobId: job.id });
  });
});
