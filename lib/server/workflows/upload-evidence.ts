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
  observability?: {
    interactionId?: string;
  };
};

export async function uploadEvidence(input: UploadEvidenceInput, deps: UploadEvidenceDeps) {
  const startedAt = Date.now();
  const logContext = {
    interaction_id: deps.observability?.interactionId,
    content_type: input.file.type || "application/octet-stream",
    file_extension: fileExtension(input.file.name),
    size_bytes: input.file.size
  };
  const validationError = validateUploadFile(input.file);
  if (validationError) {
    console.warn("marco.upload_validation_failed", {
      ...logContext,
      reason: validationError,
      duration_ms: elapsedMs(startedAt)
    });
    throw new WorkflowError(validationError, 400);
  }

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
  let migrationWarning: string | null = null;
  let stage = "storage";

  try {
    await repo.uploadFile(storagePath, input.file, input.file.type);
    console.info("marco.upload_storage_completed", {
      ...logContext,
      trip_id: trip.id,
      duration_ms: elapsedMs(startedAt)
    });
    stage = "upload_record";
    upload = await repo.createUploadRecord({
      owner_id: user.id,
      trip_id: trip.id,
      filename: input.file.name,
      content_type: input.file.type,
      storage_path: storagePath,
      status: "uploaded"
    });
    console.info("marco.upload_record_created", {
      ...logContext,
      upload_id: upload.id,
      trip_id: trip.id,
      status: upload.status,
      duration_ms: elapsedMs(startedAt)
    });
    stage = "extraction_job";
    job = await repo.createExtractionJob({
      upload_id: upload.id,
      trip_id: trip.id,
      status: "queued",
      provider: process.env.EXTRACTION_PROVIDER ?? "n8n",
      model: process.env.EXTRACTION_FALLBACK_MODEL ?? "claude-haiku"
    });
    console.info("marco.upload_extraction_job_created", {
      ...logContext,
      upload_id: upload.id,
      job_id: job.id,
      trip_id: trip.id,
      status: job.status,
      duration_ms: elapsedMs(startedAt)
    });
    migrationWarning = "migration_warning" in job ? String(job.migration_warning) : null;

    stage = "dispatch";
    const dispatched = await dispatch({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
    if (!dispatched.ok && dispatched.warning) {
      console.warn("marco.upload_dispatch_failed", {
        ...logContext,
        upload_id: upload.id,
        job_id: job.id,
        trip_id: trip.id,
        dispatched: false,
        error_message: truncateErrorMessage(dispatched.warning),
        duration_ms: elapsedMs(startedAt)
      });
      await repo.markExtractionJob(
        job.id,
        migrationWarning
          ? { error_message: dispatched.warning }
          : {
              error_message: dispatched.warning,
              warnings: [dispatched.warning]
            }
      );
    } else {
      console.info("marco.upload_dispatch_completed", {
        ...logContext,
        upload_id: upload.id,
        job_id: job.id,
        trip_id: trip.id,
        dispatched: true,
        duration_ms: elapsedMs(startedAt)
      });
    }

    return {
      upload,
      job,
      dispatched: dispatched.ok,
      ...(migrationWarning ? { warning: migrationWarning } : {})
    };
  } catch (error) {
    const message = errorMessage(error, "Extraction failed.");
    console.warn("marco.upload_workflow_failed", {
      ...logContext,
      upload_id: upload?.id,
      job_id: job?.id,
      trip_id: trip.id,
      stage,
      error_message: truncateErrorMessage(message),
      duration_ms: elapsedMs(startedAt)
    });
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

function elapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? extension.toLowerCase().slice(0, 16) : "";
}

function truncateErrorMessage(message: string) {
  return message.slice(0, 240);
}
