/** Shared options for exercise forms and filters. */

export const CATEGORY_OPTIONS = ["Strength", "Cardio", "Mobility", "Flexibility", "Other"] as const;
export const EQUIPMENT_OPTIONS = ["Bodyweight", "Dumbbells", "Kettlebell", "Resistance Band", "Barbell", "Machine", "Cable", "Other"] as const;
export const MUSCLE_GROUP_OPTIONS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Core", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Hip flexors", "Other",
] as const;
export const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
export const MOVEMENT_PATTERN_OPTIONS = ["Squat", "Hinge", "Push", "Pull", "Lunge", "Carry", "Rotational", "Other"] as const;
export const BODY_REGION_OPTIONS = ["Upper", "Lower", "Full body", "Core"] as const;

/** Convert newline-separated text to string[] (trim, no empty). */
export function textToLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert string[] to newline-separated text. */
export function linesToText(arr: string[]): string {
  return (arr ?? []).join("\n");
}
