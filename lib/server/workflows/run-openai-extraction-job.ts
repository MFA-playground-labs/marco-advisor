import { randomUUID } from "node:crypto";
import type { Json } from "@/lib/database.types";
import { extractBookingsFromUpload } from "@/lib/openai-extract";
import { createSupabaseRepository, type SupabaseRepository } from "@/lib/server/supabase-repository";
import {
  createTraceContext,
  elapsedMs,
  logWorkflowEvent,
  recordExtractionEvent,
  safeErrorMessage,
  type TraceContext
} from "@/lib/server/workflow-observability";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { ClaimedExtractionJob } from "@/lib/server/supabase-repository";

const provider = "openai";
const defaultModel = "gpt-4.1-mini";
const defaultMaxTextChars = 25000;
const defaultMaxEncodedBytes = 20 * 1024 * 1024;

type RunOpenAiExtractionJobInput = {
  jobId: string;
};

type PreparedOpenAiInput = {
  input: {
    filename: string;
    contentType: string;
    imageDataUrl?: string;
    fileData?: string;
    text?: string;
  };
  pages: Array<{ page_number: number; text: string; extraction_confidence: number | null }>;
  warnings: string[];
  metadata: {
    input_kind: "image" | "pdf" | "text";
    encoded_bytes?: number;
    text_chars?: number;
    clipped?: boolean;
  };
};

