/**
 * Browser-only. Shrinks phone photos before upload so the request stays under
 * Vercel's 4.5 MB serverless body limit (larger requests fail with 413 before
 * reaching the API route).
 *
 * Important for iPhone: decoding a 12 MP photo + canvas draw on the main thread
 * can freeze Safari/PWA for several seconds. We yield so "Preparing…" can paint
 * first, and we decode the image only once.
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

async function decode(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to <img> decoding (older Safari / HEIC edge cases).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new PhotoPrepareError(
            "Could not read this photo. On iPhone, try taking a screenshot of it and upload the screenshot."
          )
        );
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
 * Returns a file that is safe to upload: small originals pass through untouched,
 * anything else is redrawn as a JPEG with the long edge capped.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  if (file.size > MAX_PHOTO_PICK_BYTES) {
    throw new PhotoPrepareError("Photo is too large (max 20 MB). Please choose a smaller photo.");
  }
  if (file.type === "image/gif") return file;
  if (file.size <= SKIP_RESIZE_UNDER_BYTES && PASSTHROUGH_TYPES.has(file.type)) return file;

  await yieldForUiPaint();

  const { source, width, height, release } = await decode(file);
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
  throw new PhotoPrepareError(
    "Could not prepare this photo for upload. Try a screenshot of the photo, or choose a smaller one."
  );
}

/** User-facing message for an error thrown while preparing or sending a photo. */
export function photoUploadCatchMessage(err: unknown): string {
  return err instanceof PhotoPrepareError ? err.message : "Upload failed.";
}

/** User-facing message for a failed photo upload response. */
export function photoUploadErrorMessage(status: number, body: unknown): string {
  if (status === 413) return "Photo is too large to upload. Please try a smaller photo.";
  const msg = (body as { error?: string } | null)?.error;
  return msg || "Upload failed.";
}
