/**
 * Browser-only best-effort shrink before upload.
 * Direct Storage upload is the source of truth for large/HEIC iPhone photos;
 * this path only speeds things up when Safari can decode the file cheaply.
 */

export const MAX_PHOTO_PICK_BYTES = 20 * 1024 * 1024;

/** Shown on file inputs so iPhone Photos (incl. HEIC) is offered. */
export const PHOTO_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*";

const MAX_LONG_EDGE_PX = 1600;
const SKIP_RESIZE_UNDER_BYTES = 1.5 * 1024 * 1024;
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;
const PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Thrown when a photo can't be prepared for upload; `message` is safe to show the user. */
export class PhotoPrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoPrepareError";
  }
}

/** Let React paint "Preparing…" before heavy image work (needed on iOS Safari). */
export function yieldForUiPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
      return;
    }
    setTimeout(resolve, 0);
  });
}

function isHeicLike(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

async function decodeDownscaled(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  // Prefer resize-during-decode so 48MP iPhone photos never fully materialise in memory.
  if (typeof createImageBitmap === "function") {
    try {
      // Landscape-biased first pass.
      const wide = await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeWidth: MAX_LONG_EDGE_PX,
        resizeQuality: "medium",
      });
      if (Math.max(wide.width, wide.height) <= MAX_LONG_EDGE_PX * 1.15) {
        return {
          source: wide,
          width: wide.width,
          height: wide.height,
          release: () => wide.close(),
        };
      }
      wide.close();
      const tall = await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeHeight: MAX_LONG_EDGE_PX,
        resizeQuality: "medium",
      });
      return {
        source: tall,
        width: tall.width,
        height: tall.height,
        release: () => tall.close(),
      };
    } catch {
      try {
        const full = await createImageBitmap(file, { imageOrientation: "from-image" });
        return {
          source: full,
          width: full.width,
          height: full.height,
          release: () => full.close(),
        };
      } catch {
        // Fall through to <img>.
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new PhotoPrepareError("Could not read this photo on the phone."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns a file that is safe to upload when the browser can decode it.
 * Throws PhotoPrepareError for HEIC/undecodable files so the caller can
 * fall back to direct Storage upload of the original.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  if (file.size > MAX_PHOTO_PICK_BYTES) {
    throw new PhotoPrepareError("Photo is too large (max 20 MB). Please choose a smaller photo.");
  }
  // Let the server handle HEIC — decoding it in Safari is unreliable and can freeze.
  if (isHeicLike(file)) {
    throw new PhotoPrepareError("HEIC needs server processing");
  }
  if (file.type === "image/gif") return file;
  if (file.size <= SKIP_RESIZE_UNDER_BYTES && PASSTHROUGH_TYPES.has(file.type)) return file;

  await yieldForUiPaint();

  const { source, width, height, release } = await decodeDownscaled(file);
  try {
    let longEdge = Math.min(MAX_LONG_EDGE_PX, Math.max(width, height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = longEdge / Math.max(width, height);
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;

      await yieldForUiPaint();
      ctx.drawImage(source, 0, 0, w, h);
      await yieldForUiPaint();

      const blob = await toJpegBlob(canvas, attempt === 0 ? 0.82 : 0.72);
      if (blob && blob.size <= TARGET_MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
      longEdge = Math.round(longEdge * 0.75);
    }
  } finally {
    release();
  }

  if (file.size <= TARGET_MAX_BYTES && PASSTHROUGH_TYPES.has(file.type)) return file;
  throw new PhotoPrepareError("Could not prepare this photo on the phone.");
}

/** User-facing message for an error thrown while preparing or sending a photo. */
export function photoUploadCatchMessage(err: unknown): string {
  if (err instanceof PhotoPrepareError) return err.message;
  if (err instanceof Error && (err as Error & { status?: number }).status === 401) {
    return "Please sign in again, then try uploading.";
  }
  return "Upload failed.";
}

/** User-facing message for a failed photo upload response. */
export function photoUploadErrorMessage(status: number, body: unknown): string {
  if (status === 413) return "Photo is too large to upload. Please try again.";
  const msg = (body as { error?: string } | null)?.error;
  return msg || "Upload failed.";
}
