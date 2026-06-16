import { describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "@/lib/extraction-schema";
import { bookingInsertFromCandidate } from "@/lib/domain/booking-mapping";
import { confidenceCategory, sourceSnippetPreview } from "@/lib/domain/review-quality";
import { maxUploadBytes, validateUploadFile } from "@/lib/domain/upload";
import { errorMessage, asyncExtractionMigrationMessage } from "@/lib/server/errors";
import { requireExtractionWebhookAuth } from "@/lib/server/extraction-auth";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import type { UploadEvidenceDeps } from "@/lib/server/workflows/upload-evidence";
import { uploadEvidence } from "@/lib/server/workflows/upload-evidence";
import { completeExtraction } from "@/lib/server/workflows/complete-extraction";
import { reviewCandidate } from "@/lib/server/workflows/review-candidate";
import { runTripScan } from "@/lib/server/workflows/run-trip-scan";
import type { Booking, ExtractedBookingCandidate, ExtractionJob, Trip, UploadRecord } from "@/lib/types";

const user = { id: "user-1" };
const trip: Trip = {
  id: "trip-1",
  owner_id: user.id,
  name: "Italy",
  destination: "Italy",
  starts_on: "2026-06-27",
  ends_on: "2026-06-29"
};
const upload: UploadRecord = {
  id: "upload-1",
  owner_id: user.id,
  trip_id: trip.id,
  filename: "booking.txt",
  content_type: "text/plain",
  storage_path: "user-1/upload.txt",
  status: "uploaded"
};
const job: ExtractionJob = {
  id: "job-1",
  upload_id: upload.id,
  trip_id: trip.id,
  status: "queued",
  provider: "n8n",
  model: "claude-haiku",
  error_message: null,
  warnings: []
};

function textFile(name = "booking.txt") {
  return new File(["Hotel confirmation"], name, { type: "text/plain" });
}

function imageFile(name = "booking.png", type = "image/png") {
  return new File(["screenshot"], name, { type });
}

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
        source_pages: [],
        source_snippets: [],
        extraction_method: "rules",
        notes: null
      }
    ],
    warnings: [],
    ...overrides
  };
}

function uploadRepo(overrides: Partial<UploadEvidenceDeps["repo"]> = {}): UploadEvidenceDeps["repo"] {
  return {
    requireUser: vi.fn().mockResolvedValue(user),
    getActiveTrip: vi.fn().mockResolvedValue(trip),
    createTrip: vi.fn().mockResolvedValue(trip),
    updateTrip: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    removeUploadedFile: vi.fn().mockResolvedValue(undefined),
    createUploadRecord: vi.fn().mockResolvedValue(upload),
    createExtractionJob: vi.fn().mockResolvedValue(job),
    markUploadStatus: vi.fn().mockResolvedValue(undefined),
    markExtractionJob: vi.fn().mockResolvedValue(undefined),
    recordExtractionJobEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
    ...overrides
  };
}

function candidate(overrides: Partial<ExtractedBookingCandidate> = {}): ExtractedBookingCandidate {
  return {
    id: "candidate-1",
    upload_id: upload.id,
    trip_id: trip.id,
    status: "needs_review",
    booking_type: "hotel",
    title: "Masseria Il Frantoio",
    vendor: null,
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
    raw_json: {},
    ...overrides
  };
}

describe("upload domain helpers", () => {
  it("rejects unsupported files before workflow side effects", () => {
    expect(validateUploadFile(new File(["x"], "booking.csv", { type: "text/csv" }))).toContain("Unsupported file type");
  });

  it("accepts first-wave image evidence types", () => {
    expect(validateUploadFile(imageFile("booking.png", "image/png"))).toBeNull();
    expect(validateUploadFile(imageFile("booking.jpg", "image/jpeg"))).toBeNull();
    expect(validateUploadFile(imageFile("booking.webp", "image/webp"))).toBeNull();
  });

  it("rejects unsupported and oversized images", () => {
    expect(validateUploadFile(imageFile("booking.heic", "image/heic"))).toContain("Unsupported file type");
    expect(validateUploadFile(imageFile("booking.svg", "image/svg+xml"))).toContain("Unsupported file type");
    expect(validateUploadFile(imageFile("booking.gif", "image/gif"))).toContain("Unsupported file type");
    expect(validateUploadFile(imageFile("booking.bmp", "image/bmp"))).toContain("Unsupported file type");
    expect(validateUploadFile(new File(["x"], "booking", { type: "" }))).toContain("Unsupported file type");
    expect(validateUploadFile({ name: "big.png", type: "image/png", size: maxUploadBytes + 1 })).toContain("File is too large");
  });
});

