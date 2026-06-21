import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  CYCLE_DAILY_LOGS_COLLECTION,
  CYCLE_PROFILES_COLLECTION,
  eachDateInclusive,
  parseCycleRegularity,
  parsePeriodRecords,
  type CycleDailyLog,
  type CyclePeriodRecord,
  type CycleProfile,
  defaultCycleProfile,
} from "@/lib/cycle-tracking";

function parsePeriodHistory(data: DocumentData | undefined): CyclePeriodRecord[] {
  if (!data || !Array.isArray(data.periodHistory)) return [];
  return parsePeriodRecords(data.periodHistory);
}

/** Firestore rejects undefined field values — write an explicit document shape. */
function cycleProfileToFirestore(profile: CycleProfile, now: Date): Record<string, unknown> {
  return {
    clientId: profile.clientId,
    trackingEnabled: profile.trackingEnabled,
    shareWithCoach: profile.shareWithCoach,
    shareNotesWithCoach: profile.shareNotesWithCoach,
    averageCycleLength: profile.averageCycleLength,
    averagePeriodLength: profile.averagePeriodLength,
    lastPeriodStart: profile.lastPeriodStart,
    lastPeriodEnd: profile.lastPeriodEnd,
    periodHistory: profile.periodHistory.map((p) => ({ start: p.start, end: p.end })),
    trackSexualActivity: profile.trackSexualActivity,
    cycleRegularity: profile.cycleRegularity,
    onHormonalBirthControl: profile.onHormonalBirthControl,
    computedCycleLengthMin: profile.computedCycleLengthMin,
    computedCycleLengthMax: profile.computedCycleLengthMax,
    setupCompleted: profile.setupCompleted,
    cyclePromoDismissedAt: profile.cyclePromoDismissedAt,
    cycleDashboardBannerDismissedAt: profile.cycleDashboardBannerDismissedAt,
    optedInAt: profile.optedInAt ?? null,
    setupCompletedAt: profile.setupCompletedAt ?? null,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };
}

function profileFromDoc(clientId: string, data: DocumentData | undefined): CycleProfile {
  const base = defaultCycleProfile(clientId);
  if (!data) return base;
  return {
    clientId,
    trackingEnabled: Boolean(data.trackingEnabled),
    shareWithCoach: Boolean(data.shareWithCoach),
    shareNotesWithCoach: Boolean(data.shareNotesWithCoach),
    averageCycleLength:
      typeof data.averageCycleLength === "number" && data.averageCycleLength >= 21 && data.averageCycleLength <= 45
        ? Math.round(data.averageCycleLength)
        : base.averageCycleLength,
    averagePeriodLength:
      typeof data.averagePeriodLength === "number" &&
      data.averagePeriodLength >= 2 &&
      data.averagePeriodLength <= 14
        ? Math.round(data.averagePeriodLength)
        : base.averagePeriodLength,
    lastPeriodStart:
      typeof data.lastPeriodStart === "string" && data.lastPeriodStart.trim()
        ? data.lastPeriodStart.trim()
        : null,
    lastPeriodEnd:
      typeof data.lastPeriodEnd === "string" && data.lastPeriodEnd.trim()
        ? data.lastPeriodEnd.trim()
        : null,
    periodHistory: parsePeriodHistory(data),
    trackSexualActivity: Boolean(data.trackSexualActivity),
    cycleRegularity: parseCycleRegularity(data.cycleRegularity),
    onHormonalBirthControl:
      typeof data.onHormonalBirthControl === "boolean" ? data.onHormonalBirthControl : null,
    computedCycleLengthMin:
      typeof data.computedCycleLengthMin === "number" ? Math.round(data.computedCycleLengthMin) : null,
    computedCycleLengthMax:
      typeof data.computedCycleLengthMax === "number" ? Math.round(data.computedCycleLengthMax) : null,
    setupCompleted:
      typeof data.setupCompleted === "boolean"
        ? data.setupCompleted
        : Boolean(data.lastPeriodStart),
    cyclePromoDismissedAt:
      typeof data.cyclePromoDismissedAt === "string" && data.cyclePromoDismissedAt.trim()
        ? data.cyclePromoDismissedAt.trim()
        : null,
    cycleDashboardBannerDismissedAt:
      typeof data.cycleDashboardBannerDismissedAt === "string" &&
      data.cycleDashboardBannerDismissedAt.trim()
        ? data.cycleDashboardBannerDismissedAt.trim()
        : null,
    optedInAt:
      typeof data.optedInAt === "string" && data.optedInAt.trim() ? data.optedInAt.trim() : null,
    setupCompletedAt:
      typeof data.setupCompletedAt === "string" && data.setupCompletedAt.trim()
        ? data.setupCompletedAt.trim()
        : null,
    createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
  };
}

