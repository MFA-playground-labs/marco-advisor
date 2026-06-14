import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { extractedBookingSchema, extractionResultSchema } from "@/lib/extraction-schema";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";

const uploadPageSchema = z.object({
  page_number: z.number().int().positive(),
  text: z.string(),
  extraction_confidence: z.number().min(0).max(1).nullable().default(null)
});

export const extractionCallbackSchema = z.object({
  job_id: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  pages: z.array(uploadPageSchema).default([]),
  trip: extractionResultSchema.shape.trip.default({
    name: null,
    destination: null,
    starts_on: null,
    ends_on: null,
    travelers: []
  }),
  bookings: z.array(extractedBookingSchema).default([]),
  warnings: z.array(z.string()).default([]),
  provider: z.string().default("n8n"),
  model: z.string().nullable().default(null),
  error_message: z.string().nullable().default(null),
  raw_result: z.unknown().optional()
});

export type ExtractionCallbackPayload = z.infer<typeof extractionCallbackSchema>;

export type CompleteExtractionDeps = Pick<
  SupabaseRepository,
  "completeExtractionJob"
>;

export async function completeExtraction(repo: CompleteExtractionDeps, payload: unknown) {
  const parsed = extractionCallbackSchema.parse(payload);

  const result = await repo.completeExtractionJob({
    jobId: parsed.job_id,
    status: parsed.status,
    pages: toJsonValue(parsed.pages),
    trip: toJsonValue(parsed.trip),
    bookings: toJsonValue(parsed.bookings),
    warnings: parsed.warnings,
    provider: parsed.provider,
    model: parsed.model,
    errorMessage: parsed.error_message,
    rawResult: toJsonValue(parsed.raw_result)
  });

  if (result.duplicate) {
    console.info("marco.extraction_callback_duplicate_ignored", {
      job_id: parsed.job_id,
      requested_status: parsed.status,
      current_status: result.status,
      candidates: result.candidates
    });
  } else if (result.status === "failed") {
    console.warn("marco.extraction_callback_failed", {
      job_id: parsed.job_id,
      provider: parsed.provider,
      model: parsed.model,
      warnings: parsed.warnings.length
    });
  } else {
    console.info("marco.extraction_callback_completed", {
      job_id: parsed.job_id,
      provider: parsed.provider,
      model: parsed.model,
      candidates: result.candidates,
      pages: parsed.pages.length,
      warnings: parsed.warnings.length
    });
  }

  return { status: result.status, candidates: result.candidates };
}

function toJsonValue(value: unknown): Json {
  if (value === undefined) return {};
  return JSON.parse(JSON.stringify(value));
}
