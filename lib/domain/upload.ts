export const maxUploadBytes = 25 * 1024 * 1024;

export const supportedUploadTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export const uploadAccept = [
  ".pdf",
  ".txt",
  ".html",
  ".htm",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  "application/pdf",
  "text/plain",
  "text/html",
  "image/png",
  "image/jpeg",
  "image/webp"
].join(",");

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