describe("uploadEvidence", () => {
  it("stores the upload, creates a queued job, and dispatches it", async () => {
    const repo = uploadRepo();
    const dispatch = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch })
    ).resolves.toEqual({ upload, job, dispatched: true });

    expect(repo.uploadFile).toHaveBeenCalledOnce();
    expect(repo.createUploadRecord).toHaveBeenCalledWith(expect.objectContaining({ status: "uploaded" }));
    expect(repo.createExtractionJob).toHaveBeenCalledWith(expect.objectContaining({ status: "queued", provider: "openai", model: "gpt-4.1-mini" }));
    expect(dispatch).toHaveBeenCalledWith({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
  });

  it("uses n8n provider metadata when the fallback provider is configured", async () => {
    const previousProvider = process.env.EXTRACTION_PROVIDER;
    process.env.EXTRACTION_PROVIDER = "n8n";
    const repo = uploadRepo();
    const dispatch = vi.fn().mockResolvedValue({ ok: true });

    await uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch });

    expect(repo.createExtractionJob).toHaveBeenCalledWith(expect.objectContaining({ status: "queued", provider: "n8n", model: "claude-haiku" }));
    if (previousProvider === undefined) {
      delete process.env.EXTRACTION_PROVIDER;
    } else {
      process.env.EXTRACTION_PROVIDER = previousProvider;
    }
  });

  it("propagates the trace id to upload and extraction job persistence", async () => {
    const repo = uploadRepo();
    const dispatch = vi.fn().mockResolvedValue({ ok: true });

    await uploadEvidence(
      { file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" },
      { repo, dispatch, observability: { traceId: "trace-1", interactionId: "interaction-1" } }
    );

    expect(repo.createUploadRecord).toHaveBeenCalledWith(expect.objectContaining({ trace_id: "trace-1" }));
    expect(repo.createExtractionJob).toHaveBeenCalledWith(expect.objectContaining({ trace_id: "trace-1" }));
    expect(repo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: "trace-1",
        tripId: trip.id,
        uploadId: upload.id,
        jobId: job.id,
        event: "marco.upload_extraction_job_created"
      })
    );
    expect(repo.recordExtractionJobEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: "trace-1",
        event: "marco.upload_dispatch_completed",
        metadata: { dispatched: true }
      })
    );
  });

  it("sends image evidence through the same upload workflow and dispatch shape", async () => {
    const repo = uploadRepo({
      createUploadRecord: vi.fn().mockResolvedValue({ ...upload, filename: "booking.png", content_type: "image/png" })
    });
    const dispatch = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      uploadEvidence({ file: imageFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch })
    ).resolves.toEqual({
      upload: { ...upload, filename: "booking.png", content_type: "image/png" },
      job,
      dispatched: true
    });

    expect(repo.uploadFile).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/.*-booking\.png$/), expect.any(File), "image/png");
    expect(repo.createUploadRecord).toHaveBeenCalledWith(expect.objectContaining({ filename: "booking.png", content_type: "image/png" }));
    expect(dispatch).toHaveBeenCalledWith({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
  });

  it("keeps the upload queued and records a warning when dispatch fails", async () => {
    const repo = uploadRepo();
    const dispatch = vi.fn().mockResolvedValue({ ok: false, warning: "n8n unavailable" });

    await expect(
      uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch })
    ).resolves.toEqual({ upload, job, dispatched: false });

    expect(repo.markExtractionJob).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({ error_message: "n8n unavailable", warnings: ["n8n unavailable"] })
    );
  });

  it("returns a migration warning when extraction job creation falls back to the old schema", async () => {
    const repo = uploadRepo({
      createExtractionJob: vi.fn().mockResolvedValue({ ...job, migration_warning: asyncExtractionMigrationMessage })
    });
    const dispatch = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch })
    ).resolves.toEqual({ upload, job: { ...job, migration_warning: asyncExtractionMigrationMessage }, dispatched: true, warning: asyncExtractionMigrationMessage });
  });

  it("does not write the new warnings column when fallback schema is detected", async () => {
    const fallbackJob = { ...job, migration_warning: asyncExtractionMigrationMessage };
    const repo = uploadRepo({
      createExtractionJob: vi.fn().mockResolvedValue(fallbackJob)
    });
    const dispatch = vi.fn().mockResolvedValue({ ok: false, warning: "n8n unavailable" });

    await uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, dispatch });

    expect(repo.markExtractionJob).toHaveBeenCalledWith(job.id, { error_message: "n8n unavailable" });
  });
});

