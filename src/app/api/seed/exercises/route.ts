import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { buildExerciseDoc } from "@/lib/exercise-doc";
import { requireCoach } from "@/lib/api-auth";

/**
 * POST /api/seed/exercises
 * Dev-only: seed exercises from a JSON file (e.g. Part 1 - Upper.json) into Firestore.
 * All categorisation (category, difficulty, movementPattern, bodyRegion, etc.) is preserved.
 *
 * Body: { coachId?: string, source?: string, exercises?: ExercisePayload[] }
 * - coachId: optional – if omitted and you're logged in as coach, uses your coachId.
 * - source: optional – filename without .json (default "Part 1 - Upper"). File is read from project root.
 * - exercises: optional – pass the array directly instead of reading from file.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Seed only allowed in development" }, { status: 403 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT and run with a real backend." },
      { status: 503 }
    );
  }

  let body: { coachId?: string; source?: string; exercises?: unknown[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  let coachId = typeof body.coachId === "string" ? body.coachId.trim() : "";
  if (!coachId) {
    const authResult = await requireCoach(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: "coachId required, or log in as a coach to seed into your account." },
        { status: 401 }
      );
    }
    coachId = authResult.identity.coachId!;
  }

  let exercises: unknown[] = [];
  if (Array.isArray(body.exercises)) {
    exercises = body.exercises;
  } else {
    const source = typeof body.source === "string" ? body.source.trim() || "Part 1 - Upper" : "Part 1 - Upper";
    const filename = source.endsWith(".json") ? source : `${source}.json`;
    const filePath = path.join(process.cwd(), filename);
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      exercises = Array.isArray(data) ? data : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Failed to read ${filename}: ${message}. Ensure the file exists in the project root.` },
        { status: 400 }
      );
    }
  }

  const db = getAdminDb();
  const now = new Date();
  let seeded = 0;
  for (const item of exercises) {
    const payload = item as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) continue;
    const doc = buildExerciseDoc(coachId, payload as Parameters<typeof buildExerciseDoc>[1], now);
    await db.collection("exercises").add(doc);
    seeded++;
  }

  return NextResponse.json({
    ok: true,
    seeded,
    message: `Seeded ${seeded} exercises for coach ${coachId}. Categorisation (category, difficulty, movementPattern, bodyRegion, etc.) is stored.`,
  });
}
