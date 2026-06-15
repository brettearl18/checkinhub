export const PROGRESS_PHOTO_IMAGE_TYPES = [
  "before_front",
  "before_side",
  "before_back",
  "after_front",
  "after_side",
  "after_back",
  "before",
  "progress",
  "after",
  "other",
] as const;

export type ProgressPhotoImageType = (typeof PROGRESS_PHOTO_IMAGE_TYPES)[number];

export const PROGRESS_PHOTO_TYPE_OPTIONS: { value: ProgressPhotoImageType; label: string }[] = [
  { value: "before_front", label: "Baseline — front" },
  { value: "before_back", label: "Baseline — back" },
  { value: "before_side", label: "Baseline — side" },
  { value: "after_front", label: "Current — front" },
  { value: "after_back", label: "Current — back" },
  { value: "after_side", label: "Current — side" },
  { value: "before", label: "Before (legacy)" },
  { value: "after", label: "Current (legacy)" },
  { value: "progress", label: "Progress (legacy)" },
  { value: "other", label: "Other" },
];

export function isAllowedProgressPhotoImageType(value: string): value is ProgressPhotoImageType {
  return (PROGRESS_PHOTO_IMAGE_TYPES as readonly string[]).includes(value);
}
