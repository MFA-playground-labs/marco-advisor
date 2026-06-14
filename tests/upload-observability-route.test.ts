import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/observability/upload/route";

function request(body: unknown) {
  return new Request("https://example.com/api/observability/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/observability/upload", () => {
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("accepts known upload telemetry events", async () => {
    const response = await POST(
      request({
        event: "marco.upload_submit_succeeded",
        interaction_id: "interaction-1",
        content_type: "application/pdf",
        file_extension: "pdf",
        size_bytes: 1234,
        status_code: 200,
        duration_ms: 42
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(consoleInfo).toHaveBeenCalledWith(
      "marco.upload_submit_succeeded",
      expect.objectContaining({
        interaction_id: "interaction-1",
        content_type: "application/pdf",
        file_extension: "pdf"
      })
    );
  });

  it("rejects malformed or unknown upload telemetry events", async () => {
    const response = await POST(
      request({
        event: "marco.upload_raw_file_contents",
        interaction_id: "interaction-1"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid upload telemetry payload." });
  });

  it("truncates long error messages before logging", async () => {
    const longMessage = "x".repeat(400);

    const response = await POST(
      request({
        event: "marco.upload_submit_failed",
        interaction_id: "interaction-1",
        error_message: longMessage
      })
    );

    expect(response.status).toBe(200);
    expect(consoleWarn).toHaveBeenCalledWith(
      "marco.upload_submit_failed",
      expect.objectContaining({
        error_message: "x".repeat(240)
      })
    );
  });
});
