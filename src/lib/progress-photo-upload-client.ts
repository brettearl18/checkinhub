import {
  MAX_PHOTO_PICK_BYTES,
  PhotoPrepareError,
  resizeImageForUpload,
  yieldForUiPaint,
} from "@/lib/resize-image-for-upload";

type FetchWithAuth = (url: string, init?: RequestInit) => Promise<Response>;

export type ProgressPhotoUploadMeta = {
  imageType: string;
  caption?: string | null;
  photoDate?: string | null;
};

export type ProgressPhotoUploadResult = {
  id: string;
  imageUrl: string;
  imageType: string;
  caption: string | null;
  uploadedAt: string;
  newlyEarned?: unknown;
};

const APP_ORIGINS = [
  "https://checkin.vanahealth.com.au",
  "https://checkinhub-alpha.vercel.app",
];

/**
 * Upload a progress photo without going through Vercel's 4.5 MB body limit:
 * prepare a JPEG when the phone can, then PUT directly to a signed Storage URL
 * and finalise via the API (server converts HEIC / resizes if needed).
 */
export async function uploadProgressPhotoDirect(options: {
  file: File;
  meta: ProgressPhotoUploadMeta;
  fetchWithAuth: FetchWithAuth;
  /** Default: client portal. Coach backfill passes a client-scoped path. */
  apiBase?: string;
}): Promise<ProgressPhotoUploadResult> {
  const { file, meta, fetchWithAuth } = options;
  const apiBase = options.apiBase ?? "/api/client/progress-images";

  if (file.size > MAX_PHOTO_PICK_BYTES) {
    throw new PhotoPrepareError("Photo is too large (max 20 MB). Please choose a smaller photo.");
  }

  await yieldForUiPaint();

  // Best effort: shrink on device when Safari can decode it. If that fails
  // (common with HEIC / huge Pro photos), upload the original for server processing.
  let uploadBlob: Blob = file;
  let contentType = file.type || "application/octet-stream";
  let fileName = file.name || "photo.jpg";
  try {
    const prepared = await resizeImageForUpload(file);
    uploadBlob = prepared;
    contentType = prepared.type || "image/jpeg";
    fileName = prepared.name || "photo.jpg";
  } catch {
    // Keep original; server will convert/resize.
    if (!contentType || contentType === "application/octet-stream") {
      const lower = fileName.toLowerCase();
      if (lower.endsWith(".heic")) contentType = "image/heic";
      else if (lower.endsWith(".heif")) contentType = "image/heif";
      else if (lower.endsWith(".png")) contentType = "image/png";
      else if (lower.endsWith(".webp")) contentType = "image/webp";
      else contentType = "image/jpeg";
    }
  }

  const origins =
    typeof window !== "undefined" ? [window.location.origin, ...APP_ORIGINS] : APP_ORIGINS;

  const startRes = await fetchWithAuth(`${apiBase}/direct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      contentType,
      fileName,
      byteSize: uploadBlob.size,
      origins,
    }),
  });
  if (startRes.status === 401) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (!startRes.ok) {
    const body = await startRes.json().catch(() => ({}));
    throw new PhotoPrepareError(
      (body as { error?: string }).error || "Could not start photo upload."
    );
  }
  const start = (await startRes.json()) as {
    uploadUrl: string;
    storagePath: string;
  };

  const putRes = await fetch(start.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: uploadBlob,
  });
  if (!putRes.ok) {
    throw new PhotoPrepareError(
      "Upload to storage failed. Please try again on Wi‑Fi, or close and reopen the app."
    );
  }

  const completeRes = await fetchWithAuth(`${apiBase}/direct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      storagePath: start.storagePath,
      contentType,
      fileName,
      imageType: meta.imageType,
      caption: meta.caption ?? null,
      photoDate: meta.photoDate ?? null,
    }),
  });
  if (completeRes.status === 401) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new PhotoPrepareError(
      (body as { error?: string }).error || "Could not save photo."
    );
  }
  return (await completeRes.json()) as ProgressPhotoUploadResult;
}
