import { requestUploadUrl } from "@workspace/api-client-react";

/**
 * Uploads an audio Blob (recorded via MediaRecorder) directly to object storage
 * using the presigned-URL flow:
 *   1. POST /storage/uploads/request-url  → { uploadURL, objectPath }
 *   2. PUT <uploadURL>                     → bytes go straight to GCS
 * Returns the normalized objectPath (e.g. "/objects/uploads/uuid") to persist.
 */
export async function uploadAudioBlob(blob: Blob): Promise<string> {
  const contentType = blob.type || "audio/webm";
  const { uploadURL, objectPath } = await requestUploadUrl({
    name: `avaliacao-${Date.now()}.webm`,
    size: blob.size,
    contentType,
  });
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) {
    throw new Error("Falha ao enviar o áudio para o armazenamento.");
  }
  return objectPath;
}

/** Builds the serving URL for a stored audio objectPath. */
export function audioSrc(objectPath: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  return `${base}/storage${objectPath}`;
}
