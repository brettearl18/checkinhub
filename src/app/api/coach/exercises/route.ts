import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { buildExerciseDoc } from "@/lib/exercise-doc";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

const toStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => String(x).trim()).filter(Boolean) : [];

/** GET: list exercises for this coach. Optional ?category=&equipment=&search= */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "ex-1", name: "Squat", description: "Bodyweight squat", category: "Strength", equipment: "Bodyweight", primaryMuscleGroups: [], secondaryMuscleGroups: [], videoUrl: null, imageUrl: null, difficulty: "", movementPattern: "", isUnilateral: false, isCompound: true, bodyRegion: "", coachingCues: [], commonMistakes: [], regressionOptions: [], progressionOptions: [], startingPosition: "", tempo: "", rangeOfMotionNotes: "", safetyNotes: "", isCustom: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim() || null;
  const equipment = searchParams.get("equipment")?.trim() || null;
  const difficulty = searchParams.get("difficulty")?.trim() || null;
  const movementPattern = searchParams.get("movementPattern")?.trim() || null;
  const bodyRegion = searchParams.get("bodyRegion")?.trim() || null;
  const search = searchParams.get("search")?.trim()?.toLowerCase() || null;

  const db = getAdminDb();
  const snap = await db.collection("exercises").where("coachId", "==", coachId).get();
  let list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
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
  });

  if (category) list = list.filter((e) => e.category === category);
  if (equipment) list = list.filter((e) => e.equipment === equipment);
  if (difficulty) list = list.filter((e) => e.difficulty === difficulty);
  if (movementPattern) list = list.filter((e) => e.movementPattern === movementPattern);
  if (bodyRegion) list = list.filter((e) => e.bodyRegion === bodyRegion);
  if (search) {
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(search) ||
        (e.description && e.description.toLowerCase().includes(search))
    );
  }

  list.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
  return NextResponse.json(list);
}

/** POST: create exercise */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: {
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "ex-mock-1" });
  }

  const now = new Date();
  const doc = buildExerciseDoc(coachId, body, now);

  const ref = await getAdminDb().collection("exercises").add(doc);
  return NextResponse.json({
    id: ref.id,
    ...doc,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  });
}