function logFromDoc(data: DocumentData): CycleDailyLog | null {
  const clientId = typeof data.clientId === "string" ? data.clientId : "";
  const date = typeof data.date === "string" ? data.date : "";
  if (!clientId || !date) return null;
  return {
    clientId,
    date,
    mood: typeof data.mood === "number" ? data.mood : null,
    energy: typeof data.energy === "number" ? data.energy : null,
    symptoms: Array.isArray(data.symptoms) ? data.symptoms.filter((s) => typeof s === "string") : [],
    feelings: Array.isArray(data.feelings) ? data.feelings.filter((s) => typeof s === "string") : [],
    note: typeof data.note === "string" ? data.note : null,
    isPeriodDay: Boolean(data.isPeriodDay),
    periodFlow:
      data.periodFlow === "none" ||
      data.periodFlow === "light" ||
      data.periodFlow === "medium" ||
      data.periodFlow === "heavy"
        ? data.periodFlow
        : null,
    sexualActivity: typeof data.sexualActivity === "boolean" ? data.sexualActivity : null,
    sexualActivityProtected:
      typeof data.sexualActivityProtected === "boolean" ? data.sexualActivityProtected : null,
    updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
  };
}

export async function fetchCycleProfile(db: Firestore, clientId: string): Promise<CycleProfile> {
  const snap = await db.collection(CYCLE_PROFILES_COLLECTION).doc(clientId).get();
  return profileFromDoc(clientId, snap.data());
}

export async function saveCycleProfile(
  db: Firestore,
  clientId: string,
  patch: Partial<CycleProfile>
): Promise<CycleProfile> {
  const existing = await fetchCycleProfile(db, clientId);
  const now = new Date();
  const next: CycleProfile = {
    ...existing,
    ...patch,
    clientId,
    updatedAt: now,
    createdAt: existing.createdAt ?? now,
  };
  await db
    .collection(CYCLE_PROFILES_COLLECTION)
    .doc(clientId)
    .set(cycleProfileToFirestore(next, now), { merge: true });
  return next;
}

export async function fetchCycleLogsForClient(
  db: Firestore,
  clientId: string,
  limit = 60
): Promise<CycleDailyLog[]> {
  const snap = await db
    .collection(CYCLE_DAILY_LOGS_COLLECTION)
    .where("clientId", "==", clientId)
    .limit(limit)
    .get();
  const logs = snap.docs
    .map((doc) => logFromDoc(doc.data()))
    .filter((log): log is CycleDailyLog => Boolean(log));
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchCycleLogsForOwners(
  db: Firestore,
  ownerIds: string[],
  limit = 60
): Promise<CycleDailyLog[]> {
  const uniqueIds = [...new Set(ownerIds.filter(Boolean))];
  const seen = new Set<string>();
  const merged: CycleDailyLog[] = [];
  for (const ownerId of uniqueIds) {
    const logs = await fetchCycleLogsForClient(db, ownerId, limit);
    for (const log of logs) {
      const key = log.date;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(log);
    }
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

export async function upsertCycleDailyLog(
  db: Firestore,
  clientId: string,
  date: string,
  patch: Partial<Omit<CycleDailyLog, "clientId" | "date">>
): Promise<CycleDailyLog> {
  const docId = `${clientId}_${date}`;
  const now = new Date();
  const payload = {
    clientId,
    date,
    ...patch,
    updatedAt: now,
  };
  await db.collection(CYCLE_DAILY_LOGS_COLLECTION).doc(docId).set(payload, { merge: true });
  const saved = logFromDoc(payload);
  if (!saved) throw new Error("Failed to save cycle log");
  return saved;
}

export async function backfillPeriodLogs(
  db: Firestore,
  clientId: string,
  periods: CyclePeriodRecord[]
): Promise<void> {
  for (const period of periods) {
    for (const date of eachDateInclusive(period.start, period.end)) {
      await upsertCycleDailyLog(db, clientId, date, {
        isPeriodDay: true,
        periodFlow: "medium",
      });
    }
  }
}