describe("workflow error messages", () => {
  it("turns Supabase async extraction schema cache errors into a migration message", () => {
    expect(errorMessage(new Error("Could not find the 'model' column of 'extraction_jobs' in the schema cache"))).toBe(
      asyncExtractionMigrationMessage
    );
  });
});

describe("supabase repository", () => {
  it("retries extraction job creation with the old schema when async metadata is missing", async () => {
    const inserted: unknown[] = [];
    const supabase = {
      from(table: string) {
        return {
          insert(input: unknown) {
            inserted.push({ table, input });
            return {
              select() {
                return {
                  async single() {
                    if (inserted.length === 1) {
                      return {
                        data: null,
                        error: {
                          message: "Could not find the 'model' column of 'extraction_jobs' in the schema cache"
                        }
                      };
                    }
                    return {
                      data: job,
                      error: null
                    };
                  }
                };
              }
            };
          }
        };
      }
    };

    const repo = createSupabaseRepository(supabase as any);
    await expect(
      repo.createExtractionJob({
        upload_id: upload.id,
        trip_id: trip.id,
        status: "queued",
        provider: "n8n",
        model: "claude-haiku"
      })
    ).resolves.toEqual({ ...job, migration_warning: asyncExtractionMigrationMessage });

    expect(inserted).toEqual([
      {
        table: "extraction_jobs",
        input: expect.objectContaining({ provider: "n8n", model: "claude-haiku" })
      },
      {
        table: "extraction_jobs",
        input: { upload_id: upload.id, trip_id: trip.id, status: "queued" }
      }
    ]);
  });

  it("claims extraction jobs through the atomic rpc", async () => {
    const calls: unknown[] = [];
    const supabase = {
      rpc(name: string, input: unknown) {
        calls.push({ name, input });
        return {
          async single() {
            return {
              data: {
                ...job,
                trace_id: "trace-1",
                attempt_id: "attempt-1",
                last_stage: "claim",
                provider_request_id: "resp_1",
                provider_latency_ms: 123,
                provider_usage: { input_tokens: 10 },
                claimed: true,
                upload_owner_id: upload.owner_id,
                upload_trip_id: upload.trip_id,
                upload_filename: upload.filename,
                upload_content_type: upload.content_type,
                upload_storage_path: upload.storage_path,
                upload_status: upload.status,
                upload_trace_id: "trace-1",
                upload_created_at: upload.created_at ?? null
              },
              error: null
            };
          }
        };
      }
    };

    const repo = createSupabaseRepository(supabase as any);
    await expect(repo.claimExtractionJob(job.id)).resolves.toMatchObject({
      id: job.id,
      upload_id: upload.id,
      trace_id: "trace-1",
      attempt_id: "attempt-1",
      last_stage: "claim",
      provider_request_id: "resp_1",
      provider_latency_ms: 123,
      provider_usage: { input_tokens: 10 },
      status: "queued",
      claimed: true,
      upload: {
        id: upload.id,
        filename: upload.filename,
        content_type: upload.content_type,
        storage_path: upload.storage_path,
        trace_id: "trace-1"
      }
    });
    expect(calls).toEqual([{ name: "claim_extraction_job", input: { input_job_id: job.id } }]);
  });

  it("completes extraction jobs through the atomic rpc", async () => {
    const calls: unknown[] = [];
    const supabase = {
      rpc(name: string, input: unknown) {
        calls.push({ name, input });
        return {
          async single() {
            return {
              data: {
                status: "succeeded",
                candidates: 1,
                duplicate: false
              },
              error: null
            };
          }
        };
      }
    };

    const repo = createSupabaseRepository(supabase as any);
    await expect(
      repo.completeExtractionJob({
        jobId: job.id,
        status: "succeeded",
        pages: [],
        trip: {},
        bookings: [],
        warnings: [],
        provider: "n8n",
        model: "claude-haiku",
        errorMessage: null,
        rawResult: {}
      })
    ).resolves.toEqual({ status: "succeeded", candidates: 1, duplicate: false });
    expect(calls).toEqual([
      {
        name: "complete_extraction_job",
        input: expect.objectContaining({
          input_job_id: job.id,
          input_status: "succeeded",
          input_provider: "n8n"
        })
      }
    ]);
  });

  it("updates extraction job observability metadata", async () => {
    const calls: unknown[] = [];
    const supabase = {
      from(table: string) {
        return {
          update(input: unknown) {
            calls.push({ table, input });
            return {
              eq(column: string, value: string) {
                calls.push({ column, value });
                return { error: null };
              }
            };
          }
        };
      }
    };

    const repo = createSupabaseRepository(supabase as any);
    await repo.updateExtractionJobObservability(job.id, {
      traceId: "trace-1",
      attemptId: "attempt-1",
      lastStage: "openai_request",
      providerRequestId: "resp_123",
      providerLatencyMs: 1234,
      providerUsage: { input_tokens: 10, output_tokens: 20 }
    });

    expect(calls).toEqual([
      {
        table: "extraction_jobs",
        input: {
          trace_id: "trace-1",
          attempt_id: "attempt-1",
          last_stage: "openai_request",
          provider_request_id: "resp_123",
          provider_latency_ms: 1234,
          provider_usage: { input_tokens: 10, output_tokens: 20 }
        }
      },
      { column: "id", value: job.id }
    ]);
  });

  it("skips empty extraction job observability updates", async () => {
    const supabase = {
      from: vi.fn()
    };

    const repo = createSupabaseRepository(supabase as any);
    await repo.updateExtractionJobObservability(job.id, {});

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("records extraction job events in the durable ledger", async () => {
    const calls: unknown[] = [];
    const eventRow = {
      id: "event-1",
      trace_id: "trace-1",
      job_id: job.id,
      upload_id: upload.id,
      trip_id: trip.id,
      attempt_id: "attempt-1",
      event: "marco.extraction_job_claimed",
      stage: "claim",
      status: "processing",
      provider: "openai",
      model: "gpt-4.1-mini",
      duration_ms: 42,
      error_message: null,
      metadata: { claimed: true },
      created_at: "2026-06-16T00:00:00Z"
    };
    const supabase = {
      from(table: string) {
        return {
          insert(input: unknown) {
            calls.push({ table, input });
            return {
              select(columns: string) {
                calls.push({ columns });
                return {
                  async single() {
                    return { data: eventRow, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    const repo = createSupabaseRepository(supabase as any);
    await expect(
      repo.recordExtractionJobEvent({
        traceId: "trace-1",
        jobId: job.id,
        uploadId: upload.id,
        tripId: trip.id,
        attemptId: "attempt-1",
        event: "marco.extraction_job_claimed",
        stage: "claim",
        status: "processing",
        provider: "openai",
        model: "gpt-4.1-mini",
        durationMs: 42,
        metadata: { claimed: true }
      })
    ).resolves.toEqual(eventRow);

    expect(calls).toEqual([
      {
        table: "extraction_job_events",
        input: {
          trace_id: "trace-1",
          job_id: job.id,
          upload_id: upload.id,
          trip_id: trip.id,
          attempt_id: "attempt-1",
          event: "marco.extraction_job_claimed",
          stage: "claim",
          status: "processing",
          provider: "openai",
          model: "gpt-4.1-mini",
          duration_ms: 42,
          error_message: null,
          metadata: { claimed: true }
        }
      },
      { columns: "*" }
    ]);
  });
});

describe("extraction callback", () => {
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("rejects missing or invalid webhook secrets", () => {
    const previous = process.env.EXTRACTION_WEBHOOK_SECRET;
    process.env.EXTRACTION_WEBHOOK_SECRET = "secret";

    expect(() => requireExtractionWebhookAuth(new Request("https://example.com"))).toThrow("Invalid extraction webhook secret");
    expect(() =>
      requireExtractionWebhookAuth(
        new Request("https://example.com", {
          headers: { Authorization: "Bearer wrong" }
        })
      )
    ).toThrow("Invalid extraction webhook secret");

    process.env.EXTRACTION_WEBHOOK_SECRET = previous;
  });

  it("writes pages and candidates from a valid callback payload", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "succeeded", candidates: 1, duplicate: false })
    };

    await expect(
      completeExtraction(repo, {
        job_id: job.id,
        status: "succeeded",
        provider: "n8n",
        model: "claude-haiku",
        pages: [{ page_number: 1, text: "Hotel confirmation ABC123", extraction_confidence: 0.91 }],
        ...extractionResult({
          bookings: [
            {
              ...extractionResult().bookings[0],
              confidence: 0.6,
              source_pages: [1],
              source_snippets: ["Hotel confirmation ABC123"],
              extraction_method: "haiku"
            }
          ]
        })
      })
    ).resolves.toEqual({ status: "succeeded", candidates: 1 });

    expect(repo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        status: "succeeded",
        pages: [expect.objectContaining({ page_number: 1, text: "Hotel confirmation ABC123" })],
        bookings: [expect.objectContaining({ confidence: 0.6, extraction_method: "haiku" })]
      })
    );
    expect(consoleInfo).toHaveBeenCalledWith("marco.extraction_callback_completed", expect.objectContaining({ job_id: job.id, candidates: 1 }));
  });

  it("marks jobs and uploads failed when n8n reports extraction failure", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "failed", candidates: 0, duplicate: false })
    };

    await expect(
      completeExtraction(repo, {
        job_id: job.id,
        status: "failed",
        warnings: ["No extractable text"],
        error_message: "No extractable text"
      })
    ).resolves.toEqual({ status: "failed", candidates: 0 });

    expect(repo.completeExtractionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        status: "failed",
        errorMessage: "No extractable text",
        warnings: ["No extractable text"]
      })
    );
    expect(consoleWarn).toHaveBeenCalledWith("marco.extraction_callback_failed", expect.objectContaining({ job_id: job.id }));
  });

  it("returns the existing terminal state when a duplicate callback is ignored", async () => {
    const repo = {
      completeExtractionJob: vi.fn().mockResolvedValue({ status: "succeeded", candidates: 1, duplicate: true })
    };

    await expect(
      completeExtraction(repo, {
        job_id: job.id,
        status: "failed",
        warnings: ["late duplicate failure"],
        error_message: "late duplicate failure"
      })
    ).resolves.toEqual({ status: "succeeded", candidates: 1 });

    expect(repo.completeExtractionJob).toHaveBeenCalledOnce();
    expect(consoleInfo).toHaveBeenCalledWith(
      "marco.extraction_callback_duplicate_ignored",
      expect.objectContaining({ job_id: job.id, requested_status: "failed", current_status: "succeeded" })
    );
  });
});

