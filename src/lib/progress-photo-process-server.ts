import convert from "heic-convert";
import sharp from "sharp";

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 82;

function looksLikeHeic(buffer: Buffer, contentType: string, fileName?: string): boolean {
  const type = (contentType || "").toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  // ftyp....heic / heif / mif1
  if (buffer.length >= 12) {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return true;
  }
  return false;
}

/**
 * Convert any supported phone photo (JPEG/PNG/WebP/HEIC/GIF) into a gallery JPEG
 * with the long edge capped. Used after direct Storage upload so Vercel never
 * sees the raw multi‑MB iPhone file.
 */
export async function processProgressPhotoToJpeg(
  input: Buffer,
  contentType: string,
  fileName?: string
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  let working = input;

  if (looksLikeHeic(working, contentType, fileName)) {
    const converted = await convert({
      buffer: working,
      format: "JPEG",
      quality: 0.9,
    });
    working = Buffer.from(converted);
  }

  const buffer = await sharp(working)
    .rotate()
    .resize(MAX_LONG_EDGE, MAX_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, contentType: "image/jpeg" };
}
