import { after, NextResponse } from "next/server";
import type { ExtractionDispatchInput } from "@/lib/server/extraction-dispatch";
import { getExtractionProvider } from "@/lib/server/extraction-provider";
import { createSupabaseServerClient } from "@/lib/supabase";
import { errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";
import { getSelectedTripId } from "@/lib/server/trip-selection";
import { runOpenAiExtractionJob } from "@/lib/server/workflows/run-openai-extraction-job";
import { uploadEvidence } from "@/lib/server/workflows/upload-evidence";
import { createTraceContext, elapsedMs, logWorkflowEvent } from "@/lib/server/workflow-observability";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const interactionId = request.headers.get("x-marco-upload-interaction-id") ?? undefined;
  const traceContext = createTraceContext({ interactionId });
  const startedAt = Date.now();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logWorkflowEvent("marco.upload_workflow_failed", traceContext, {
      stage: "config",
      status: "failed",
      durationMs: elapsedMs(startedAt)
    });
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    logWorkflowEvent("marco.upload_validation_failed", traceContext, {
      reason: "missing_file",
      status: "failed",
      durationMs: elapsedMs(startedAt)
    });
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  logWorkflowEvent("marco.upload_request_received", traceContext, {
    content_type: file.type || "application/octet-stream",
    file_extension: fileExtension(file.name),
    size_bytes: file.size
  });

  try {
    const selectedTripId = await getSelectedTripId();
    const result = await uploadEvidence(
      {
        file,
        tripId: selectedTripId,
        tripName: String(formData.get("tripName") || "").trim(),
        destination: String(formData.get("destination") || "").trim(),
        startsOn: String(formData.get("startsOn") || "").trim(),
        endsOn: String(formData.get("endsOn") || "").trim()
      },
      {
        repo: createSupabaseRepository(supabase),
        dispatch: getExtractionProvider() === "openai" ? scheduleOpenAiExtraction : undefined,
        observability: { traceId: traceContext.traceId, interactionId: traceContext.interactionId }
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Upload failed.") }, { status: errorStatus(error) });
  }
}

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? extension.toLowerCase().slice(0, 16) : "";
}

async function scheduleOpenAiExtraction(input: ExtractionDispatchInput) {
  after(async () => {
    await runOpenAiExtractionJob({ jobId: input.jobId });
  });

  return { ok: true };
}
