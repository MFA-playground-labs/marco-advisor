import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { uploadEvidence } from "@/lib/server/workflows/upload-evidence";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const interactionId = request.headers.get("x-marco-upload-interaction-id") ?? undefined;
  const startedAt = Date.now();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    console.warn("marco.upload_workflow_failed", {
      interaction_id: interactionId,
      stage: "config",
      duration_ms: elapsedMs(startedAt)
    });
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    console.warn("marco.upload_validation_failed", {
      interaction_id: interactionId,
      reason: "missing_file",
      duration_ms: elapsedMs(startedAt)
    });
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  console.info("marco.upload_request_received", {
    interaction_id: interactionId,
    content_type: file.type || "application/octet-stream",
    file_extension: fileExtension(file.name),
    size_bytes: file.size
  });

  try {
    const result = await uploadEvidence(
      {
        file,
        tripName: String(formData.get("tripName") || "").trim(),
        destination: String(formData.get("destination") || "").trim(),
        startsOn: String(formData.get("startsOn") || "").trim(),
        endsOn: String(formData.get("endsOn") || "").trim()
      },
      {
        repo: createSupabaseRepository(supabase),
        observability: { interactionId }
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Upload failed.") }, { status: errorStatus(error) });
  }
}

function elapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? extension.toLowerCase().slice(0, 16) : "";
}
