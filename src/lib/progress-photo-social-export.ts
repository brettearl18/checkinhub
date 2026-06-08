import { formatDateDisplay } from "@/lib/format-date";

/** Instagram portrait feed — 4:5 */
export const SOCIAL_POST_WIDTH = 1080;
export const SOCIAL_POST_HEIGHT = 1350;

const VANA_GOLD = "#daa450";
const VANA_CREAM = "#faf7f2";
const VANA_SURFACE = "#fffdf9";
const VANA_TEXT = "#2c2825";
const VANA_MUTED = "#78716c";

export const SOCIAL_EXPORT_PAD = 48;
export const SOCIAL_EXPORT_PHOTO_GAP = 20;
export const SOCIAL_EXPORT_CORNER_RADIUS = 20;
export const SOCIAL_EXPORT_FOOTER_HEIGHT = 148;

export const SOCIAL_POST_PHOTO_WIDTH =
  (SOCIAL_POST_WIDTH - SOCIAL_EXPORT_PAD * 2 - SOCIAL_EXPORT_PHOTO_GAP) / 2;

export interface PhotoSlotAlignment {
  /** Vertical shift in export canvas pixels (positive = down). */
  offsetY?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
}

export interface ProgressSocialPostInput {
  clientName: string;
  poseLabel: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeDate: string | null;
  afterDate: string | null;
  beforeAlign?: PhotoSlotAlignment;
  afterAlign?: PhotoSlotAlignment;
  /** Show "N weeks between" centred below the photos. */
  showWeeksBetween?: boolean;
}

/** Photo area height — leaves room for labels, dates, and weeks line. */
export const SOCIAL_POST_PHOTO_SLOT_HEIGHT =
  SOCIAL_POST_HEIGHT - SOCIAL_EXPORT_PAD * 2 - SOCIAL_EXPORT_FOOTER_HEIGHT;

/** Compare modal viewport height (max-w-md × 3:4). */
export const COMPARE_VIEWPORT_HEIGHT = 597;

export interface ProgressSocialPostOptions {
  /** Authenticated fetch (e.g. useApiClient) — required for Firebase progress photos. */
  fetchAuthenticated?: (url: string, options?: RequestInit) => Promise<Response>;
}

/** Map compare-modal layer pan/zoom to export canvas slot alignment. */
export function layerAlignToExportSlot(layer: {
  zoom: number;
  pan: { x: number; y: number };
}): PhotoSlotAlignment {
  const viewportW = 448;
  const scaleX = SOCIAL_POST_PHOTO_WIDTH / viewportW;
  const scaleY = SOCIAL_POST_PHOTO_SLOT_HEIGHT / COMPARE_VIEWPORT_HEIGHT;
  return {
    zoom: layer.zoom,
    panX: layer.pan.x * scaleX,
    panY: layer.pan.y * scaleY,
  };
}

export function previewLayerToExportSlot(
  layer: { zoom: number; pan: { x: number; y: number } },
  previewW: number,
  previewH: number
): PhotoSlotAlignment {
  const scaleX = SOCIAL_POST_PHOTO_WIDTH / previewW;
  const scaleY = SOCIAL_POST_PHOTO_SLOT_HEIGHT / previewH;
  return {
    zoom: layer.zoom,
    panX: layer.pan.x * scaleX,
    panY: layer.pan.y * scaleY,
  };
}

