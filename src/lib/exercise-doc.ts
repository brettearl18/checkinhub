/**
 * Build a Firestore exercise document from a payload (API POST or seed).
 * Ensures all categorisation fields (category, difficulty, movementPattern, bodyRegion, etc.) are stored.
 */

const toStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => String(x).trim()).filter(Boolean) : [];
const normalizeList = (v: unknown): string[] =>
  Array.isArray(v) ? toStrArray(v) : typeof v === "string" && v.trim() ? [v.trim()] : [];

const DIFFICULTY_VALUES = ["Beginner", "Intermediate", "Advanced"] as const;
const MOVEMENT_PATTERN_VALUES = ["Squat", "Hinge", "Push", "Pull", "Lunge", "Carry", "Rotational", "Other"] as const;
const BODY_REGION_VALUES = ["Upper", "Lower", "Full body", "Core"] as const;

function optionalStr(val: unknown, allowed?: readonly string[]): string {
  const s = typeof val === "string" ? val.trim() : "";
  if (allowed && s && !allowed.includes(s)) return "";
  return s;
}

export type ExercisePayload = {
  name: string;
  description?: string;
  category?: string;
  equipment?: string;
  primaryMuscleGroups?: string[] | string;
  secondaryMuscleGroups?: string[] | string;
  videoUrl?: string;
  imageUrl?: string;
  difficulty?: string;
  movementPattern?: string;
  isUnilateral?: boolean;
  isCompound?: boolean;
  bodyRegion?: string;
  coachingCues?: string[] | string;
  commonMistakes?: string[] | string;
  regressionOptions?: string[] | string;
  progressionOptions?: string[] | string;
  startingPosition?: string;
  tempo?: string;
  rangeOfMotionNotes?: string;
  safetyNotes?: string;
};

export function buildExerciseDoc(
  coachId: string,
  payload: ExercisePayload,
  now: Date = new Date()
): Record<string, unknown> {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  return {
    coachId,
    name,
    description: typeof payload.description === "string" ? payload.description.trim() : "",
    category: typeof payload.category === "string" ? payload.category.trim() : "",
    equipment: typeof payload.equipment === "string" ? payload.equipment.trim() : "",
    primaryMuscleGroups: toStrArray(payload.primaryMuscleGroups),
    secondaryMuscleGroups: toStrArray(payload.secondaryMuscleGroups),
    videoUrl: typeof payload.videoUrl === "string" ? payload.videoUrl.trim() || null : null,
    imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl.trim() || null : null,
    difficulty: optionalStr(payload.difficulty, DIFFICULTY_VALUES),
    movementPattern: optionalStr(payload.movementPattern, MOVEMENT_PATTERN_VALUES),
    isUnilateral: payload.isUnilateral === true,
    isCompound: payload.isCompound === true,
    bodyRegion: optionalStr(payload.bodyRegion, BODY_REGION_VALUES),
    coachingCues: normalizeList(payload.coachingCues),
    commonMistakes: normalizeList(payload.commonMistakes),
    regressionOptions: normalizeList(payload.regressionOptions),
    progressionOptions: normalizeList(payload.progressionOptions),
    startingPosition: typeof payload.startingPosition === "string" ? payload.startingPosition.trim() : "",
    tempo: typeof payload.tempo === "string" ? payload.tempo.trim() : "",
    rangeOfMotionNotes: typeof payload.rangeOfMotionNotes === "string" ? payload.rangeOfMotionNotes.trim() : "",
    safetyNotes: typeof payload.safetyNotes === "string" ? payload.safetyNotes.trim() : "",
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };
}
