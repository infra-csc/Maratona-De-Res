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

/**
 * Fetches a stored audio object with the user's Bearer token and returns a blob
 * object URL playable by <audio>. The serving endpoint requires authentication
 * (sensitive HR content), and <audio src> cannot carry an Authorization header,
 * so we fetch the bytes ourselves. Callers must URL.revokeObjectURL when done.
 */
export async function fetchAudioObjectUrl(objectPath: string): Promise<string> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  const token = localStorage.getItem("maratona_token");
  const res = await fetch(`${base}/storage${objectPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("Falha ao carregar o áudio.");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
