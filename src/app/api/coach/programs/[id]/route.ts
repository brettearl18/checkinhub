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

function weeksToStorage(weeks: ProgramWeek[]): unknown[] {
  return weeks.map((w) => ({
    days: w.days.map((d) => ({
      name: d.name,
      blocks: d.blocks.map((b) => ({
        type: b.type,
        restSeconds: b.restSeconds,
        exercises: b.exercises.map((e, i) => ({ ...e, order: i })),
      })),
    })),
  }));
}

/** GET: single program (for edit) */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      id,
      name: "Sample program",
      description: "",
      durationWeeks: undefined,
      phaseName: undefined,
      weeks: [{ days: [{ name: "Day 1", blocks: [] }] }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const doc = await getAdminDb().collection("programs").doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  const data = doc.data()!;
  if ((data.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: doc.id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    durationWeeks: typeof data.durationWeeks === "number" ? data.durationWeeks : undefined,
    phaseName: typeof data.phaseName === "string" ? data.phaseName : undefined,
    weeks: normalizeWeeks(data.weeks),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  });
}

/** PATCH: update program */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  let body: {
    name?: string;
    description?: string;
    durationWeeks?: number;
    phaseName?: string;
    weeks?: unknown[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id });
  }

  const ref = getAdminDb().collection("programs").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if ((doc.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (body.durationWeeks !== undefined) updates.durationWeeks = typeof body.durationWeeks === "number" ? body.durationWeeks : undefined;
  if (body.phaseName !== undefined) updates.phaseName = typeof body.phaseName === "string" ? body.phaseName.trim() || undefined : undefined;
  if (body.weeks !== undefined) updates.weeks = weeksToStorage(normalizeWeeks(body.weeks));

  const updatesClean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) updatesClean[k] = v;
  }
  await ref.update(updatesClean);
  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({
    id: updated.id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    durationWeeks: typeof data.durationWeeks === "number" ? data.durationWeeks : undefined,
    phaseName: typeof data.phaseName === "string" ? data.phaseName : undefined,
    weeks: normalizeWeeks(data.weeks),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  });
}

/** DELETE: remove program */
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

  const ref = getAdminDb().collection("programs").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if ((doc.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
