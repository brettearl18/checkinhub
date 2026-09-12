/** Height stored on clients as centimetres (AU coaching default). */

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;

export function parseHeightCm(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value * 10) / 10;
    return rounded;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 10) / 10;
  }
  return null;
}

export function isValidHeightCm(value: number | null | undefined): value is number {
  return typeof value === "number" && value >= HEIGHT_CM_MIN && value <= HEIGHT_CM_MAX;
}

/** Parse and validate user input; returns error message or null + height. */
export function normalizeHeightCmInput(
  raw: unknown
): { ok: true; heightCm: number } | { ok: false; error: string } {
  const parsed = parseHeightCm(raw);
  if (parsed == null) {
    return { ok: false, error: "Enter your height in centimetres (e.g. 165)." };
  }
  if (!isValidHeightCm(parsed)) {
    return {
      ok: false,
      error: `Height must be between ${HEIGHT_CM_MIN} and ${HEIGHT_CM_MAX} cm.`,
    };
  }
  return { ok: true, heightCm: parsed };
}

export function formatHeightCm(heightCm: number | null | undefined): string {
  if (!isValidHeightCm(heightCm ?? null)) return "—";
  return `${heightCm} cm`;
}
