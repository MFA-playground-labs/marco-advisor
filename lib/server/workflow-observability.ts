import { randomUUID } from "node:crypto";
import type { Json } from "@/lib/database.types";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";

export type TraceContext = {
  traceId: string;
  interactionId?: string;
  uploadId?: string | null;
  jobId?: string | null;
  tripId?: string | null;
  userId?: string | null;
  attemptId?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type WorkflowLogFields = {
  uploadId?: string | null;
  jobId?: string | null;
  tripId?: string | null;
  userId?: string | null;
  attemptId?: string | null;
  provider?: string | null;
  model?: string | null;
  stage?: string | null;
  status?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RecordExtractionEventInput = {
  event: string;
  stage?: string | null;
  status?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  metadata?: Json;
};

export type ExtractionEventRepo = Pick<SupabaseRepository, "recordExtractionJobEvent">;

const maxTraceIdLength = 120;
const maxErrorMessageLength = 240;

export function createTraceContext(input: Partial<TraceContext> = {}): TraceContext {
  const traceId = normalizeTraceId(input.traceId ?? input.interactionId) ?? randomUUID();
  return {
    ...input,
    traceId,
    interactionId: input.interactionId ?? traceId
  };
}

export function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export function safeErrorMessage(error: unknown, fallback = "Workflow failed.") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  return message.slice(0, maxErrorMessageLength);
}

export function logWorkflowEvent(event: string, context: TraceContext, fields: WorkflowLogFields = {}) {
  const payload = logPayload(context, fields);
  const level = fields.errorMessage || fields.status === "failed" ? "warn" : "info";

  if (level === "warn") {
    console.warn(event, payload);
  } else {
    console.info(event, payload);
  }
}

export async function recordExtractionEvent(
  repo: ExtractionEventRepo | undefined,
  context: TraceContext,
  input: RecordExtractionEventInput
) {
  if (!repo || !context.tripId) return;

  try {
    await repo.recordExtractionJobEvent({
      traceId: context.traceId,
      tripId: context.tripId,
      uploadId: context.uploadId ?? null,
      jobId: context.jobId ?? null,
      attemptId: context.attemptId ?? null,
      event: input.event,
      stage: input.stage ?? null,
      status: input.status ?? null,
      provider: context.provider ?? null,
      model: context.model ?? null,
      durationMs: input.durationMs ?? null,
      errorMessage: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    console.warn("marco.extraction_event_record_failed", {
      trace_id: context.traceId,
      interaction_id: context.interactionId,
      upload_id: context.uploadId,
      job_id: context.jobId,
      trip_id: context.tripId,
      event: input.event,
      error_message: safeErrorMessage(error)
    });
  }
}

function logPayload(context: TraceContext, fields: WorkflowLogFields) {
  const {
    uploadId,
    jobId,
    tripId,
    userId,
    attemptId,
    provider,
    model,
    durationMs,
    errorMessage,
    metadata,
    ...rest
  } = fields;

  return {
    trace_id: context.traceId,
    interaction_id: context.interactionId,
    upload_id: uploadId ?? context.uploadId,
    job_id: jobId ?? context.jobId,
    trip_id: tripId ?? context.tripId,
    user_id: userId ?? context.userId,
    attempt_id: attemptId ?? context.attemptId,
    provider: provider ?? context.provider,
    model: model ?? context.model,
    duration_ms: durationMs,
    error_message: errorMessage,
    metadata,
    ...rest
  };
}

function normalizeTraceId(value: string | null | undefined) {
  const traceId = value?.trim();
  if (!traceId) return null;
  return traceId.slice(0, maxTraceIdLength);
}