export async function runOpenAiExtractionJob(input: RunOpenAiExtractionJobInput) {
  const model = process.env.OPENAI_EXTRACTION_MODEL ?? defaultModel;
  const runStartedAt = Date.now();
  let stage = "admin_client";
  let context = createTraceContext({ jobId: input.jobId, provider, model });
  let repo: SupabaseRepository | null = null;
  let claimedJob: ClaimedExtractionJob | null = null;

  logWorkflowEvent("marco.extraction_worker_started", context, { stage, status: "started" });

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new Error("Supabase admin client is not configured.");
    }

    repo = createSupabaseRepository(supabase as any);

    stage = "claim";
    claimedJob = await repo.claimExtractionJob(input.jobId);
    context = createTraceContext({
      traceId: claimedJob.trace_id ?? claimedJob.upload.trace_id ?? undefined,
      uploadId: claimedJob.upload_id,
      jobId: claimedJob.id,
      tripId: claimedJob.trip_id,
      userId: claimedJob.upload.owner_id,
      provider,
      model
    });

    if (!claimedJob.claimed) {
      logWorkflowEvent("marco.extraction_job_claim_skipped", context, {
        stage,
        status: claimedJob.status,
        metadata: { current_status: claimedJob.status }
      });
      await recordExtractionEvent(repo, context, {
        event: "marco.extraction_job_claim_skipped",
        stage,
        status: claimedJob.status,
        metadata: { current_status: claimedJob.status }
      });
      return { status: "skipped" as const, jobId: claimedJob.id, claimed: false };
    }

    const hydratedJob = await repo.getExtractionJobWithUpload(claimedJob.id);
    const attemptId = randomUUID();
    context = createTraceContext({
      traceId: hydratedJob.trace_id ?? hydratedJob.upload.trace_id ?? context.traceId,
      uploadId: hydratedJob.upload_id,
      jobId: hydratedJob.id,
      tripId: hydratedJob.trip_id,
      userId: hydratedJob.upload.owner_id,
      attemptId,
      provider,
      model
    });

    await repo.updateExtractionJobObservability(hydratedJob.id, {
      traceId: context.traceId,
      attemptId,
      lastStage: stage
    });

    logWorkflowEvent("marco.extraction_job_claimed", context, { stage, status: "processing" });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_job_claimed",
      stage,
      status: "processing",
      metadata: { upload_status: hydratedJob.upload.status }
    });

    stage = "download";
    await updateStage(repo, context, stage);
    const downloadStartedAt = Date.now();
    const blob = await repo.downloadUploadedFile(hydratedJob.upload.storage_path);
    const fileBytes = Buffer.from(await blob.arrayBuffer());
    logWorkflowEvent("marco.extraction_upload_download_completed", context, {
      stage,
      status: "completed",
      durationMs: elapsedMs(downloadStartedAt),
      metadata: { content_type: hydratedJob.upload.content_type, bytes: fileBytes.byteLength }
    });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_upload_download_completed",
      stage,
      status: "completed",
      durationMs: elapsedMs(downloadStartedAt),
      metadata: { content_type: hydratedJob.upload.content_type, bytes: fileBytes.byteLength }
    });

    stage = "prepare_input";
    await updateStage(repo, context, stage);
    const prepared = prepareOpenAiInput({
      bytes: fileBytes,
      filename: hydratedJob.upload.filename,
      contentType: hydratedJob.upload.content_type
    });
    logWorkflowEvent("marco.extraction_input_prepared", context, {
      stage,
      status: "completed",
      metadata: prepared.metadata
    });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_input_prepared",
      stage,
      status: "completed",
      metadata: prepared.metadata
    });

    stage = "openai_request";
    await updateStage(repo, context, stage);
    logWorkflowEvent("marco.extraction_openai_request_started", context, {
      stage,
      status: "started",
      metadata: { input_kind: prepared.metadata.input_kind }
    });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_openai_request_started",
      stage,
      status: "started",
      metadata: { input_kind: prepared.metadata.input_kind }
    });

    const openAiStartedAt = Date.now();
    const extraction = await extractBookingsFromUpload(prepared.input);
    const openAiDurationMs = elapsedMs(openAiStartedAt);
    context = { ...context, model: extraction.provider.model };

    await repo.updateExtractionJobObservability(hydratedJob.id, {
      lastStage: stage,
      providerRequestId: extraction.provider.responseId,
      providerLatencyMs: openAiDurationMs,
      providerUsage: extraction.provider.usage
    });

    logWorkflowEvent("marco.extraction_openai_request_completed", context, {
      stage,
      status: "completed",
      durationMs: openAiDurationMs,
      metadata: {
        provider_request_id: extraction.provider.responseId,
        bookings: extraction.result.bookings.length,
        warnings: extraction.result.warnings.length
      }
    });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_openai_request_completed",
      stage,
      status: "completed",
      durationMs: openAiDurationMs,
      metadata: {
        provider_request_id: extraction.provider.responseId,
        bookings: extraction.result.bookings.length,
        warnings: extraction.result.warnings.length
      }
    });

    stage = "complete";
    await updateStage(repo, context, stage);
    const warnings = [...prepared.warnings, ...extraction.result.warnings];
    const completion = await repo.completeExtractionJob({
      jobId: hydratedJob.id,
      status: "succeeded",
      pages: toJsonValue(prepared.pages),
      trip: toJsonValue({
        name: null,
        destination: null,
        starts_on: null,
        ends_on: null,
        travelers: extraction.result.trip.travelers
      }),
      bookings: toJsonValue(extraction.result.bookings),
      warnings,
      provider,
      model: extraction.provider.model,
      errorMessage: null,
      rawResult: toJsonValue({
        ...asJsonObject(extraction.provider.rawResult),
        input: prepared.metadata,
        warnings: warnings.length,
        bookings: extraction.result.bookings.length
      })
    });

    await updateFinalObservability(repo, context, {
      providerRequestId: extraction.provider.responseId,
      providerLatencyMs: openAiDurationMs,
      providerUsage: extraction.provider.usage
    });

    logWorkflowEvent("marco.extraction_job_completed", context, {
      stage: "completed",
      status: completion.status,
      durationMs: elapsedMs(runStartedAt),
      metadata: { candidates: completion.candidates, duplicate: completion.duplicate, warnings: warnings.length }
    });
    await recordExtractionEvent(repo, context, {
      event: "marco.extraction_job_completed",
      stage: "completed",
      status: completion.status,
      durationMs: elapsedMs(runStartedAt),
      metadata: { candidates: completion.candidates, duplicate: completion.duplicate, warnings: warnings.length }
    });

    return {
      status: completion.status,
      jobId: hydratedJob.id,
      claimed: true,
      candidates: completion.candidates,
      duplicate: completion.duplicate
    };
  } catch (error) {
    const message = safeErrorMessage(error, "OpenAI extraction failed.");
    logWorkflowEvent("marco.extraction_job_failed", context, {
      stage,
      status: "failed",
      durationMs: elapsedMs(runStartedAt),
      errorMessage: message
    });

    if (repo && claimedJob?.claimed) {
      try {
        await markClaimedJobFailed(repo, context, {
          jobId: claimedJob.id,
          stage,
          message,
          model
        });
      } catch (completionError) {
        logWorkflowEvent("marco.extraction_job_failed_completion_failed", context, {
          stage,
          status: "failed",
          errorMessage: safeErrorMessage(completionError)
        });
      }
    }

    if (repo) {
      await recordExtractionEvent(repo, context, {
        event: "marco.extraction_job_failed",
        stage,
        status: "failed",
        durationMs: elapsedMs(runStartedAt),
        errorMessage: message
      });
    }

    return {
      status: "failed" as const,
      jobId: input.jobId,
      claimed: Boolean(claimedJob?.claimed),
      errorMessage: message,
      stage
    };
  }
}

