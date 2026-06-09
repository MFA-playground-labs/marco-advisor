"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { AlertNote, Card } from "@/components/ui";

export function UploadPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Uploading document...");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Upload failed");
      setStatus("Extraction queued. Review candidates will appear after n8n processes the document.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
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
            Add digital PDFs, text documents, or HTML confirmations. Marco stores the original, queues extraction, and waits for
            your review before creating bookings.
          </p>
          <input
            className="mt-6 block w-full rounded-lg border border-line bg-white p-3 text-sm"
            type="file"
            name="file"
            accept=".pdf,.txt,.html,.htm,application/pdf,text/plain,text/html"
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
