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
    const job = await repo.getExtractionJobWithUpload(id);
    const signed = await repo.createSignedUploadUrl(job.upload.storage_path, 300);

    return NextResponse.json({
      job_id: job.id,
      upload_id: job.upload.id,
      filename: job.upload.filename,
      content_type: job.upload.content_type,
      signed_url: signed.signedUrl,
      expires_in: 300
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Extraction file request failed.") }, { status: errorStatus(error) });
  }
}