export function exportSlotToPreviewLayer(
  align: PhotoSlotAlignment | undefined,
  previewW: number,
  previewH: number
): { zoom: number; pan: { x: number; y: number } } {
  if (!align) return { zoom: 1, pan: { x: 0, y: 0 } };
  const scaleX = previewW / SOCIAL_POST_PHOTO_WIDTH;
  const scaleY = previewH / SOCIAL_POST_PHOTO_SLOT_HEIGHT;
  return {
    zoom: align.zoom ?? 1,
    pan: {
      x: (align.panX ?? 0) * scaleX,
      y: ((align.panY ?? 0) + (align.offsetY ?? 0)) * scaleY,
    },
  };
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

/** object-contain — matches the share modal preview so alignment carries to export. */
function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  align?: PhotoSlotAlignment
) {
  const zoom = align?.zoom ?? 1;
  const panX = align?.panX ?? 0;
  const panY = (align?.panY ?? 0) + (align?.offsetY ?? 0);
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = w / h;
  let dw: number;
  let dh: number;
  if (ir > dr) {
    dw = w;
    dh = w / ir;
  } else {
    dh = h;
    dw = h * ir;
  }
  ctx.save();
  ctx.translate(x + w / 2 + panX, y + h / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
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

function weeksBetween(beforeDate: string | null, afterDate: string | null): number | null {
  if (!beforeDate || !afterDate) return null;
  const before = new Date(beforeDate.slice(0, 10));
  const after = new Date(afterDate.slice(0, 10));
  if (Number.isNaN(before.getTime()) || Number.isNaN(after.getTime())) return null;
  const diffMs = after.getTime() - before.getTime();
  if (diffMs < 0) return null;
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function weeksBetweenLabel(weeks: number): string {
  return weeks === 1 ? "1 week between" : `${weeks} weeks between`;
}

/** Label for export footer — null if dates missing or same-day. */
export function getWeeksBetweenLabel(
  beforeDate: string | null,
  afterDate: string | null
): string | null {
  const weeks = weeksBetween(beforeDate, afterDate);
  if (weeks == null || weeks <= 0) return null;
  return weeksBetweenLabel(weeks);
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
  const [beforeImg, afterImg] = await Promise.all([
    loadProgressImage(input.beforeImageUrl, options),
    loadProgressImage(input.afterImageUrl, options),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = SOCIAL_POST_WIDTH;
  canvas.height = SOCIAL_POST_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = VANA_CREAM;
  ctx.fillRect(0, 0, SOCIAL_POST_WIDTH, SOCIAL_POST_HEIGHT);

  const photoW = SOCIAL_POST_PHOTO_WIDTH;
  const photoH = SOCIAL_POST_PHOTO_SLOT_HEIGHT;
  const photoY = SOCIAL_EXPORT_PAD;
  const leftX = SOCIAL_EXPORT_PAD;
  const rightX = leftX + photoW + SOCIAL_EXPORT_PHOTO_GAP;
  const radius = SOCIAL_EXPORT_CORNER_RADIUS;

  const slots: Array<{
    img: HTMLImageElement;
    label: string;
    date: string | null;
    x: number;
    align?: PhotoSlotAlignment;
  }> = [
    {
      img: beforeImg,
      label: "Before",
      date: input.beforeDate,
      x: leftX,
      align: input.beforeAlign,
    },
    {
      img: afterImg,
      label: "After",
      date: input.afterDate,
      x: rightX,
      align: input.afterAlign,
    },
  ];

  for (const slot of slots) {
    ctx.fillStyle = VANA_SURFACE;
    roundRect(ctx, slot.x, photoY, photoW, photoH, radius);
    ctx.fill();

    ctx.save();
    roundRect(ctx, slot.x, photoY, photoW, photoH, radius);
    ctx.clip();
    drawImageContain(ctx, slot.img, slot.x, photoY, photoW, photoH, slot.align);
    ctx.restore();

    ctx.strokeStyle = VANA_GOLD;
    ctx.lineWidth = 3;
    roundRect(ctx, slot.x, photoY, photoW, photoH, radius);
    ctx.stroke();
  }

  const footerTop = photoY + photoH + 28;
  for (const slot of slots) {
    const cx = slot.x + photoW / 2;

    ctx.fillStyle = VANA_TEXT;
    ctx.font = "600 32px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(slot.label, cx, footerTop);

    if (slot.date) {
      ctx.fillStyle = VANA_MUTED;
      ctx.font = "500 26px system-ui, -apple-system, sans-serif";
      ctx.fillText(formatDateDisplay(slot.date.slice(0, 10)), cx, footerTop + 40);
    }
  }

  if (input.showWeeksBetween !== false) {
    const weeks = weeksBetween(input.beforeDate, input.afterDate);
    if (weeks != null && weeks > 0) {
      ctx.fillStyle = VANA_GOLD;
      ctx.font = "600 28px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(weeksBetweenLabel(weeks), SOCIAL_POST_WIDTH / 2, footerTop + 96);
    }
  }

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

export async function socialPostCanvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png", 1);
  });
}

export function socialPostFilename(input: ProgressSocialPostInput): string {
  const pose = sanitizeFilename(input.poseLabel);
  const client = sanitizeFilename(input.clientName) || "client";
  return `${client}-${pose}-before-after.png`;
}

export async function downloadProgressSocialPost(
  input: ProgressSocialPostInput,
  options?: ProgressSocialPostOptions
): Promise<void> {
  const canvas = await generateProgressSocialPostCanvas(input, options);
  const blob = await socialPostCanvasToPngBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = socialPostFilename(input);
  a.click();
  URL.revokeObjectURL(url);
}
