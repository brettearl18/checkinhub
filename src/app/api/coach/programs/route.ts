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

type ProgramExercise = { exerciseId: string; sets?: string; reps?: string; notes?: string; order?: number };
type ProgramBlock = { type: "straight_sets" | "superset" | "circuit"; restSeconds?: number; exercises: ProgramExercise[] };
type ProgramDay = { name?: string; blocks: ProgramBlock[] };
type ProgramWeek = { days: ProgramDay[] };

function normalizeEx(ex: unknown, i: number): ProgramExercise | null {
  const e = ex as Record<string, unknown>;
  const exerciseId = typeof e.exerciseId === "string" ? e.exerciseId : "";
  if (!exerciseId) return null;
  return {
    exerciseId,
    sets: typeof e.sets === "string" ? e.sets.trim() : undefined,
    reps: typeof e.reps === "string" ? e.reps.trim() : undefined,
    notes: typeof e.notes === "string" ? e.notes.trim() : undefined,
    order: typeof e.order === "number" ? e.order : i,
  };
}

function normalizeBlock(block: unknown): ProgramBlock | null {
  const b = block as Record<string, unknown>;
  const type = (b.type === "superset" || b.type === "circuit") ? b.type : "straight_sets";
  const exercises = Array.isArray(b.exercises)
    ? b.exercises.map((ex: unknown, i: number) => normalizeEx(ex, i)).filter((e): e is ProgramExercise => e != null)
    : [];
  if (exercises.length === 0) return null;
  const restSeconds = typeof b.restSeconds === "number" && b.restSeconds >= 0 ? b.restSeconds : undefined;
  return { type, restSeconds, exercises };
}

function dayToBlocks(day: { exercises?: unknown[]; blocks?: unknown[] }): ProgramBlock[] {
  const blocks = Array.isArray(day.blocks) ? day.blocks : [];
  const normalized = blocks.map(normalizeBlock).filter((b): b is ProgramBlock => b != null);
  if (normalized.length > 0) return normalized;
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  const result: ProgramBlock[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const e = normalizeEx(exercises[i], i);
    if (e) result.push({ type: "straight_sets", restSeconds: undefined, exercises: [e] });
  }
  return result;
}

function normalizeWeeks(weeks: unknown): ProgramWeek[] {
  if (!Array.isArray(weeks)) return [];
  return weeks.map((w) => {
    const week = w as { days?: unknown[] };
    const days = Array.isArray(week.days) ? week.days : [];
    return {
      days: days.map((d: unknown) => {
        const day = d as { name?: string; exercises?: unknown[]; blocks?: unknown[] };
        return {
          name: typeof day.name === "string" ? day.name.trim() : undefined,
          blocks: dayToBlocks(day),
        };
      }),
    };
  });
}

/** Firestore does not allow undefined; strip it from nested objects. */
function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) out[k] = stripUndefined(v);
  }
  return out as T;
}

function weeksToStorage(weeks: ProgramWeek[]): unknown[] {
  return weeks.map((w) => ({
    days: w.days.map((d) => ({
      name: d.name,
      blocks: d.blocks.map((b) => ({
        type: b.type,
        ...(typeof b.restSeconds === "number" && b.restSeconds >= 0 ? { restSeconds: b.restSeconds } : {}),
        exercises: b.exercises.map((e, i) => {
          const ex: Record<string, unknown> = { exerciseId: e.exerciseId, order: i };
          if (e.sets != null && e.sets !== "") ex.sets = e.sets;
          if (e.reps != null && e.reps !== "") ex.reps = e.reps;
          if (e.notes != null && e.notes !== "") ex.notes = e.notes;
          return ex;
        }),
      })),
    })),
  }));
}

/** GET: list programs for this coach */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const snap = await getAdminDb()
    .collection("programs")
    .where("coachId", "==", coachId)
    .get();

  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) ?? "",
      description: (data.description as string) ?? "",
      durationWeeks: typeof data.durationWeeks === "number" ? data.durationWeeks : undefined,
      phaseName: typeof data.phaseName === "string" ? data.phaseName : undefined,
      weeks: normalizeWeeks(data.weeks),
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    };
  });

  list.sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });
  return NextResponse.json(list);
}

/** POST: create program */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: { name?: string; description?: string; durationWeeks?: number; phaseName?: string; weeks?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const now = new Date();
  const weeksNorm = normalizeWeeks(body.weeks ?? []);
  const docRaw = {
    coachId,
    name,
    description: typeof body.description === "string" ? body.description.trim() : "",
    durationWeeks: typeof body.durationWeeks === "number" ? body.durationWeeks : undefined,
    phaseName: typeof body.phaseName === "string" ? body.phaseName.trim() || undefined : undefined,
    weeks: weeksToStorage(weeksNorm),
    createdAt: now,
    updatedAt: now,
  };
  const doc = stripUndefined(docRaw) as typeof docRaw;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      id: "prog-mock-1",
      name: docRaw.name,
      description: docRaw.description,
      durationWeeks: docRaw.durationWeeks,
      phaseName: docRaw.phaseName,
      weeks: weeksNorm,
      createdAt: docRaw.createdAt.toISOString(),
      updatedAt: docRaw.updatedAt.toISOString(),
    });
  }

  const ref = await getAdminDb().collection("programs").add(doc);
  return NextResponse.json({
    id: ref.id,
    name: doc.name,
    description: doc.description,
    durationWeeks: doc.durationWeeks,
    phaseName: doc.phaseName,
    weeks: weeksNorm,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
