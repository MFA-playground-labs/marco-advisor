import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const uploadTelemetryEventSchema = z.object({
  event: z.enum([
    "marco.upload_submit_started",
    "marco.upload_submit_succeeded",
    "marco.upload_submit_failed",
    "marco.upload_ui_cleanup_failed"
  ]),
  interaction_id: z.string().min(1).max(120),
  content_type: z.string().max(120).optional(),
  file_extension: z.string().max(16).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  error_message: z.string().optional()
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid upload telemetry payload." }, { status: 400 });
  }

  const parsed = uploadTelemetryEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload telemetry payload." }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    error_message: truncateErrorMessage(parsed.data.error_message)
  };
  const log = payload.event.endsWith("_failed") ? console.warn : console.info;

  log(payload.event, payload);
  return NextResponse.json({ ok: true });
}

function truncateErrorMessage(message: string | undefined) {
  if (!message) return undefined;
  return message.slice(0, 240);
}
