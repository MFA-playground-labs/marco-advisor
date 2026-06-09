import { NextResponse } from "next/server";
import { requireExtractionWebhookAuth } from "@/lib/server/extraction-auth";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { completeExtraction } from "@/lib/server/workflows/complete-extraction";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    requireExtractionWebhookAuth(request);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });

    const payload = await request.json();
    const result = await completeExtraction(createSupabaseRepository(supabase as any), payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Extraction callback failed.") }, { status: errorStatus(error) });
  }
}
