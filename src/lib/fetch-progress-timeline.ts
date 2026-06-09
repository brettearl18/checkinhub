import { getAdminDb } from "@/lib/firebase-admin";
import { buildProgressTimeline } from "@/lib/progress-timeline";
import { resolveThresholds } from "@/lib/scoring-utils";
import { HABIT_DEFINITIONS } from "@/lib/habits";
import { isGoalMet } from "@/lib/habits";
import { entriesByHabitAndDate, fetchClientHabitEntries } from "@/lib/habits-streaks";
import { toLocalDateString } from "@/lib/format-date";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const d = toDate(v);
  return d ? d.toISOString() : null;
}

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toLocalDateString(d);
}

async function buildWeekScoreFallback(
  db: ReturnType<typeof getAdminDb>,
  clientId: string
): Promise<Record<string, { score: number; responseId: string | null }>> {
  const responsesSnap = await db
    .collection("formResponses")
    .where("clientId", "==", clientId)
    .orderBy("submittedAt", "desc")
    .limit(50)
    .get();

  const assignmentIds = [
    ...new Set(
      responsesSnap.docs.map((d) => (d.data().assignmentId as string) ?? "").filter(Boolean)
    ),
  ];
  const assignmentSnaps = await Promise.all(
    assignmentIds.map((id) => db.collection("check_in_assignments").doc(id).get())
  );
  const reflectionWeekByAssignment = new Map<string, string>();
  for (const snap of assignmentSnaps) {
    if (!snap.exists) continue;
    const refWeek = (snap.data() as { reflectionWeekStart?: string }).reflectionWeekStart;
    if (refWeek && /^\d{4}-\d{2}-\d{2}$/.test(refWeek)) {
      reflectionWeekByAssignment.set(snap.id, refWeek);
    }
  }

  const weekScoreFallback: Record<string, { score: number; responseId: string | null }> = {};
  for (const doc of responsesSnap.docs) {
    const r = doc.data();
    const score = typeof r.score === "number" ? Math.round(r.score) : null;
    if (score == null) continue;
    const submittedAt = toDate(r.submittedAt);
    if (!submittedAt) continue;
    const assignmentId = (r.assignmentId as string) ?? "";
    const weekKey =
      reflectionWeekByAssignment.get(assignmentId) || getMondayOf(submittedAt);
    if (weekScoreFallback[weekKey] == null) {
      weekScoreFallback[weekKey] = { score, responseId: doc.id };
    }
  }
  return weekScoreFallback;
}

async function buildHabitsHistory(db: ReturnType<typeof getAdminDb>, clientId: string) {
  const docs = await fetchClientHabitEntries(db, clientId);
  const byHabit = entriesByHabitAndDate(docs);
  const historyDays = 730;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - historyDays + 1);
  const byDate: Record<string, Record<string, "met" | "missed">> = {};
  for (let i = 0; i < historyDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    byDate[dateStr] = {};
    for (const h of HABIT_DEFINITIONS) {
      const value = byHabit.get(h.id)?.get(dateStr);
      if (value == null) continue;
      byDate[dateStr][h.id] = isGoalMet(h.id, value) ? "met" : "missed";
    }
  }
  return {
    habitIds: HABIT_DEFINITIONS.map((h) => h.id),
    byDate,
  };
}

export async function fetchProgressTimelineForClient(
  clientId: string,
  options?: { extraClientIds?: string[] }
) {
  const db = getAdminDb();
  const idsToQuery = [clientId, ...(options?.extraClientIds ?? [])].filter(
    (id, i, arr) => arr.indexOf(id) === i
  );

  const [measSnap, imagesSnap, scoringSnap, weekScoreFallback, habits, ...checkInSnaps] =
    await Promise.all([
      db
        .collection("client_measurements")
        .where("clientId", "==", clientId)
        .orderBy("date", "desc")
        .limit(100)
        .get(),
      db
        .collection("progress_images")
        .where("clientId", "==", clientId)
        .orderBy("uploadedAt", "desc")
        .get(),
      db.collection("clientScoring").doc(clientId).get(),
      buildWeekScoreFallback(db, clientId),
      buildHabitsHistory(db, clientId),
      ...idsToQuery.map((id) =>
        db
          .collection("check_in_assignments")
          .where("clientId", "==", id)
          .where("status", "==", "completed")
          .orderBy("completedAt", "desc")
          .limit(50)
          .get()
      ),
    ]);

  const scoringData = scoringSnap.exists
    ? (scoringSnap.data() as {
        thresholds?: { redMax?: number; orangeMax?: number };
        scoringProfile?: string;
      })
    : null;
  const { redMax: trafficLightRedMax, orangeMax: trafficLightOrangeMax } = resolveThresholds({
    clientScoring: scoringData ?? undefined,
  });

  const measurements = measSnap.docs.map((d) => {
    const data = d.data();
    const date = data.date?.toDate?.() ?? data.date;
    return {
      id: d.id,
      date: date ? new Date(date).toISOString().slice(0, 10) : null,
      bodyWeight: data.bodyWeight ?? null,
      measurements: data.measurements ?? {},
      isBaseline: data.isBaseline ?? false,
    };
  });

  const photos = imagesSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      imageUrl: data.imageUrl as string,
      imageType: (data.imageType as string | null) ?? null,
      uploadedAt: toIso(data.uploadedAt),
    };
  });

  const seenCheckIns = new Set<string>();
  const checkIns: Array<{
    id: string;
    formTitle?: string;
    score: number | null;
    completedAt: string | null;
    reflectionWeekStart?: string | null;
    responseId?: string | null;
  }> = [];

  for (const snap of checkInSnaps) {
    for (const doc of snap.docs) {
      if (seenCheckIns.has(doc.id)) continue;
      seenCheckIns.add(doc.id);
      const d = doc.data();
      checkIns.push({
        id: doc.id,
        formTitle: (d.formTitle as string) ?? "Check-in",
        score: typeof d.score === "number" ? d.score : null,
        completedAt: toIso(d.completedAt),
        reflectionWeekStart: (d.reflectionWeekStart as string) ?? null,
        responseId: (d.responseId as string) ?? null,
      });
    }
  }

  const weeks = buildProgressTimeline(
    checkIns,
    measurements,
    photos,
    habits,
    weekScoreFallback
  );

  return { weeks, trafficLightRedMax, trafficLightOrangeMax };
}
