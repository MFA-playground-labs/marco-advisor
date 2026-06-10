export class WorkflowError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WorkflowError";
    this.status = status;
  }
}

export const asyncExtractionMigrationMessage =
  "Database migration required. Apply 20260609120000_async_extraction_pipeline.sql and reload the Supabase schema cache.";

export function isAsyncExtractionSchemaCacheError(message: string | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("schema cache") &&
    (normalized.includes("model") ||
      normalized.includes("provider") ||
      normalized.includes("warnings") ||
      normalized.includes("raw_result") ||
      normalized.includes("upload_pages"))
  );
}

export function errorMessage(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  return isAsyncExtractionSchemaCacheError(message) ? asyncExtractionMigrationMessage : message;
}

export function errorStatus(error: unknown, fallback = 500) {
  return error instanceof WorkflowError ? error.status : fallback;
}
