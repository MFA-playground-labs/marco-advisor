import type { Tables } from "@/lib/database.types";
import {
  createUploadStoragePath,
  fallbackTripName,
  validateUploadFile
} from "@/lib/domain/upload";
import { dispatchExtractionJob } from "@/lib/server/extraction-dispatch";
import { getExtractionModel, getExtractionProvider, getExtractionProviderConfigError } from "@/lib/server/extraction-provider";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";
import { WorkflowError, errorMessage } from "@/lib/server/errors";
import {
  createTraceContext,
  elapsedMs,
  logWorkflowEvent,
  recordExtractionEvent,
  safeErrorMessage
} from "@/lib/server/workflow-observability";
import type { UploadRecord } from "@/lib/types";

export type UploadEvidenceInput = {
  file: File;
  tripId?: string | null;
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
    | "getTripForOwner"
    | "createTrip"
    | "updateTrip"
    | "uploadFile"
    | "removeUploadedFile"
    | "createUploadRecord"
    | "createExtractionJob"
    | "markUploadStatus"
    | "markExtractionJob"
    | "recordExtractionJobEvent"
  >;
  dispatch?: typeof dispatchExtractionJob;
  observability?: {
    traceId?: string;
    interactionId?: string;
  };
};

export async function uploadEvidence(input: UploadEvidenceInput, deps: UploadEvidenceDeps) {
  const startedAt = Date.now();
  const traceContext = createTraceContext({
    traceId: deps.observability?.traceId,
    interactionId: deps.observability?.interactionId
  });
  const logContext = {
    content_type: input.file.type || "application/octet-stream",
    file_extension: fileExtension(input.file.name),
    size_bytes: input.file.size
  };
  const validationError = validateUploadFile(input.file);
  if (validationError) {
    logWorkflowEvent("marco.upload_validation_failed", traceContext, {
      ...logContext,
      reason: validationError,
      status: "failed",
      durationMs: elapsedMs(startedAt)
    });
    throw new WorkflowError(validationError, 400);
  }

  const repo = deps.repo;
  const dispatch = deps.dispatch ?? dispatchExtractionJob;
  const provider = getExtractionProvider();
  const model = getExtractionModel(provider);
  const configError = getExtractionProviderConfigError(provider);
  if (configError) {
    logWorkflowEvent("marco.upload_config_failed", traceContext, {
      ...logContext,
      provider,
      model,
      status: "failed",
      durationMs: elapsedMs(startedAt)
    });
    throw new WorkflowError(configError, 500);
  }
  const user = await repo.requireUser("uploading");
  let trip = input.tripId
    ? await repo.getTripForOwner(user.id, input.tripId)
    : await repo.getActiveTrip(user.id);

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
    const tripTraceContext = { ...traceContext, tripId: trip.id, userId: user.id };
    logWorkflowEvent("marco.upload_storage_completed", tripTraceContext, {
      ...logContext,
      durationMs: elapsedMs(startedAt)
    });
    stage = "upload_record";
    upload = await repo.createUploadRecord({
      owner_id: user.id,
      trip_id: trip.id,
      filename: input.file.name,
      content_type: input.file.type,
      storage_path: storagePath,
      status: "uploaded",
      trace_id: traceContext.traceId
    });
    const uploadTraceContext = { ...tripTraceContext, uploadId: upload.id };
    logWorkflowEvent("marco.upload_record_created", uploadTraceContext, {
      ...logContext,
      status: upload.status,
      durationMs: elapsedMs(startedAt)
    });
    stage = "extraction_job";
    job = await repo.createExtractionJob({
      upload_id: upload.id,
      trip_id: trip.id,
      status: "queued",
      provider,
      model,
      trace_id: traceContext.traceId
    });
    const jobTraceContext = {
      ...uploadTraceContext,
      jobId: job.id,
      provider: job.provider,
      model: job.model
    };
    logWorkflowEvent("marco.upload_extraction_job_created", jobTraceContext, {
      ...logContext,
      status: job.status,
      durationMs: elapsedMs(startedAt)
    });
    await recordExtractionEvent(repo, jobTraceContext, {
      event: "marco.upload_extraction_job_created",
      stage: "extraction_job",
      status: job.status,
      durationMs: elapsedMs(startedAt),
      metadata: {
        content_type: logContext.content_type,
        file_extension: logContext.file_extension,
        size_bytes: logContext.size_bytes
      }
    });
    migrationWarning = "migration_warning" in job ? String(job.migration_warning) : null;

    stage = "dispatch";
    const dispatched = await dispatch({ jobId: job.id, uploadId: upload.id, tripId: trip.id });
    if (!dispatched.ok && dispatched.warning) {
      const dispatchErrorMessage = safeErrorMessage(dispatched.warning);
      logWorkflowEvent("marco.upload_dispatch_failed", jobTraceContext, {
        ...logContext,
        dispatched: false,
        errorMessage: dispatchErrorMessage,
        durationMs: elapsedMs(startedAt)
      });
      await recordExtractionEvent(repo, jobTraceContext, {
        event: "marco.upload_dispatch_failed",
        stage: "dispatch",
        status: "queued",
        durationMs: elapsedMs(startedAt),
        errorMessage: dispatchErrorMessage,
        metadata: { dispatched: false }
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
      logWorkflowEvent("marco.upload_dispatch_completed", jobTraceContext, {
        ...logContext,
        dispatched: true,
        durationMs: elapsedMs(startedAt)
      });
      await recordExtractionEvent(repo, jobTraceContext, {
        event: "marco.upload_dispatch_completed",
        stage: "dispatch",
        status: "queued",
        durationMs: elapsedMs(startedAt),
        metadata: { dispatched: true }
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
    const failureContext = {
      ...traceContext,
      uploadId: upload?.id,
      jobId: job?.id,
      tripId: trip.id,
      userId: user.id,
      provider: job?.provider,
      model: job?.model
    };
    const workflowErrorMessage = safeErrorMessage(message);
    logWorkflowEvent("marco.upload_workflow_failed", failureContext, {
      ...logContext,
      stage,
      status: "failed",
      errorMessage: workflowErrorMessage,
      durationMs: elapsedMs(startedAt)
    });
    await recordExtractionEvent(repo, failureContext, {
      event: "marco.upload_workflow_failed",
      stage,
      status: "failed",
      durationMs: elapsedMs(startedAt),
      errorMessage: workflowErrorMessage
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

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? extension.toLowerCase().slice(0, 16) : "";
}
