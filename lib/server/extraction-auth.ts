import { WorkflowError } from "@/lib/server/errors";

export function requireExtractionWebhookAuth(request: Request) {
  const expected = process.env.EXTRACTION_WEBHOOK_SECRET;
  if (!expected) {
    throw new WorkflowError("EXTRACTION_WEBHOOK_SECRET is not configured.", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (token !== expected) {
    throw new WorkflowError("Invalid extraction webhook secret.", 401);
  }
}
