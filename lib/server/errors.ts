export class WorkflowError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WorkflowError";
    this.status = status;
  }
}

export function errorMessage(error: unknown, fallback = "Request failed.") {
  return error instanceof Error ? error.message : fallback;
}

export function errorStatus(error: unknown, fallback = 500) {
  return error instanceof WorkflowError ? error.status : fallback;
}
