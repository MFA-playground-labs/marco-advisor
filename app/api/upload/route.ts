import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { uploadEvidence } from "@/lib/server/workflows/upload-evidence";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });

  try {
    const result = await uploadEvidence(
      {
        file,
        tripName: String(formData.get("tripName") || "").trim(),
        destination: String(formData.get("destination") || "").trim(),
        startsOn: String(formData.get("startsOn") || "").trim(),
        endsOn: String(formData.get("endsOn") || "").trim()
      },
      { repo: createSupabaseRepository(supabase) }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Upload failed.") }, { status: errorStatus(error) });
  }
}
