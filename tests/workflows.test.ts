import { describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "@/lib/extraction-schema";
import { bookingInsertFromCandidate } from "@/lib/domain/booking-mapping";
import { validateUploadFile } from "@/lib/domain/upload";
import { requireExtractionWebhookAuth } from "@/lib/server/extraction-auth";
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
    expect(repo.createExtractionJob).toHaveBeenCalledWith(expect.objectContaining({ status: "queued", provider: "n8n", model: "claude-haiku" }));
    expect(dispatch).toHaveBeenCalledWith({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
  });

  it("keeps the upload queued and records a warning when n8n dispatch fails", async () => {
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
});

describe("extraction callback", () => {
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
      getExtractionJobWithUpload: vi.fn().mockResolvedValue({ ...job, upload }),
      replaceUploadPages: vi.fn().mockResolvedValue(undefined),
      updateTrip: vi.fn().mockResolvedValue(undefined),
      upsertTravelers: vi.fn().mockResolvedValue(undefined),
      createCandidates: vi.fn().mockResolvedValue(undefined),
      markUploadStatus: vi.fn().mockResolvedValue(undefined),
      markExtractionJob: vi.fn().mockResolvedValue(undefined)
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

    expect(repo.replaceUploadPages).toHaveBeenCalledWith([
      expect.objectContaining({ job_id: job.id, page_number: 1, char_count: 25 })
    ]);
    expect(repo.createCandidates).toHaveBeenCalledWith([
      expect.objectContaining({ status: "needs_review", source_job_id: job.id, confidence: 0.6, extraction_method: "haiku" })
    ]);
    expect(repo.markUploadStatus).toHaveBeenCalledWith(upload.id, "review_ready");
  });

  it("marks jobs and uploads failed when n8n reports extraction failure", async () => {
    const repo = {
      getExtractionJobWithUpload: vi.fn().mockResolvedValue({ ...job, upload }),
      replaceUploadPages: vi.fn().mockResolvedValue(undefined),
      updateTrip: vi.fn().mockResolvedValue(undefined),
      upsertTravelers: vi.fn().mockResolvedValue(undefined),
      createCandidates: vi.fn().mockResolvedValue(undefined),
      markUploadStatus: vi.fn().mockResolvedValue(undefined),
      markExtractionJob: vi.fn().mockResolvedValue(undefined)
    };

    await expect(
      completeExtraction(repo, {
        job_id: job.id,
        status: "failed",
        warnings: ["No extractable text"],
        error_message: "No extractable text"
      })
    ).resolves.toEqual({ status: "failed", candidates: 0 });

    expect(repo.markUploadStatus).toHaveBeenCalledWith(upload.id, "failed");
    expect(repo.markExtractionJob).toHaveBeenCalledWith(job.id, expect.objectContaining({ status: "failed", error_message: "No extractable text" }));
    expect(repo.createCandidates).not.toHaveBeenCalled();
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
