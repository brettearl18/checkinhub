import { formatDateDisplay } from "@/lib/format-date";

/** Instagram portrait feed — 4:5 */
export const SOCIAL_POST_WIDTH = 1080;
export const SOCIAL_POST_HEIGHT = 1350;

const VANA_GOLD = "#daa450";
const VANA_CREAM = "#faf7f2";
const VANA_SURFACE = "#fffdf9";
const VANA_TEXT = "#2c2825";
const VANA_MUTED = "#78716c";
const LOGO_PATH = "/Vana%20Logo-1-Black-RGB.png";

export interface ProgressSocialPostInput {
  clientName: string;
  poseLabel: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeDate: string | null;
  afterDate: string | null;
}

export interface ProgressSocialPostOptions {
  /** Authenticated fetch (e.g. useApiClient) — required for Firebase progress photos. */
  fetchAuthenticated?: (url: string) => Promise<Response>;
}

function normalizeImageUrl(url: string): string {
  let decoded = url.trim();
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    /* keep original */
  }
  return decoded;
}

function proxiedImageUrl(imageUrl: string): string {
  const normalized = normalizeImageUrl(imageUrl);
  return `/api/coach/progress-image-proxy?url=${encodeURIComponent(normalized)}`;
}

function loadImageElement(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image"));
    };
    img.src = objectUrl;
  });
}

function isRemoteProgressPhotoUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function loadProgressImage(
  imageUrl: string,
  options?: ProgressSocialPostOptions
): Promise<HTMLImageElement> {
  const normalized = normalizeImageUrl(imageUrl);

  if (!isRemoteProgressPhotoUrl(normalized)) {
    return loadImageElement(normalized, false);
  }

  const fetchAuth = options?.fetchAuthenticated;
  if (!fetchAuth) {
    throw new Error("Unable to load progress photo for export");
  }

  const res = await fetchAuth(proxiedImageUrl(normalized));
  if (!res.ok) {
    let message = `Failed to load image (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return loadImageFromBlob(await res.blob());
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = w / h;
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (ir > dr) {
    sh = img.naturalHeight;
    sw = sh * dr;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / dr;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLogoWhite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const oc = off.getContext("2d");
  if (!oc) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  oc.drawImage(img, 0, 0);
  oc.globalCompositeOperation = "source-in";
  oc.fillStyle = "#ffffff";
  oc.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, x, y, w, h);
}

function formatTimeSpan(beforeDate: string | null, afterDate: string | null): string {
  const before = beforeDate ? formatDateDisplay(beforeDate.slice(0, 10)) : null;
  const after = afterDate ? formatDateDisplay(afterDate.slice(0, 10)) : null;
  if (before && after) return `${before} → ${after}`;
  if (after) return after;
  if (before) return before;
  return "";
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function generateProgressSocialPostCanvas(
  input: ProgressSocialPostInput,
  options?: ProgressSocialPostOptions
): Promise<HTMLCanvasElement> {
  const [beforeImg, afterImg, logoImg] = await Promise.all([
    loadProgressImage(input.beforeImageUrl, options),
    loadProgressImage(input.afterImageUrl, options),
    loadImageElement(LOGO_PATH, false),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = SOCIAL_POST_WIDTH;
  canvas.height = SOCIAL_POST_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = VANA_CREAM;
  ctx.fillRect(0, 0, SOCIAL_POST_WIDTH, SOCIAL_POST_HEIGHT);

  const logoBarH = 88;
  ctx.fillStyle = VANA_GOLD;
  ctx.fillRect(0, 0, SOCIAL_POST_WIDTH, logoBarH);

  const logoW = 200;
  const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW;
  drawLogoWhite(ctx, logoImg, (SOCIAL_POST_WIDTH - logoW) / 2, (logoBarH - logoH) / 2, logoW, logoH);

  const padX = 56;
  let y = logoBarH + 44;

  ctx.fillStyle = VANA_TEXT;
  ctx.font = "600 52px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText(input.clientName.trim() || "Client", SOCIAL_POST_WIDTH / 2, y);
  y += 44;

  const timeSpan = formatTimeSpan(input.beforeDate, input.afterDate);
  if (timeSpan) {
    ctx.fillStyle = VANA_MUTED;
    ctx.font = "500 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(timeSpan, SOCIAL_POST_WIDTH / 2, y);
    y += 36;
  }

  ctx.fillStyle = VANA_GOLD;
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "0.12em";
  ctx.fillText(input.poseLabel.toUpperCase(), SOCIAL_POST_WIDTH / 2, y);
  ctx.letterSpacing = "0";
  y += 40;

  const photoGap = 32;
  const photoW = (SOCIAL_POST_WIDTH - padX * 2 - photoGap) / 2;
  const photoH = 920;
  const leftX = padX;
  const rightX = padX + photoW + photoGap;

  const slots: Array<{ img: HTMLImageElement; label: string; x: number }> = [
    { img: beforeImg, label: "Before", x: leftX },
    { img: afterImg, label: "After", x: rightX },
  ];

  for (const slot of slots) {
    ctx.fillStyle = VANA_SURFACE;
    roundRect(ctx, slot.x - 4, y - 4, photoW + 8, photoH + 8, 20);
    ctx.fill();
    ctx.save();
    roundRect(ctx, slot.x, y, photoW, photoH, 16);
    ctx.clip();
    drawImageCover(ctx, slot.img, slot.x, y, photoW, photoH);
    ctx.restore();

    ctx.strokeStyle = "rgba(218, 164, 80, 0.35)";
    ctx.lineWidth = 2;
    roundRect(ctx, slot.x, y, photoW, photoH, 16);
    ctx.stroke();

    ctx.fillStyle = VANA_TEXT;
    ctx.font = "600 26px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(slot.label, slot.x + photoW / 2, y + photoH + 40);
  }

  const footerY = SOCIAL_POST_HEIGHT - 48;
  ctx.fillStyle = VANA_MUTED;
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Vana Health", SOCIAL_POST_WIDTH / 2, footerY);

  return canvas;
}

export async function fetchProgressPhotoBlob(
  imageUrl: string,
  fetchAuthenticated: (url: string) => Promise<Response>
): Promise<Blob> {
  const normalized = normalizeImageUrl(imageUrl);

  if (!isRemoteProgressPhotoUrl(normalized)) {
    const res = await fetch(normalized);
    if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
    return res.blob();
  }

  const res = await fetchAuthenticated(proxiedImageUrl(normalized));
  if (!res.ok) {
    let message = `Failed to load image (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function downloadProgressPhotoFile(
  imageUrl: string,
  filename: string,
  fetchAuthenticated: (url: string) => Promise<Response>
): Promise<void> {
  const blob = await fetchProgressPhotoBlob(imageUrl, fetchAuthenticated);
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  const name = filename.includes(".") ? filename : `${filename}.${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadProgressSocialPost(
  input: ProgressSocialPostInput,
  options?: ProgressSocialPostOptions
): Promise<void> {
  const canvas = await generateProgressSocialPostCanvas(input, options);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png", 1);
  });

  const pose = sanitizeFilename(input.poseLabel);
  const client = sanitizeFilename(input.clientName) || "client";
  const filename = `${client}-${pose}-progress-vana.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
