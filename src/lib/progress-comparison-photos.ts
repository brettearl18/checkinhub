/** Same pose: before_* with matching after_* (front with front, etc.). */
const ANGLE_PAIRS = [
  { before: "before_front", after: "after_front" },
  { before: "before_side", after: "after_side" },
  { before: "before_back", after: "after_back" },
] as const;

const BEFORE_TYPES = new Set<string>(ANGLE_PAIRS.map((p) => p.before));
const AFTER_TYPES = new Set<string>(ANGLE_PAIRS.map((p) => p.after));

export type ProgressImageLike = {
  id: string;
  imageUrl: string;
  imageType: string | null;
  uploadedAt: string | null;
};

function sortUploadedAsc<T extends ProgressImageLike>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const c = (a.uploadedAt || "").localeCompare(b.uploadedAt || "");
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
}

/** Newest image whose URL differs from `excludeUrl` (stable order). */
function newestDifferentUrl<T extends ProgressImageLike>(sortedAsc: T[], excludeUrl: string): T | null {
  for (let i = sortedAsc.length - 1; i >= 0; i--) {
    const p = sortedAsc[i]!;
    if (p.imageUrl !== excludeUrl) return p;
  }
  return null;
}

/** First angle (front → side → back) where both before and after exist for that pose. */
function pickMatchedAnglePair<T extends ProgressImageLike>(
  images: T[]
): { baselinePhoto: T; currentPhoto: T } | null {
  for (const { before, after } of ANGLE_PAIRS) {
    const beforeRow = sortUploadedAsc(images.filter((p) => p.imageType === before));
    const afterRow = sortUploadedAsc(images.filter((p) => p.imageType === after));
    if (beforeRow.length === 0 || afterRow.length === 0) continue;

    const baselinePhoto = beforeRow[0]!;
    let currentPhoto = afterRow[afterRow.length - 1]!;
    if (baselinePhoto.imageUrl === currentPhoto.imageUrl) {
      const alt = newestDifferentUrl(afterRow, baselinePhoto.imageUrl);
      currentPhoto = alt ?? currentPhoto;
    }
    if (baselinePhoto.imageUrl === currentPhoto.imageUrl) {
      continue;
    }
    return { baselinePhoto, currentPhoto };
  }
  return null;
}

/** Same angle only: oldest vs newest `before_*` for that pose (no mixing with after_*). */
function pickSameAngleBeforeOnly<T extends ProgressImageLike>(images: T[]): { baselinePhoto: T; currentPhoto: T } | null {
  for (const { before } of ANGLE_PAIRS) {
    const row = sortUploadedAsc(images.filter((p) => p.imageType === before));
    if (row.length < 2) continue;
    const baselinePhoto = row[0]!;
    const currentPhoto = row[row.length - 1]!;
    if (baselinePhoto.imageUrl !== currentPhoto.imageUrl) {
      return { baselinePhoto, currentPhoto };
    }
  }
  return null;
}

function pickSameAngleAfterOnly<T extends ProgressImageLike>(images: T[]): { baselinePhoto: T; currentPhoto: T } | null {
  for (const { after } of ANGLE_PAIRS) {
    const row = sortUploadedAsc(images.filter((p) => p.imageType === after));
    if (row.length < 2) continue;
    const baselinePhoto = row[0]!;
    const currentPhoto = row[row.length - 1]!;
    if (baselinePhoto.imageUrl !== currentPhoto.imageUrl) {
      return { baselinePhoto, currentPhoto };
    }
  }
  return null;
}

/**
 * Pick “baseline” vs “current” progress photos for dashboards.
 * Prefer matching pose: before_front with after_front, then side, then back.
 * Untagged images: oldest vs newest with a different file URL.
 */
export function pickBaselineAndCurrentPhoto<T extends ProgressImageLike>(images: T[]): {
  baselinePhoto: T | null;
  currentPhoto: T | null;
} {
  if (images.length === 0) {
    return { baselinePhoto: null, currentPhoto: null };
  }

  const sortedAll = sortUploadedAsc(images);
  const beforeList = images.filter((p) => p.imageType != null && BEFORE_TYPES.has(p.imageType));
  const afterList = images.filter((p) => p.imageType != null && AFTER_TYPES.has(p.imageType));
  const hasTyped = beforeList.length > 0 || afterList.length > 0;

  if (hasTyped) {
    const matched = pickMatchedAnglePair(images);
    if (matched) {
      return { baselinePhoto: matched.baselinePhoto, currentPhoto: matched.currentPhoto };
    }

    const beforeOnly = pickSameAngleBeforeOnly(images);
    if (beforeOnly) {
      return { baselinePhoto: beforeOnly.baselinePhoto, currentPhoto: beforeOnly.currentPhoto };
    }

    const afterOnly = pickSameAngleAfterOnly(images);
    if (afterOnly) {
      return { baselinePhoto: afterOnly.baselinePhoto, currentPhoto: afterOnly.currentPhoto };
    }

    // Typed photos but no same-angle pair and no two-of-same-angle: show single oldest tagged, or first of each type without mixing angles
    if (beforeList.length > 0) {
      return { baselinePhoto: sortUploadedAsc(beforeList)[0]!, currentPhoto: null };
    }
    if (afterList.length > 0) {
      return { baselinePhoto: sortUploadedAsc(afterList)[0]!, currentPhoto: null };
    }
  }

  const first = sortedAll[0]!;
  const lastDistinct = newestDifferentUrl(sortedAll, first.imageUrl);
  if (!lastDistinct) {
    return { baselinePhoto: first, currentPhoto: null };
  }
  return { baselinePhoto: first, currentPhoto: lastDistinct };
}

/** Display label for stored `imageType` (e.g. coach gallery, raw API values). */
export function formatProgressImageTypeLabel(imageType: string | null | undefined): string {
  if (imageType == null || imageType === "") return "Photo";
  const map: Record<string, string> = {
    before_front: "Before (front)",
    before_side: "Before (side)",
    before_back: "Before (back)",
    after_front: "Current (front)",
    after_side: "Current (side)",
    after_back: "Current (back)",
    other: "Other",
  };
  if (map[imageType]) return map[imageType]!;
  return imageType.replace(/_/g, " ");
}

/** Human label for pose when `imageType` is `before_front` / `after_front`, etc. */
export function progressPhotoPoseLabel(imageType: string | null): string | null {
  if (!imageType) return null;
  if (imageType.endsWith("_front")) return "Front";
  if (imageType.endsWith("_side")) return "Side";
  if (imageType.endsWith("_back")) return "Back";
  return null;
}
