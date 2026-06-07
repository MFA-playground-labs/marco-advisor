import type { Tables, TablesInsert } from "@/lib/database.types";
import {
  createUploadStoragePath,
  fallbackTripName,
  validateUploadFile
} from "@/lib/domain/upload";
import type { ExtractionResult } from "@/lib/extraction-schema";
import { extractBookingsFromUpload } from "@/lib/openai-extract";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";
import { WorkflowError, errorMessage } from "@/lib/server/errors";
import type { Trip, UploadRecord } from "@/lib/types";

export type UploadEvidenceInput = {
  file: File;
  tripName: string;
  destination: string;
  startsOn: string;
  endsOn: string;
};

export type UploadEvidenceDeps = {
  repo: Pick<
    SupabaseRepository,
    | "requireUser"
    | "getActiveTrip"
    | "createTrip"
    | "updateTrip"
    | "uploadFile"
    | "removeUploadedFile"
    | "createUploadRecord"
    | "createExtractionJob"
    | "markUploadStatus"
    | "markExtractionJob"
    | "upsertTravelers"
    | "createCandidates"
  >;
  extract?: typeof extractBookingsFromUpload;
};

export async function uploadEvidence(input: UploadEvidenceInput, deps: UploadEvidenceDeps) {
  const validationError = validateUploadFile(input.file);
  if (validationError) throw new WorkflowError(validationError, 400);

  const repo = deps.repo;
  const extract = deps.extract ?? extractBookingsFromUpload;
  const user = await repo.requireUser("uploading");
  let trip = await repo.getActiveTrip(user.id);

  if (!trip) {
    trip = await repo.createTrip({
      owner_id: user.id,
      name: input.tripName || fallbackTripName(input.file.name),
      destination: input.destination || null,
      starts_on: input.startsOn || null,
      ends_on: input.endsOn || null
    });
  }

  let storagePath: string | null = createUploadStoragePath(user.id, input.file.name);
  let upload: UploadRecord | null = null;
  let job: Tables<"extraction_jobs"> | null = null;

  try {
    await repo.uploadFile(storagePath, input.file, input.file.type);
    upload = await repo.createUploadRecord({
      owner_id: user.id,
      trip_id: trip.id,
      filename: input.file.name,
      content_type: input.file.type,
      storage_path: storagePath,
      status: "extracting"
    });
    job = await repo.createExtractionJob({ upload_id: upload.id, trip_id: trip.id, status: "processing" });

    const extraction = await extractFromFile(input.file, extract);
    await persistExtraction(repo, {
      extraction,
      trip,
      upload,
      ownerId: user.id,
      formTripName: input.tripName,
      formDestination: input.destination,
      formStartsOn: input.startsOn,
      formEndsOn: input.endsOn
    });

    await repo.markUploadStatus(upload.id, "review_ready");
    await repo.markExtractionJob(job.id, { status: "succeeded", completed_at: new Date().toISOString() });

    return { upload, candidates: extraction.bookings.length };
  } catch (error) {
    const message = errorMessage(error, "Extraction failed.");
    if (upload) {
      const uploadId = upload.id;
      await settle(() => repo.markUploadStatus(uploadId, "failed"));
    }
    if (job) {
      const jobId = job.id;
      await settle(() =>
        repo.markExtractionJob(jobId, {
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString()
        })
      );
    } else if (storagePath) {
      await settle(() => repo.removeUploadedFile(storagePath!));
      storagePath = null;
    }
    throw error instanceof Error ? error : new WorkflowError(message, 500);
  }
}

async function extractFromFile(file: File, extract: typeof extractBookingsFromUpload) {
  const text = file.type.startsWith("text/") ? await file.text() : undefined;
  const dataUrl = text ? undefined : `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;

  return extract({
    filename: file.name,
    contentType: file.type,
    text,
    imageDataUrl: file.type.startsWith("image/") ? dataUrl : undefined,
    fileData: !file.type.startsWith("image/") ? dataUrl : undefined
  });
}

async function persistExtraction(
  repo: UploadEvidenceDeps["repo"],
  input: {
    extraction: ExtractionResult;
    trip: Trip;
    upload: UploadRecord;
    ownerId: string;
    formTripName: string;
    formDestination: string;
    formStartsOn: string;
    formEndsOn: string;
  }
) {
  const { extraction, trip } = input;

  if (extraction.trip.name || extraction.trip.destination || extraction.trip.starts_on || extraction.trip.ends_on) {
    await repo.updateTrip(trip.id, {
      name: input.formTripName || trip.name || extraction.trip.name || fallbackTripName(input.upload.filename),
      destination: input.formDestination || trip.destination || extraction.trip.destination,
      starts_on: input.formStartsOn || trip.starts_on || extraction.trip.starts_on,
      ends_on: input.formEndsOn || trip.ends_on || extraction.trip.ends_on
    });
  }

  await repo.upsertTravelers(trip.id, input.ownerId, extraction.trip.travelers);
  await repo.createCandidates(
    extraction.bookings.map((booking) => ({
      upload_id: input.upload.id,
      trip_id: trip.id,
      status: "needs_review",
      booking_type: booking.booking_type,
      title: booking.title,
      vendor: booking.vendor,
      location: booking.location,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      total_amount: booking.total_amount,
      currency: booking.currency,
      refundable: booking.refundable,
      cancellation_deadline: booking.cancellation_deadline,
      traveler_names: booking.traveler_names,
      confirmation_code: booking.confirmation_code,
      confidence: booking.confidence,
      missing_fields: booking.missing_fields,
      raw_json: booking as TablesInsert<"extracted_booking_candidates">["raw_json"]
    }))
  );
}

async function settle(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // Preserve the original workflow failure; cleanup errors are secondary.
  }
}