describe("reviewCandidate", () => {
  it("maps a candidate into a booking and segment before accepting it", async () => {
    const source = candidate();
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getCandidate: vi.fn().mockResolvedValue(source),
      markCandidateStatus: vi.fn().mockResolvedValue(undefined),
      createBooking: vi.fn().mockResolvedValue({ id: "booking-1" }),
      createBookingSegment: vi.fn().mockResolvedValue(undefined)
    };

    expect(bookingInsertFromCandidate(source)).toEqual(expect.objectContaining({ vendor: source.title, status: "confirmed" }));
    await reviewCandidate(repo, source.id, "accept");

    expect(repo.createBooking).toHaveBeenCalledWith(expect.objectContaining({ title: source.title, source_upload_id: source.upload_id }));
    expect(repo.createBookingSegment).toHaveBeenCalledWith(expect.objectContaining({ booking_id: "booking-1", trip_id: trip.id }));
    expect(repo.markCandidateStatus).toHaveBeenCalledWith(source.id, "accepted");
  });

  it("accepts incomplete candidates without blocking on missing fields", async () => {
    const source = candidate({ starts_at: null, ends_at: null, missing_fields: ["starts_at", "ends_at"] });
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getCandidate: vi.fn().mockResolvedValue(source),
      markCandidateStatus: vi.fn().mockResolvedValue(undefined),
      createBooking: vi.fn().mockResolvedValue({ id: "booking-1" }),
      createBookingSegment: vi.fn().mockResolvedValue(undefined)
    };

    await expect(reviewCandidate(repo, source.id, "accept")).resolves.toEqual({ status: "accepted", booking: { id: "booking-1" } });
    expect(repo.createBooking).toHaveBeenCalledWith(expect.objectContaining({ missing_fields: ["starts_at", "ends_at"] }));
    expect(repo.markCandidateStatus).toHaveBeenCalledWith(source.id, "accepted");
  });

  it("rejects candidates without creating booking records", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getCandidate: vi.fn(),
      markCandidateStatus: vi.fn().mockResolvedValue(undefined),
      createBooking: vi.fn(),
      createBookingSegment: vi.fn()
    };

    await expect(reviewCandidate(repo, "candidate-1", "reject")).resolves.toEqual({ status: "rejected" });
    expect(repo.markCandidateStatus).toHaveBeenCalledWith("candidate-1", "rejected");
    expect(repo.getCandidate).not.toHaveBeenCalled();
    expect(repo.createBooking).not.toHaveBeenCalled();
    expect(repo.createBookingSegment).not.toHaveBeenCalled();
  });

  it("rejects unsupported candidate actions without mutation", async () => {
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getCandidate: vi.fn(),
      markCandidateStatus: vi.fn(),
      createBooking: vi.fn(),
      createBookingSegment: vi.fn()
    };

    await expect(reviewCandidate(repo, "candidate-1", "archive")).rejects.toThrow("Unsupported candidate action.");
    expect(repo.markCandidateStatus).not.toHaveBeenCalled();
    expect(repo.createBooking).not.toHaveBeenCalled();
  });
});

