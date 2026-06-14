"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { AlertNote, Card } from "@/components/ui";
import { uploadAccept } from "@/lib/domain/upload";

export function UploadPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const interactionId = createInteractionId();
    const startedAt = performance.now();
    setBusy(true);
    setStatus("Uploading evidence...");
    const formData = new FormData(form);
    const file = formData.get("file");
    const fileMetadata = uploadTelemetryFileMetadata(file);

    void emitUploadTelemetry({
      event: "marco.upload_submit_started",
      interaction_id: interactionId,
      ...fileMetadata
    });

    let failureTelemetrySent = false;

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "X-Marco-Upload-Interaction-Id": interactionId
        },
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error ?? "Upload failed";
        void emitUploadTelemetry({
          event: "marco.upload_submit_failed",
          interaction_id: interactionId,
          ...fileMetadata,
          status_code: response.status,
          duration_ms: elapsedMs(startedAt),
          error_message: message
        });
        failureTelemetrySent = true;
        throw new Error(message);
      }
      setStatus(payload.warning ?? "Extraction queued. Review candidates will appear after n8n processes the evidence.");
      void emitUploadTelemetry({
        event: "marco.upload_submit_succeeded",
        interaction_id: interactionId,
        ...fileMetadata,
        status_code: response.status,
        duration_ms: elapsedMs(startedAt)
      });
      try {
        form.reset();
        router.refresh();
      } catch (cleanupError) {
        void emitUploadTelemetry({
          event: "marco.upload_ui_cleanup_failed",
          interaction_id: interactionId,
          ...fileMetadata,
          duration_ms: elapsedMs(startedAt),
          error_message: cleanupError instanceof Error ? cleanupError.message : "Upload UI cleanup failed."
        });
      }
    } catch (error) {
      if (!failureTelemetrySent) {
        void emitUploadTelemetry({
          event: "marco.upload_submit_failed",
          interaction_id: interactionId,
          ...fileMetadata,
          duration_ms: elapsedMs(startedAt),
          error_message: error instanceof Error ? error.message : "Upload failed"
        });
      }
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-lg border-2 border-dashed border-line bg-slate-50 p-8 text-center">
          <UploadCloud className="mx-auto text-slate-400" size={40} />
          <h2 className="mt-4 font-display text-3xl font-bold">Upload trip evidence</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Add PDFs, text/HTML confirmations, or screenshots. Marco stores the original, queues extraction, and waits for your
            review before creating bookings.
          </p>
          <input
            className="mt-6 block w-full rounded-lg border border-line bg-white p-3 text-sm"
            type="file"
            name="file"
            accept={uploadAccept}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold">
            Trip name
            <input name="tripName" className="mt-2 w-full rounded-lg border border-line px-3 py-2" placeholder="Italy Summer 2026" />
          </label>
          <label className="block text-sm font-bold">
            Destination
            <input name="destination" className="mt-2 w-full rounded-lg border border-line px-3 py-2" placeholder="Italy" />
          </label>
          <label className="block text-sm font-bold">
            Starts on
            <input name="startsOn" type="date" className="mt-2 w-full rounded-lg border border-line px-3 py-2" />
          </label>
          <label className="block text-sm font-bold">
            Ends on
            <input name="endsOn" type="date" className="mt-2 w-full rounded-lg border border-line px-3 py-2" />
          </label>
        </div>

        {status && <AlertNote>{status}</AlertNote>}

        <button disabled={busy} className="rounded-lg bg-ink px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Queueing..." : "Upload and queue"}
        </button>
      </form>
    </Card>
  );
}

function createInteractionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function uploadTelemetryFileMetadata(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) return {};

  return {
    content_type: file.type || "application/octet-stream",
    file_extension: fileExtension(file.name),
    size_bytes: file.size
  };
}

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? extension.toLowerCase().slice(0, 16) : "";
}

async function emitUploadTelemetry(payload: Record<string, unknown>) {
  try {
    await fetch("/api/observability/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Upload telemetry is best effort and must not affect the upload flow.
  }
}
