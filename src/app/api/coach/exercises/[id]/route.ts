import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

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

function exerciseToJson(data: Record<string, unknown>, id: string) {
  return {
    id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    category: (data.category as string) ?? "",
    equipment: (data.equipment as string) ?? "",
    primaryMuscleGroups: toStrArray(data.primaryMuscleGroups),
    secondaryMuscleGroups: toStrArray(data.secondaryMuscleGroups),
    videoUrl: (data.videoUrl as string) ?? null,
    imageUrl: (data.imageUrl as string) ?? null,
    difficulty: (data.difficulty as string) ?? "",
    movementPattern: (data.movementPattern as string) ?? "",
    isUnilateral: data.isUnilateral === true,
    isCompound: data.isCompound === true,
    bodyRegion: (data.bodyRegion as string) ?? "",
    coachingCues: toStrArray(data.coachingCues),
    commonMistakes: toStrArray(data.commonMistakes),
    regressionOptions: toStrArray(data.regressionOptions),
    progressionOptions: toStrArray(data.progressionOptions),
    startingPosition: (data.startingPosition as string) ?? "",
    tempo: (data.tempo as string) ?? "",
    rangeOfMotionNotes: (data.rangeOfMotionNotes as string) ?? "",
    safetyNotes: (data.safetyNotes as string) ?? "",
    isCustom: data.isCustom === true,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/** GET: single exercise (for edit) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json(
      exerciseToJson(
        {
          name: "Squat",
          description: "Bodyweight squat",
          category: "Strength",
          equipment: "Bodyweight",
          primaryMuscleGroups: [],
          secondaryMuscleGroups: [],
          videoUrl: null,
          imageUrl: null,
          difficulty: "",
          movementPattern: "",
          isUnilateral: false,
          isCompound: true,
          bodyRegion: "",
          coachingCues: [],
          commonMistakes: [],
          regressionOptions: [],
          progressionOptions: [],
          startingPosition: "",
          tempo: "",
          rangeOfMotionNotes: "",
          safetyNotes: "",
          isCustom: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        id
      )
    );
  }

  const doc = await getAdminDb().collection("exercises").doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }
  const data = doc.data()!;
  if ((data.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(exerciseToJson(data, doc.id));
}

/** PATCH: update exercise */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  const toStrArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => String(x).trim()).filter(Boolean) : [];
  let body: {
    name?: string;
    description?: string;
    category?: string;
    equipment?: string;
    primaryMuscleGroups?: string[];
    secondaryMuscleGroups?: string[];
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id });
  }

  const ref = getAdminDb().collection("exercises").doc(id);
  const docSnap = await ref.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }
  if ((docSnap.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (typeof body.category === "string") updates.category = body.category.trim();
  if (typeof body.equipment === "string") updates.equipment = body.equipment.trim();
  if (body.videoUrl !== undefined) updates.videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() || null : null;
  if (body.imageUrl !== undefined) updates.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
  if (body.primaryMuscleGroups !== undefined) updates.primaryMuscleGroups = toStrArray(body.primaryMuscleGroups);
  if (body.secondaryMuscleGroups !== undefined) updates.secondaryMuscleGroups = toStrArray(body.secondaryMuscleGroups);
  if (body.difficulty !== undefined) updates.difficulty = optionalStr(body.difficulty, DIFFICULTY_VALUES);
  if (body.movementPattern !== undefined) updates.movementPattern = optionalStr(body.movementPattern, MOVEMENT_PATTERN_VALUES);
  if (body.isUnilateral !== undefined) updates.isUnilateral = body.isUnilateral === true;
  if (body.isCompound !== undefined) updates.isCompound = body.isCompound === true;
  if (body.bodyRegion !== undefined) updates.bodyRegion = optionalStr(body.bodyRegion, BODY_REGION_VALUES);
  if (body.coachingCues !== undefined) updates.coachingCues = normalizeList(body.coachingCues);
  if (body.commonMistakes !== undefined) updates.commonMistakes = normalizeList(body.commonMistakes);
  if (body.regressionOptions !== undefined) updates.regressionOptions = normalizeList(body.regressionOptions);
  if (body.progressionOptions !== undefined) updates.progressionOptions = normalizeList(body.progressionOptions);
  if (body.startingPosition !== undefined) updates.startingPosition = typeof body.startingPosition === "string" ? body.startingPosition.trim() : "";
  if (body.tempo !== undefined) updates.tempo = typeof body.tempo === "string" ? body.tempo.trim() : "";
  if (body.rangeOfMotionNotes !== undefined) updates.rangeOfMotionNotes = typeof body.rangeOfMotionNotes === "string" ? body.rangeOfMotionNotes.trim() : "";
  if (body.safetyNotes !== undefined) updates.safetyNotes = typeof body.safetyNotes === "string" ? body.safetyNotes.trim() : "";

  await ref.update(updates);
  const updated = await ref.get();
  return NextResponse.json(exerciseToJson(updated.data()!, updated.id));
}

/** DELETE: remove exercise */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const ref = getAdminDb().collection("exercises").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }
  if ((doc.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
