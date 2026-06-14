import { NextResponse } from "next/server";
import { requireExtractionWebhookAuth } from "@/lib/server/extraction-auth";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    requireExtractionWebhookAuth(request);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });

    const repo = createSupabaseRepository(supabase as any);
    const job = await repo.claimExtractionJob(id);
    console.info(job.claimed ? "marco.extraction_job_claimed" : "marco.extraction_job_claim_skipped", {
      job_id: job.id,
      status: job.status
    });

    return NextResponse.json({
      job: {
        id: job.id,
        upload_id: job.upload_id,
        trip_id: job.trip_id,
        status: job.status,
        provider: job.provider,
        model: job.model,
        started_at: job.started_at ?? null,
        warnings: job.warnings ?? []
      },
      upload: {
        id: job.upload.id,
        filename: job.upload.filename,
        content_type: job.upload.content_type,
        storage_path: job.upload.storage_path
      },
      limits: {
        max_pages: Number(process.env.EXTRACTION_MAX_PAGES ?? 10),
        max_text_chars: Number(process.env.EXTRACTION_MAX_TEXT_CHARS ?? 25000),
        confidence_threshold: Number(process.env.EXTRACTION_CONFIDENCE_THRESHOLD ?? 0.85)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Extraction job request failed.") }, { status: errorStatus(error) });
  }
}
