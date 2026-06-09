export type ExtractionDispatchInput = {
  jobId: string;
  uploadId: string;
  tripId: string;
};

export type ExtractionDispatchResult = {
  ok: boolean;
  warning?: string;
};

export async function dispatchExtractionJob(input: ExtractionDispatchInput): Promise<ExtractionDispatchResult> {
  const webhookUrl = process.env.N8N_EXTRACTION_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, warning: "N8N_EXTRACTION_WEBHOOK_URL is not configured." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXTRACTION_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.EXTRACTION_WEBHOOK_SECRET}` }
          : {})
      },
      body: JSON.stringify({
        job_id: input.jobId,
        upload_id: input.uploadId,
        trip_id: input.tripId
      })
    });

    if (!response.ok) {
      return { ok: false, warning: `n8n dispatch failed with HTTP ${response.status}.` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      warning: error instanceof Error ? `n8n dispatch failed: ${error.message}` : "n8n dispatch failed."
    };
  }
}
