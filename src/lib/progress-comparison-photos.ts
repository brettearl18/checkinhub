/** Same pose: before_* with matching after_* (front with front, etc.). */
const ANGLE_PAIRS = [
  { before: "before_front", after: "after_front" },
  { before: "before_back", after: "after_back" },
  { before: "before_side", after: "after_side" },
] as const;

const BEFORE_TYPES = new Set<string>(ANGLE_PAIRS.map((p) => p.before));
const AFTER_TYPES = new Set<string>(ANGLE_PAIRS.map((p) => p.after));

export type ProgressImageLike = {
  id: string;
  imageUrl: string;
  imageType: string | null;
  uploadedAt: string | null;
  orientation?: string | null;
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

/** First angle (front → back → side) where both before and after exist for that pose. */
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
    before: "Before",
    progress: "Progress",
    after: "Current",
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

export type ProgressPhotoPose = "front" | "side" | "back";

export type ProgressPhotoMilestone = "latest" | "previous" | "first_baseline";

/** Column order for compare grid and gallery rows */
export const PROGRESS_PHOTO_POSES: ProgressPhotoPose[] = ["front", "back", "side"];

const POSE_SORT_ORDER: Record<ProgressPhotoPose, number> = {
  front: 0,
  back: 1,
  side: 2,
};

function poseSortIndexForImage<T extends ProgressImageLike>(
  image: T,
  legacyAssignment: Map<string, ProgressPhotoPose>
): number {
  const pose = resolveProgressPhotoPose(image) ?? legacyAssignment.get(image.id);
  if (pose) return POSE_SORT_ORDER[pose];
  const type = (image.imageType ?? "").toLowerCase();
  if (type.includes("front")) return 0;
  if (type.includes("back")) return 1;
  if (type.includes("side")) return 2;
  return 99;
}

/** Sort photos front → back → side, then newest first within each angle. */
export function sortProgressPhotosByPoseThenDate<T extends ProgressImageLike>(images: T[]): T[] {
  const legacyAssignment = buildLegacyPoseAssignment(images);
  return [...images].sort((a, b) => {
    const poseDiff =
      poseSortIndexForImage(a, legacyAssignment) - poseSortIndexForImage(b, legacyAssignment);
    if (poseDiff !== 0) return poseDiff;
    const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return tb - ta;
  });
}

/** Latest photo for each pose in front → back → side order (max 3). */
export function getLatestProgressPhotoPerPose<T extends ProgressImageLike>(images: T[]): T[] {
  const legacyAssignment = buildLegacyPoseAssignment(images);
  return PROGRESS_PHOTO_POSES.map((pose) =>
    getProgressPhotoForMilestone(images, pose, "latest", legacyAssignment)
  ).filter((img): img is T => img != null);
}

/** Row order for compare grid (newest milestones first) */
export const PROGRESS_PHOTO_COMPARE_ROWS: ProgressPhotoMilestone[] = [
  "latest",
  "previous",
  "first_baseline",
];

const POSE_TYPE_KEYS: Record<ProgressPhotoPose, { before: string; after: string }> = {
  front: { before: "before_front", after: "after_front" },
  side: { before: "before_side", after: "after_side" },
  back: { before: "before_back", after: "after_back" },
};

const LEGACY_UNTAGGED_TYPES = new Set(["", "before", "progress", "after", "other"]);

function isTypedPosePhoto(imageType: string | null | undefined): boolean {
  if (!imageType) return false;
  return ANGLE_PAIRS.some(({ before, after }) => imageType === before || imageType === after);
}

function normalizeOrientation(value: string | null | undefined): ProgressPhotoPose | null {
  if (!value) return null;
  const s = value.toLowerCase().trim();
  if (s === "front") return "front";
  if (s === "back") return "back";
  if (s === "side") return "side";
  return null;
}

/** Pose from `before_front`-style types or legacy `orientation` field. */
export function resolveProgressPhotoPose(image: ProgressImageLike): ProgressPhotoPose | null {
  const type = (image.imageType ?? "").toLowerCase();
  if (type.endsWith("_front")) return "front";
  if (type.endsWith("_back")) return "back";
  if (type.endsWith("_side")) return "side";
  return normalizeOrientation(image.orientation);
}

/** Assign legacy uploads (e.g. `before`, `progress`) to Front / Back / Side in upload order. */
export function buildLegacyPoseAssignment<T extends ProgressImageLike>(
  images: T[]
): Map<string, ProgressPhotoPose> {
  const map = new Map<string, ProgressPhotoPose>();
  const needsAssignment = sortUploadedAsc(
    images.filter((img) => {
      if (isTypedPosePhoto(img.imageType)) return false;
      if (resolveProgressPhotoPose(img)) return false;
      const t = (img.imageType ?? "").toLowerCase();
      return LEGACY_UNTAGGED_TYPES.has(t);
    })
  );
  needsAssignment.forEach((img, i) => {
    map.set(img.id, PROGRESS_PHOTO_POSES[i % PROGRESS_PHOTO_POSES.length]!);
  });
  return map;
}

function getPhotosForPose<T extends ProgressImageLike>(
  images: T[],
  pose: ProgressPhotoPose,
  legacyAssignment: Map<string, ProgressPhotoPose>
): T[] {
  const { before, after } = POSE_TYPE_KEYS[pose];
  return sortUploadedAsc(
    images.filter((img) => {
      if (img.imageType === before || img.imageType === after) return true;
      const canonical = resolveProgressPhotoPose(img);
      if (canonical === pose && !isTypedPosePhoto(img.imageType)) return true;
      return legacyAssignment.get(img.id) === pose;
    })
  );
}

export function progressPhotoMilestoneLabel(milestone: ProgressPhotoMilestone): string {
  const map: Record<ProgressPhotoMilestone, string> = {
    latest: "Latest",
    previous: "Previous",
    first_baseline: "Baseline",
  };
  return map[milestone];
}

export function progressPhotoPoseTabLabel(pose: ProgressPhotoPose): string {
  const map: Record<ProgressPhotoPose, string> = {
    front: "Front",
    side: "Side",
    back: "Back",
  };
  return map[pose];
}

/** Pick one progress photo for a pose + milestone (typed + legacy types, chronological). */
export function getProgressPhotoForMilestone<T extends ProgressImageLike>(
  images: T[],
  pose: ProgressPhotoPose,
  milestone: ProgressPhotoMilestone,
  legacyAssignment?: Map<string, ProgressPhotoPose>
): T | null {
  const assignment = legacyAssignment ?? buildLegacyPoseAssignment(images);
  const combined = getPhotosForPose(images, pose, assignment);

  if (milestone === "first_baseline") {
    return combined[0] ?? null;
  }
  if (milestone === "latest") {
    return combined[combined.length - 1] ?? null;
  }
  if (milestone === "previous") {
    return combined.length >= 2 ? combined[combined.length - 2]! : null;
  }
  return null;
}

/** True when at least one photo exists for this pose (any milestone). */
export function hasProgressPhotosForPose<T extends ProgressImageLike>(
  images: T[],
  pose: ProgressPhotoPose,
  legacyAssignment?: Map<string, ProgressPhotoPose>
): boolean {
  const assignment = legacyAssignment ?? buildLegacyPoseAssignment(images);
  return getPhotosForPose(images, pose, assignment).length > 0;
}
