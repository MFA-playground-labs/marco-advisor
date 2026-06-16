import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "@/lib/extraction-schema";
import { runOpenAiExtractionJob } from "@/lib/server/workflows/run-openai-extraction-job";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseRepository: vi.fn(),
  extractBookingsFromUpload: vi.fn()
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));

vi.mock("@/lib/server/supabase-repository", () => ({
  createSupabaseRepository: mocks.createSupabaseRepository
}));

vi.mock("@/lib/openai-extract", () => ({
  extractBookingsFromUpload: mocks.extractBookingsFromUpload
}));

const upload = {
  id: "upload-1",
  owner_id: "user-1",
  trip_id: "trip-1",
  filename: "booking.png",
  content_type: "image/png",
  storage_path: "user-1/booking.png",
  status: "uploaded" as const,
  trace_id: "trace-1"
};

const job = {
  id: "job-1",
  upload_id: upload.id,
  trip_id: "trip-1",
  status: "processing" as const,
  provider: "openai",
  model: "gpt-4.1-mini",
  trace_id: "trace-1",
  error_message: null,
  warnings: [],
  raw_result: {},
  upload
};

function extractionResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    trip: {
      name: "Italy Summer",
      destination: "Italy",
      starts_on: "2026-06-27",
      ends_on: "2026-06-29",
      travelers: ["Marco"]
    },
    bookings: [
      {
        booking_type: "hotel",
        title: "Masseria Il Frantoio",
        vendor: "Masseria Il Frantoio",
        location: "Ostuni",
        starts_at: "2026-06-27T15:00:00Z",
        ends_at: "2026-06-29T11:00:00Z",
        total_amount: 800,
        currency: "EUR",
        refundable: true,
        cancellation_deadline: null,
        traveler_names: ["Marco"],
        confirmation_code: "ABC123",
        confidence: 0.9,
        missing_fields: [],
        source_pages: [1],
        source_snippets: ["Hotel confirmation ABC123"],
        extraction_method: "openai",
        notes: null
      }
    ],
    warnings: [],
    ...overrides
  };
}

function openAiExtraction(
  overrides: Partial<{
    result: ExtractionResult;
    provider: {
      responseId: string | null;
      model: string;
      usage: Record<string, number>;
      rawResult: Record<string, unknown>;
    };
  }> = {}
) {
  return {
    result: extractionResult(),
    provider: {
      responseId: "resp_123",
      model: "gpt-test",
      usage: { input_tokens: 10, output_tokens: 20 },
      rawResult: { id: "resp_123", model: "gpt-test", usage: { input_tokens: 10, output_tokens: 20 } }
    },
    ...overrides
  };
}

function repo(overrides: Record<string, unknown> = {}) {
  return {
    claimExtractionJob: vi.fn().mockResolvedValue({ ...job, claimed: true }),
    getExtractionJobWithUpload: vi.fn().mockResolvedValue(job),
    updateExtractionJobObservability: vi.fn().mockResolvedValue(undefined),
    downloadUploadedFile: vi.fn().mockResolvedValue(new Blob(["image-bytes"], { type: "image/png" })),
    completeExtractionJob: vi.fn().mockResolvedValue({ status: "succeeded", candidates: 1, duplicate: false }),
    recordExtractionJobEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
    ...overrides
  };
}