describe("review quality helpers", () => {
  it("categorizes confidence with spec thresholds", () => {
    expect(confidenceCategory(0.85)).toEqual({ label: "high", tone: "green" });
    expect(confidenceCategory(0.7)).toEqual({ label: "review", tone: "gold" });
    expect(confidenceCategory(0.69)).toEqual({ label: "low", tone: "red" });
  });

  it("caps source snippet previews", () => {
    expect(sourceSnippetPreview(["  Short source  "])).toBe("Short source");
    expect(sourceSnippetPreview(["x".repeat(230)])).toHaveLength(220);
    expect(sourceSnippetPreview(["", "   "])).toBeNull();
  });
});

describe("runTripScan", () => {
  it("replaces persisted scanner issues for the active trip", async () => {
    const bookings: Booking[] = [
      {
        id: "booking-1",
        trip_id: trip.id,
        type: "hotel",
        status: "confirmed",
        vendor: "A",
        title: "Hotel A",
        location: "Ostuni",
        confirmation_code: null,
        starts_at: "2026-06-27T15:00:00Z",
        ends_at: "2026-06-29T11:00:00Z",
        total_amount: 500,
        currency: "EUR",
        refundable: true,
        cancellation_deadline: null,
        traveler_names: [],
        source_upload_id: null,
        confidence: 1,
        missing_fields: [],
        notes: null
      }
    ];
    const repo = {
      requireUser: vi.fn().mockResolvedValue(user),
      getActiveTrip: vi.fn().mockResolvedValue(trip),
      getBookingsForTrip: vi.fn().mockResolvedValue(bookings),
      replaceTripIssues: vi.fn().mockResolvedValue(undefined)
    };

    await expect(runTripScan(repo)).resolves.toEqual({ issues: 0 });
    expect(repo.replaceTripIssues).toHaveBeenCalledWith(trip.id, []);
  });
});
