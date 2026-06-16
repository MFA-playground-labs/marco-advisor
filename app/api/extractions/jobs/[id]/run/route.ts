import { NextResponse } from "next/server";
import { requireExtractionWebhookAuth } from "@/lib/server/extraction-auth";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { runOpenAiExtractionJob } from "@/lib/server/workflows/run-openai-extraction-job";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const defaultStaleProcessingMs = 15 * 60 * 1000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    requireExtractionWebhookAuth(request);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });

    const repo = createSupabaseRepository(supabase as any);
    const job = await repo.getExtractionJobWithUpload(id);
    if (job.status === "processing" && isStale(job.started_at)) {
      await repo.markExtractionJob(id, {
        status: "queued",
        error_message: "Retrying stale OpenAI extraction job.",
        warnings: [...(job.warnings ?? []), "Retrying stale OpenAI extraction job."]
      });
    }

    const result = await runOpenAiExtractionJob({ jobId: id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Extraction run failed.") }, { status: errorStatus(error) });
  }
}

function isStale(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const timestamp = Date.parse(startedAt);
  if (!Number.isFinite(timestamp)) return true;
  const staleMs = Number(process.env.EXTRACTION_STALE_PROCESSING_MS);
  const thresholdMs = Number.isFinite(staleMs) && staleMs > 0 ? staleMs : defaultStaleProcessingMs;
  return Date.now() - timestamp >= thresholdMs;
}