function prepareOpenAiInput(input: {
  bytes: Buffer;
  filename: string;
  contentType: string;
}): PreparedOpenAiInput {
  const contentType = normalizeContentType(input.contentType);
  const warnings: string[] = [];

  if (contentType.startsWith("image/")) {
    const imageDataUrl = dataUrl(contentType, input.bytes);
    assertMaxEncodedBytes(imageDataUrl, "image data URL");
    return {
      input: {
        filename: input.filename,
        contentType,
        imageDataUrl
      },
      pages: [syntheticPage(input.filename, contentType)],
      warnings,
      metadata: {
        input_kind: "image",
        encoded_bytes: Buffer.byteLength(imageDataUrl, "utf8")
      }
    };
  }

  if (contentType === "application/pdf") {
    const fileData = dataUrl(contentType, input.bytes);
    assertMaxEncodedBytes(fileData, "PDF file data");
    return {
      input: {
        filename: input.filename,
        contentType,
        fileData
      },
      pages: [syntheticPage(input.filename, contentType)],
      warnings,
      metadata: {
        input_kind: "pdf",
        encoded_bytes: Buffer.byteLength(fileData, "utf8")
      }
    };
  }

  if (contentType === "text/plain" || contentType === "text/html") {
    const decoded = new TextDecoder("utf-8").decode(input.bytes);
    const maxTextChars = envNumber("EXTRACTION_MAX_TEXT_CHARS", defaultMaxTextChars);
    const clipped = decoded.length > maxTextChars;
    const text = clipped ? decoded.slice(0, maxTextChars) : decoded;
    if (clipped) {
      warnings.push(`Input text was clipped to ${maxTextChars} characters before OpenAI extraction.`);
    }
    return {
      input: {
        filename: input.filename,
        contentType,
        text
      },
      pages: [{ page_number: 1, text, extraction_confidence: null }],
      warnings,
      metadata: {
        input_kind: "text",
        text_chars: text.length,
        clipped
      }
    };
  }

  throw new Error(`Unsupported extraction content type: ${contentType}`);
}

async function updateStage(repo: SupabaseRepository, context: TraceContext, stage: string) {
  await repo.updateExtractionJobObservability(context.jobId!, {
    traceId: context.traceId,
    attemptId: context.attemptId,
    lastStage: stage
  });
}

async function markClaimedJobFailed(
  repo: SupabaseRepository,
  context: TraceContext,
  input: { jobId: string; stage: string; message: string; model: string }
) {
  try {
    await repo.updateExtractionJobObservability(input.jobId, {
      traceId: context.traceId,
      attemptId: context.attemptId,
      lastStage: input.stage
    });
  } catch (error) {
    logWorkflowEvent("marco.extraction_observability_update_failed", context, {
      stage: input.stage,
      status: "failed",
      errorMessage: safeErrorMessage(error)
    });
  }
  await repo.completeExtractionJob({
    jobId: input.jobId,
    status: "failed",
    pages: [],
    trip: {},
    bookings: [],
    warnings: [input.message],
    provider,
    model: context.model ?? input.model,
    errorMessage: input.message,
    rawResult: toJsonValue({
      stage: input.stage,
      error_message: input.message
    })
  });
}

async function updateFinalObservability(
  repo: SupabaseRepository,
  context: TraceContext,
  input: { providerRequestId: string | null; providerLatencyMs: number; providerUsage: Json }
) {
  try {
    await repo.updateExtractionJobObservability(context.jobId!, {
      traceId: context.traceId,
      attemptId: context.attemptId,
      lastStage: "completed",
      providerRequestId: input.providerRequestId,
      providerLatencyMs: input.providerLatencyMs,
      providerUsage: input.providerUsage
    });
  } catch (error) {
    logWorkflowEvent("marco.extraction_observability_update_failed", context, {
      stage: "completed",
      status: "failed",
      errorMessage: safeErrorMessage(error)
    });
  }
}

function dataUrl(contentType: string, bytes: Buffer) {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function assertMaxEncodedBytes(value: string, label: string) {
  const maxEncodedBytes = envNumber("OPENAI_EXTRACTION_MAX_ENCODED_BYTES", defaultMaxEncodedBytes);
  const encodedBytes = Buffer.byteLength(value, "utf8");
  if (encodedBytes > maxEncodedBytes) {
    throw new Error(`${label} is too large for OpenAI extraction (${encodedBytes} bytes encoded, max ${maxEncodedBytes}).`);
  }
}

function syntheticPage(filename: string, contentType: string) {
  return {
    page_number: 1,
    text: `OpenAI processed ${contentType} upload "${filename}". Source snippets are stored on extracted candidates when available.`,
    extraction_confidence: null
  };
}

function normalizeContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function toJsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function asJsonObject(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