describe("runOpenAiExtractionJob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.extractBookingsFromUpload.mockResolvedValue(openAiExtraction());
    delete process.env.OPENAI_EXTRACTION_MAX_ENCODED_BYTES;
    delete process.env.EXTRACTION_MAX_TEXT_CHARS;
    delete process.env.OPENAI_EXTRACTION_MODEL;
  });

  it("claims, downloads, extracts, records provider metadata, and completes an image job", async () => {
    const mockRepo = repo();
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);

    await expect(runOpenAiExtractionJob({ jobId: job.id })).resolves.toEqual({
      status: "succeeded",
      jobId: job.id,
      claimed: true,
      candidates: 1,
      duplicate: false
    });

    expect(mockRepo.claimExtractionJob).toHaveBeenCalledWith(job.id);
    expect(mockRepo.getExtractionJobWithUpload).toHaveBeenCalledWith(job.id);
    expect(mockRepo.downloadUploadedFile).toHaveBeenCalledWith(upload.storage_path);
    expect(mocks.extractBookingsFromUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: upload.filename,
        contentType: upload.content_type,
        imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/)
      })
    );
    expect(mockRepo.updateExtractionJobObservability).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({
        providerRequestId: "resp_123",
        providerLatencyMs: expect.any(Number),
        providerUsage: { input_tokens: 10, output_tokens: 20 }
      })
    );
    expect(mockRepo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        status: "succeeded",
        provider: "openai",
        model: "gpt-test",
        bookings: [expect.objectContaining({ extraction_method: "openai" })],
        rawResult: expect.objectContaining({
          id: "resp_123",
          input: expect.objectContaining({ input_kind: "image" })
        })
      })
    );
    expect(mockRepo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "marco.extraction_job_claimed", attemptId: expect.any(String), traceId: "trace-1" })
    );
    expect(mockRepo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "marco.extraction_openai_request_completed", provider: "openai", model: "gpt-test" })
    );
    expect(mockRepo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "marco.extraction_job_completed", status: "succeeded" })
    );
  });

  it("skips already-claimed or terminal jobs without downloading or completing", async () => {
    const mockRepo = repo({
      claimExtractionJob: vi.fn().mockResolvedValue({ ...job, claimed: false, status: "succeeded" })
    });
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);

    await expect(runOpenAiExtractionJob({ jobId: job.id })).resolves.toEqual({
      status: "skipped",
      jobId: job.id,
      claimed: false
    });

    expect(mockRepo.downloadUploadedFile).not.toHaveBeenCalled();
    expect(mocks.extractBookingsFromUpload).not.toHaveBeenCalled();
    expect(mockRepo.completeExtractionJob).not.toHaveBeenCalled();
    expect(mockRepo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "marco.extraction_job_claim_skipped", status: "succeeded" })
    );
  });

  it("clips text input and carries the warning into completion", async () => {
    process.env.EXTRACTION_MAX_TEXT_CHARS = "5";
    const textUpload = { ...upload, filename: "booking.txt", content_type: "text/plain", storage_path: "user-1/booking.txt" };
    const textJob = { ...job, upload: textUpload, upload_id: textUpload.id };
    const mockRepo = repo({
      claimExtractionJob: vi.fn().mockResolvedValue({ ...textJob, claimed: true }),
      getExtractionJobWithUpload: vi.fn().mockResolvedValue(textJob),
      downloadUploadedFile: vi.fn().mockResolvedValue(new Blob(["abcdef"], { type: "text/plain" }))
    });
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);

    await runOpenAiExtractionJob({ jobId: job.id });

    expect(mocks.extractBookingsFromUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "abcde"
      })
    );
    expect(mockRepo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        warnings: ["Input text was clipped to 5 characters before OpenAI extraction."]
      })
    );
  });

  it("marks a claimed job failed when OpenAI extraction throws", async () => {
    const mockRepo = repo();
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);
    mocks.extractBookingsFromUpload.mockRejectedValue(new Error("Schema validation failed"));

    await expect(runOpenAiExtractionJob({ jobId: job.id })).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        jobId: job.id,
        claimed: true,
        stage: "openai_request",
        errorMessage: "Schema validation failed"
      })
    );

    expect(mockRepo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        provider: "openai",
        errorMessage: "Schema validation failed",
        rawResult: { stage: "openai_request", error_message: "Schema validation failed" }
      })
    );
    expect(mockRepo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "marco.extraction_job_failed", stage: "openai_request", status: "failed" })
    );
  });

  it("marks a claimed job failed when private storage download fails", async () => {
    const mockRepo = repo({
      downloadUploadedFile: vi.fn().mockRejectedValue(new Error("Object not found"))
    });
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);

    await expect(runOpenAiExtractionJob({ jobId: job.id })).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        stage: "download",
        errorMessage: "Object not found"
      })
    );

    expect(mocks.extractBookingsFromUpload).not.toHaveBeenCalled();
    expect(mockRepo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "Object not found" })
    );
  });

  it("fails before OpenAI when encoded image input exceeds the configured guard", async () => {
    process.env.OPENAI_EXTRACTION_MAX_ENCODED_BYTES = "10";
    const mockRepo = repo();
    mocks.createSupabaseRepository.mockReturnValue(mockRepo);

    await expect(runOpenAiExtractionJob({ jobId: job.id })).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        stage: "prepare_input",
        errorMessage: expect.stringContaining("image data URL is too large")
      })
    );

    expect(mocks.extractBookingsFromUpload).not.toHaveBeenCalled();
    expect(mockRepo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: expect.stringContaining("image data URL is too large")
      })
    );
  });
});
