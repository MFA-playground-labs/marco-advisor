import { WorkflowError } from "@/lib/server/errors";

export function requireExtractionRunAuth(request: Request) {
  const expected = process.env.EXTRACTION_RUN_SECRET;
  if (!expected) {
    throw new WorkflowError("EXTRACTION_RUN_SECRET is not configured.", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (token !== expected) {
    throw new WorkflowError("Invalid extraction run secret.", 401);
  }
}
