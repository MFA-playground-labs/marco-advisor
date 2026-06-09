import type { Tables } from "@/lib/database.types";
import {
  createUploadStoragePath,
  fallbackTripName,
  validateUploadFile
} from "@/lib/domain/upload";
import { dispatchExtractionJob } from "@/lib/server/extraction-dispatch";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";
import { WorkflowError, errorMessage } from "@/lib/server/errors";
import type { UploadRecord } from "@/lib/types";

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
  >;
  dispatch?: typeof dispatchExtractionJob;
};

export async function uploadEvidence(input: UploadEvidenceInput, deps: UploadEvidenceDeps) {
  const validationError = validateUploadFile(input.file);
  if (validationError) throw new WorkflowError(validationError, 400);

  const repo = deps.repo;
  const dispatch = deps.dispatch ?? dispatchExtractionJob;
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
      status: "uploaded"
    });
    job = await repo.createExtractionJob({
      upload_id: upload.id,
      trip_id: trip.id,
      status: "queued",
      provider: process.env.EXTRACTION_PROVIDER ?? "n8n",
      model: process.env.EXTRACTION_FALLBACK_MODEL ?? "claude-haiku"
    });

    const dispatched = await dispatch({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
    if (!dispatched.ok && dispatched.warning) {
      await repo.markExtractionJob(job.id, {
        error_message: dispatched.warning,
        warnings: [dispatched.warning]
      });
    }

    return { upload, job, dispatched: dispatched.ok };
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

async function settle(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // Preserve the original workflow failure; cleanup errors are secondary.
  }
}
