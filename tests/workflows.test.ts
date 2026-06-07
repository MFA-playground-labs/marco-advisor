import { describe, expect, it, vi } from "vitest";
import type { ExtractionResult } from "@/lib/extraction-schema";
import { bookingInsertFromCandidate } from "@/lib/domain/booking-mapping";
import { validateUploadFile } from "@/lib/domain/upload";
import type { UploadEvidenceDeps } from "@/lib/server/workflows/upload-evidence";
import { uploadEvidence } from "@/lib/server/workflows/upload-evidence";
import { reviewCandidate } from "@/lib/server/workflows/review-candidate";
import { runTripScan } from "@/lib/server/workflows/run-trip-scan";
import type { Booking, ExtractedBookingCandidate, Trip, UploadRecord } from "@/lib/types";

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
  status: "extracting"
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
    createExtractionJob: vi.fn().mockResolvedValue({ id: "job-1", upload_id: upload.id, trip_id: trip.id, status: "processing" }),
    markUploadStatus: vi.fn().mockResolvedValue(undefined),
    markExtractionJob: vi.fn().mockResolvedValue(undefined),
    upsertTravelers: vi.fn().mockResolvedValue(undefined),
    createCandidates: vi.fn().mockResolvedValue(undefined),
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
  it("persists extracted candidates and marks upload/job succeeded", async () => {
    const repo = uploadRepo();
    const extract = vi.fn().mockResolvedValue(extractionResult());

    await expect(
      uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, extract })
    ).resolves.toEqual({ upload, candidates: 1 });

    expect(repo.uploadFile).toHaveBeenCalledOnce();
    expect(repo.createCandidates).toHaveBeenCalledWith([
      expect.objectContaining({ status: "needs_review", title: "Masseria Il Frantoio" })
    ]);
    expect(repo.markUploadStatus).toHaveBeenCalledWith(upload.id, "review_ready");
    expect(repo.markExtractionJob).toHaveBeenCalledWith("job-1", expect.objectContaining({ status: "succeeded" }));
  });

  it("marks upload and extraction job failed when extraction fails", async () => {
    const repo = uploadRepo();
    const extract = vi.fn().mockRejectedValue(new Error("OPENAI_API_KEY is required for extraction."));

    await expect(
      uploadEvidence({ file: textFile(), tripName: "Italy", destination: "Italy", startsOn: "", endsOn: "" }, { repo, extract })
    ).rejects.toThrow("OPENAI_API_KEY is required for extraction.");

    expect(repo.markUploadStatus).toHaveBeenCalledWith(upload.id, "failed");
    expect(repo.markExtractionJob).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "failed", error_message: "OPENAI_API_KEY is required for extraction." })
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
