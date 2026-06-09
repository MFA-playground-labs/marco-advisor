import { z } from "zod";
import type { TablesInsert } from "@/lib/database.types";
import { extractedBookingSchema, extractionResultSchema } from "@/lib/extraction-schema";
import type { SupabaseRepository } from "@/lib/server/supabase-repository";
import { WorkflowError } from "@/lib/server/errors";

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
  | "getExtractionJobWithUpload"
  | "replaceUploadPages"
  | "updateTrip"
  | "upsertTravelers"
  | "createCandidates"
  | "markUploadStatus"
  | "markExtractionJob"
>;

export async function completeExtraction(repo: CompleteExtractionDeps, payload: unknown) {
  const parsed = extractionCallbackSchema.parse(payload);
  const job = await repo.getExtractionJobWithUpload(parsed.job_id);
  const upload = job.upload;
  if (!upload) throw new WorkflowError("Extraction job is missing its upload.", 404);

  if (parsed.status === "failed") {
    const message = parsed.error_message ?? parsed.warnings[0] ?? "Extraction failed.";
    await repo.markUploadStatus(upload.id, "failed");
    await repo.markExtractionJob(job.id, {
      status: "failed",
      error_message: message,
      provider: parsed.provider,
      model: parsed.model,
      warnings: parsed.warnings,
      raw_result: toJsonObject(parsed.raw_result),
      completed_at: new Date().toISOString()
    });
    return { status: "failed" as const, candidates: 0 };
  }

  if (parsed.pages.length > 0) {
    await repo.replaceUploadPages(
      parsed.pages.map((page) => ({
        upload_id: upload.id,
        trip_id: job.trip_id!,
        job_id: job.id,
        page_number: page.page_number,
        text: page.text,
        char_count: page.text.length,
        extraction_confidence: page.extraction_confidence
      }))
    );
  }

  if (parsed.trip.name || parsed.trip.destination || parsed.trip.starts_on || parsed.trip.ends_on) {
    await repo.updateTrip(job.trip_id!, {
      ...(parsed.trip.name ? { name: parsed.trip.name } : {}),
      ...(parsed.trip.destination ? { destination: parsed.trip.destination } : {}),
      ...(parsed.trip.starts_on ? { starts_on: parsed.trip.starts_on } : {}),
      ...(parsed.trip.ends_on ? { ends_on: parsed.trip.ends_on } : {})
    });
  }

  await repo.upsertTravelers(job.trip_id!, upload.owner_id, parsed.trip.travelers);
  await repo.createCandidates(
    parsed.bookings.map((booking) => ({
      upload_id: upload.id,
      trip_id: job.trip_id!,
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
      source_job_id: job.id,
      source_pages: booking.source_pages,
      source_snippets: booking.source_snippets,
      extraction_method: booking.extraction_method,
      raw_json: booking as TablesInsert<"extracted_booking_candidates">["raw_json"]
    }))
  );

  await repo.markUploadStatus(upload.id, "review_ready");
  await repo.markExtractionJob(job.id, {
    status: "succeeded",
    provider: parsed.provider,
    model: parsed.model,
    warnings: parsed.warnings,
    raw_result: toJsonObject(parsed.raw_result),
    completed_at: new Date().toISOString()
  });

  return { status: "succeeded" as const, candidates: parsed.bookings.length };
}

function toJsonObject(value: unknown) {
  if (value === undefined) return {};
  return JSON.parse(JSON.stringify(value));
}
