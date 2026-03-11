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
  return exercises.map((ex, i) => {
    const e = normalizeEx(ex, i);
    return e ? { type: "straight_sets" as const, restSeconds: undefined, exercises: [e] } : null;
  }).filter((b): b is ProgramBlock => b != null);
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

/** Firestore: strip undefined from nested objects. */
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

/** GET: current program assignment for this client (coach view). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json(null);
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const assignment = await db.collection("client_programs").doc(clientId).get();
  if (!assignment.exists) {
    return NextResponse.json(null);
  }
  const data = assignment.data()!;
  return NextResponse.json({
    clientId: data.clientId,
    coachId: data.coachId,
    programId: data.programId,
    programName: data.programName,
    programSnapshot: data.programSnapshot,
    startDate: typeof data.startDate === "string" ? data.startDate : toIso(data.startDate),
    currentWeek: typeof data.currentWeek === "number" ? data.currentWeek : 1,
    status: (data.status as string) ?? "active",
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  });
}

/** POST: assign (or reassign) program to client. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: { programId: string; startDate: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { programId, startDate, status } = body;
  if (!programId || !startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json(
      { error: "programId and startDate (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({
      clientId,
      programId,
      startDate,
      currentWeek: 1,
      status: status ?? "active",
    });
  }

  const db = getAdminDb();

  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const programSnap = await db.collection("programs").doc(programId).get();
  if (!programSnap.exists) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  const programData = programSnap.data()!;
  if ((programData.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const weeks = normalizeWeeks(programData.weeks);
  const exerciseIds = new Set<string>();
  for (const w of weeks) {
    for (const d of w.days) {
      for (const b of d.blocks) {
        for (const e of b.exercises) exerciseIds.add(e.exerciseId);
      }
    }
  }

  const exerciseSnap = await db.collection("exercises").where("coachId", "==", coachId).get();
  const exerciseMap: Record<string, { name: string; videoUrl?: string; imageUrl?: string }> = {};
  for (const d of exerciseSnap.docs) {
    if (exerciseIds.has(d.id)) {
      const x = d.data();
      exerciseMap[d.id] = {
        name: (x.name as string) ?? "Exercise",
        videoUrl: typeof x.videoUrl === "string" ? x.videoUrl : undefined,
        imageUrl: typeof x.imageUrl === "string" ? x.imageUrl : undefined,
      };
    }
  }

  type SnapshotExercise = { exerciseId: string; exerciseName: string; sets?: string; reps?: string; notes?: string; videoUrl?: string; imageUrl?: string };
  type SnapshotBlock = { type: string; restSeconds?: number; exercises: SnapshotExercise[] };
  type SnapshotDay = { name?: string; blocks: SnapshotBlock[] };
  type SnapshotWeek = { days: SnapshotDay[] };

  const programSnapshot: SnapshotWeek[] = weeks.map((w) => ({
    days: w.days.map((d) => ({
      name: d.name,
      blocks: d.blocks.map((b) => ({
        type: b.type,
        ...(typeof b.restSeconds === "number" && b.restSeconds >= 0 ? { restSeconds: b.restSeconds } : {}),
        exercises: b.exercises.map((e) => {
          const info = exerciseMap[e.exerciseId] ?? { name: "Exercise" };
          const ex: SnapshotExercise = {
            exerciseId: e.exerciseId,
            exerciseName: info.name,
            ...(e.sets != null && e.sets !== "" ? { sets: e.sets } : {}),
            ...(e.reps != null && e.reps !== "" ? { reps: e.reps } : {}),
            ...(e.notes != null && e.notes !== "" ? { notes: e.notes } : {}),
          };
          if (info.videoUrl) ex.videoUrl = info.videoUrl;
          if (info.imageUrl) ex.imageUrl = info.imageUrl;
          return ex;
        }),
      })),
    })),
  }));

  const now = new Date();
  const doc = stripUndefined({
    clientId,
    coachId,
    programId,
    programName: (programData.name as string) ?? "",
    programSnapshot,
    startDate,
    currentWeek: 1,
    status: status === "paused" || status === "completed" ? status : "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("client_programs").doc(clientId).set(doc);

  return NextResponse.json({
    clientId,
    programId,
    programName: doc.programName,
    startDate,
    currentWeek: 1,
    status: doc.status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}
