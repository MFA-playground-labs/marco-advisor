export const maxUploadBytes = 25 * 1024 * 1024;

export const supportedUploadTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export type UploadFileLike = Pick<File, "name" | "size" | "type">;

export function validateUploadFile(file: UploadFileLike) {
  if (!supportedUploadTypes.has(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}`;
  }

  if (file.size > maxUploadBytes) {
    return `File is too large. Maximum upload size is ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`;
  }

  return null;
}

export function sanitizeStorageFilename(filename: string) {
  return filename.replace(/[^\w.\-]+/g, "_");
}

export function createUploadStoragePath(ownerId: string, filename: string, id = crypto.randomUUID()) {
  return `${ownerId}/${id}-${sanitizeStorageFilename(filename)}`;
}

export function fallbackTripName(filename: string) {
  return `Trip from ${filename}`;
}
