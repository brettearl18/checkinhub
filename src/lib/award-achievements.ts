import type { Firestore } from "firebase-admin/firestore";
import { getScoreBand } from "@/lib/check-in-score";
import { getCoachDefaultBadgeAwardMode, resolveBadgeAwardMode } from "@/lib/badge-approval";
import type { ClientBadgeAwardMode } from "@/lib/badge-approval";
import { HABIT_DEFINITIONS, isGoalMet } from "@/lib/habits";
import {
  entriesByHabitAndDate,
  computeStreakFromEntries,
  fetchClientHabitEntries,
  todayDate,
} from "@/lib/habits-streaks";
import { resolveThresholds } from "@/lib/scoring-utils";
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENTS_BY_ID,
  type AchievementListItem,
  type CoachBadgeAllocation,
  type CoachBadgesClientSummary,
  type CoachBadgesOverview,
  type NewlyEarnedAchievement,
  type PendingAchievementItem,
} from "@/lib/achievements";

const COLLECTION = "client_achievements";
const PENDING_COLLECTION = "pending_achievements";

const BEFORE_POSES = ["before_front", "before_back", "before_side"] as const;
const AFTER_POSES = ["after_front", "after_back", "after_side"] as const;

function docId(clientId: string, achievementId: string): string {
  return `${clientId}_${achievementId}`;
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

/** Max consecutive reflection weeks with completed check-ins. */
export function maxConsecutiveCheckInWeeks(weeks: string[]): number {
  const sorted = [...new Set(weeks)].sort();
  if (sorted.length === 0) return 0;
  let max = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]! + "T12:00:00Z");
    prev.setUTCDate(prev.getUTCDate() + 7);
    const expected = prev.toISOString().slice(0, 10);
    if (expected === sorted[i]) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }
  return max;
}

function hasTripleThreatDay(byHabit: Map<string, Map<string, string>>): boolean {
  const dates = new Set<string>();
  for (const map of byHabit.values()) {
    for (const date of map.keys()) dates.add(date);
  }
  for (const date of dates) {
    const allMet = HABIT_DEFINITIONS.every((h) => {
      const value = byHabit.get(h.id)?.get(date);
      return value != null && isGoalMet(h.id, value);
    });
    if (allMet) return true;
  }
  return false;
}

function habitCurrentStreak(
  habitId: string,
  byHabit: Map<string, Map<string, string>>
): number {
  const today = todayDate();
  const todayEntries: Record<string, string> = {};
  const v = byHabit.get(habitId)?.get(today);
  if (v) todayEntries[habitId] = v;
  const entries = byHabit.get(habitId) ?? new Map();
  return computeStreakFromEntries(habitId, entries, todayEntries).current;
}

function habitCurrentStreakMax(byHabit: Map<string, Map<string, string>>): number {
  let max = 0;
  for (const h of HABIT_DEFINITIONS) {
    const streak = habitCurrentStreak(h.id, byHabit);
    if (streak > max) max = streak;
  }
  return max;
}

function isDayAllHabitsMet(date: string, byHabit: Map<string, Map<string, string>>): boolean {
  return HABIT_DEFINITIONS.every((h) => {
    const value = byHabit.get(h.id)?.get(date);
    return value != null && isGoalMet(h.id, value);
  });
}

/** Seven consecutive calendar days with all habit goals met. */
export function hasPerfectHabitWeek(byHabit: Map<string, Map<string, string>>): boolean {
  const allDates = new Set<string>();
  for (const h of HABIT_DEFINITIONS) {
    const map = byHabit.get(h.id);
    if (map) {
      for (const date of map.keys()) allDates.add(date);
    }
  }
  if (allDates.size === 0) return false;

  const sorted = [...allDates].sort();
  const start = new Date(`${sorted[0]}T12:00:00`);
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00`);

  let run = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (isDayAllHabitsMet(dateStr, byHabit)) {
      run++;
      if (run >= 7) return true;
    } else {
      run = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function goalProgressPercent(data: Record<string, unknown>): number | null {
  const progress = data.progress;
  if (typeof progress === "number" && Number.isFinite(progress)) return progress;
  const target = data.targetValue;
  const current = data.currentValue;
  if (typeof target === "number" && typeof current === "number" && target > 0) {
    return (current / target) * 100;
  }
  return null;
}

function isGoalCompleted(data: Record<string, unknown>): boolean {
  if (data.status === "completed") return true;
  const progress = goalProgressPercent(data);
  if (progress != null && progress >= 100) return true;
  return false;
}

function maxConsecutiveGreenScores(
  scores: Array<{ score: number; at: string }>,
  redMax: number,
  orangeMax: number
): number {
  let max = 0;
  let run = 0;
  for (const row of scores) {
    if (getScoreBand(row.score, redMax, orangeMax) === "green") {
      run++;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return max;
}

interface EvalContext {
  completedWeeks: string[];
  completedCheckInCount: number;
  consecutiveCheckInWeeks: number;
  hasGreenScore: boolean;
  hasOrangeScore: boolean;
  maxConsecutiveGreen: number;
  measurementCount: number;
  weightLogCount: number;
  photoPoseTypes: Set<string>;
  completedGoalCount: number;
  hasHalfwayGoal: boolean;
  maxHabitStreak: number;
  sleepHabitStreak: number;
  hasTripleThreat: boolean;
  hasPerfectWeek: boolean;
}

async function loadEvalContext(db: Firestore, clientId: string): Promise<EvalContext> {
  const [
    assignmentsSnap,
    responsesSnap,
    measurementsSnap,
    photosSnap,
    goalsSnap,
    habitDocs,
    scoringSnap,
  ] = await Promise.all([
    db.collection("check_in_assignments").where("clientId", "==", clientId).get(),
    db.collection("formResponses").where("clientId", "==", clientId).limit(200).get(),
    db.collection("client_measurements").where("clientId", "==", clientId).limit(100).get(),
    db.collection("progress_images").where("clientId", "==", clientId).get(),
    db.collection("clientGoals").where("clientId", "==", clientId).get(),
    fetchClientHabitEntries(db, clientId),
    db.collection("clientScoring").doc(clientId).get(),
  ]);

  const completedWeeks: string[] = [];
  let completedCheckInCount = 0;
  for (const d of assignmentsSnap.docs) {
    const data = d.data();
    if (data.status === "completed") {
      completedCheckInCount++;
      if (data.reflectionWeekStart) {
        completedWeeks.push(data.reflectionWeekStart as string);
      }
    }
  }

  const clientScoring = scoringSnap.exists
    ? (scoringSnap.data() as { thresholds?: { redMax?: number; orangeMax?: number } })
    : undefined;
  const { redMax, orangeMax } = resolveThresholds({ clientScoring });

  const scoredResponses: Array<{ score: number; at: string }> = [];
  for (const d of responsesSnap.docs) {
    const data = d.data();
    const score = data.score;
    const at = toIso(data.completedAt) ?? toIso(data.submittedAt);
    if (typeof score === "number" && at) {
      scoredResponses.push({ score, at });
    }
  }
  scoredResponses.sort((a, b) => a.at.localeCompare(b.at));

  let hasGreenScore = false;
  let hasOrangeScore = false;
  for (const row of scoredResponses) {
    const band = getScoreBand(row.score, redMax, orangeMax);
    if (band === "green") hasGreenScore = true;
    if (band === "orange") hasOrangeScore = true;
  }

  const photoPoseTypes = new Set<string>();
  for (const d of photosSnap.docs) {
    const t = (d.data().imageType as string | undefined)?.toLowerCase();
    if (t) photoPoseTypes.add(t);
  }

  let completedGoalCount = 0;
  let hasHalfwayGoal = false;
  for (const d of goalsSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (isGoalCompleted(data)) {
      completedGoalCount++;
      continue;
    }
    const progress = goalProgressPercent(data);
    if (progress != null && progress >= 50) {
      hasHalfwayGoal = true;
    }
  }

  let weightLogCount = 0;
  for (const d of measurementsSnap.docs) {
    const bodyWeight = d.data().bodyWeight;
    if (typeof bodyWeight === "number" && Number.isFinite(bodyWeight)) {
      weightLogCount++;
    }
  }

  const byHabit = entriesByHabitAndDate(habitDocs);

  return {
    completedWeeks,
    completedCheckInCount,
    consecutiveCheckInWeeks: maxConsecutiveCheckInWeeks(completedWeeks),
    hasGreenScore,
    hasOrangeScore,
    maxConsecutiveGreen: maxConsecutiveGreenScores(scoredResponses, redMax, orangeMax),
    measurementCount: measurementsSnap.size,
    weightLogCount,
    photoPoseTypes,
    completedGoalCount,
    hasHalfwayGoal,
    maxHabitStreak: habitCurrentStreakMax(byHabit),
    sleepHabitStreak: habitCurrentStreak("sleep", byHabit),
    hasTripleThreat: hasTripleThreatDay(byHabit),
    hasPerfectWeek: hasPerfectHabitWeek(byHabit),
  };
}

function isEligible(id: string, ctx: EvalContext): boolean {
  switch (id) {
    case "first_checkin":
      return ctx.completedCheckInCount >= 1;
    case "four_week_streak":
      return ctx.consecutiveCheckInWeeks >= 4;
    case "green_week":
      return ctx.hasGreenScore;
    case "habit_spark_7":
      return ctx.maxHabitStreak >= 7;
    case "triple_threat":
      return ctx.hasTripleThreat;
    case "baseline_builder":
      return ctx.measurementCount >= 1;
    case "photo_ready":
      return BEFORE_POSES.every((p) => ctx.photoPoseTypes.has(p));
    case "goal_getter":
      return ctx.completedGoalCount >= 1;
    case "orange_zone":
      return ctx.hasOrangeScore;
    case "checkin_10":
      return ctx.completedCheckInCount >= 10;
    case "eight_week_streak":
      return ctx.consecutiveCheckInWeeks >= 8;
    case "twelve_week_streak":
      return ctx.consecutiveCheckInWeeks >= 12;
    case "green_machine":
      return ctx.maxConsecutiveGreen >= 3;
    case "habit_spark_14":
      return ctx.maxHabitStreak >= 14;
    case "habit_anchor_21":
      return ctx.maxHabitStreak >= 21;
    case "habit_unstoppable_30":
      return ctx.maxHabitStreak >= 30;
    case "perfect_week_habits":
      return ctx.hasPerfectWeek;
    case "sleep_steward_7":
      return ctx.sleepHabitStreak >= 7;
    case "tape_tracker_5":
      return ctx.measurementCount >= 5;
    case "scale_regular_10":
      return ctx.weightLogCount >= 10;
    case "progress_shots":
      return AFTER_POSES.every((p) => ctx.photoPoseTypes.has(p));
    case "halfway_hero":
      return ctx.hasHalfwayGoal;
    case "double_down_goals":
      return ctx.completedGoalCount >= 2;
    default:
      return false;
  }
}

async function grantAchievement(
  db: Firestore,
  clientId: string,
  achievementId: string,
  options?: { awaitCelebration?: boolean }
): Promise<NewlyEarnedAchievement | null> {
  const def = ACHIEVEMENTS_BY_ID[achievementId];
  if (!def) return null;

  const ref = db.collection(COLLECTION).doc(docId(clientId, achievementId));
  const existing = await ref.get();
  if (existing.exists) return null;

  const now = new Date();
  await ref.set({
    clientId,
    achievementId,
    earnedAt: now,
    ...(options?.awaitCelebration ? { awaitCelebration: true } : {}),
  });

  return {
    id: def.id,
    emoji: def.emoji,
    name: def.name,
    description: def.description,
    earnedAt: now.toISOString(),
  };
}

async function queuePendingAchievement(
  db: Firestore,
  clientId: string,
  coachId: string,
  achievementId: string
): Promise<boolean> {
  const ref = db.collection(PENDING_COLLECTION).doc(docId(clientId, achievementId));
  const existing = await ref.get();
  if (existing.exists) return false;

  const now = new Date();
  await ref.set({
    clientId,
    coachId,
    achievementId,
    status: "pending",
    eligibleAt: now,
  });
  return true;
}

/** Badges awaiting client celebration after coach approval. */
export async function collectAwaitingCelebration(
  db: Firestore,
  clientId: string
): Promise<NewlyEarnedAchievement[]> {
  const snap = await db.collection(COLLECTION).where("clientId", "==", clientId).get();

  const results: NewlyEarnedAchievement[] = [];
  const batch = db.batch();

  for (const d of snap.docs) {
    const data = d.data();
    if (data.awaitCelebration !== true) continue;
    const achievementId = data.achievementId as string;
    const def = ACHIEVEMENTS_BY_ID[achievementId];
    if (!def) continue;
    const earnedAt = toIso(data.earnedAt) ?? new Date().toISOString();
    results.push({
      id: def.id,
      emoji: def.emoji,
      name: def.name,
      description: def.description,
      earnedAt,
    });
    batch.update(d.ref, { awaitCelebration: false });
  }

  if (results.length > 0) await batch.commit();
  return results;
}

/** Evaluate all unearned badges and grant or queue any newly eligible. */
export async function evaluateAndAwardAchievements(
  db: Firestore,
  clientId: string
): Promise<NewlyEarnedAchievement[]> {
  const [earnedSnap, pendingSnap, awardMode, clientSnap] = await Promise.all([
    db.collection(COLLECTION).where("clientId", "==", clientId).get(),
    db.collection(PENDING_COLLECTION).where("clientId", "==", clientId).get(),
    resolveBadgeAwardMode(db, clientId),
    db.collection("clients").doc(clientId).get(),
  ]);

  const earnedIds = new Set(
    earnedSnap.docs.map((d) => d.data().achievementId as string).filter(Boolean)
  );

  const blockedIds = new Set<string>();
  for (const d of pendingSnap.docs) {
    const data = d.data();
    const id = data.achievementId as string;
    const status = data.status as string;
    if (id && (status === "pending" || status === "dismissed")) {
      blockedIds.add(id);
    }
  }

  const pending = ACHIEVEMENT_DEFINITIONS.filter(
    (a) => !earnedIds.has(a.id) && !blockedIds.has(a.id)
  );
  if (pending.length === 0) return [];

  const ctx = await loadEvalContext(db, clientId);
  const newlyEarned: NewlyEarnedAchievement[] = [];
  const coachId = (clientSnap.data() as { coachId?: string } | undefined)?.coachId ?? "";

  for (const ach of pending) {
    if (!isEligible(ach.id, ctx)) continue;
    if (awardMode === "coach" && coachId) {
      await queuePendingAchievement(db, clientId, coachId, ach.id);
      continue;
    }
    const granted = await grantAchievement(db, clientId, ach.id);
    if (granted) newlyEarned.push(granted);
  }

  return newlyEarned;
}

/** List all badges with earned state for a client. */
export async function listClientAchievements(
  db: Firestore,
  clientId: string
): Promise<AchievementListItem[]> {
  const earnedSnap = await db
    .collection(COLLECTION)
    .where("clientId", "==", clientId)
    .get();

  const earnedMap = new Map<string, string>();
  for (const d of earnedSnap.docs) {
    const data = d.data();
    const id = data.achievementId as string;
    const at = toIso(data.earnedAt);
    if (id && at) earnedMap.set(id, at);
  }

  return ACHIEVEMENT_DEFINITIONS.map((def) => ({
    ...def,
    earned: earnedMap.has(def.id),
    earnedAt: earnedMap.get(def.id) ?? null,
  }));
}

/** Pending badges awaiting coach approval for one client. */
export async function listPendingAchievementsForClient(
  db: Firestore,
  clientId: string
): Promise<PendingAchievementItem[]> {
  const snap = await db.collection(PENDING_COLLECTION).where("clientId", "==", clientId).get();

  const items: PendingAchievementItem[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status !== "pending") continue;
    const achievementId = data.achievementId as string;
    const def = ACHIEVEMENTS_BY_ID[achievementId];
    const eligibleAt = toIso(data.eligibleAt);
    if (!def || !eligibleAt) continue;
    items.push({
      ...def,
      achievementId: def.id,
      eligibleAt,
      status: "pending",
    });
  }

  return items.sort((a, b) => b.eligibleAt.localeCompare(a.eligibleAt));
}

/** Coach approves a pending badge — client sees it on next portal visit. */
export async function approvePendingAchievement(
  db: Firestore,
  coachId: string,
  clientId: string,
  achievementId: string
): Promise<NewlyEarnedAchievement | null> {
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return null;
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) return null;

  const pendingRef = db.collection(PENDING_COLLECTION).doc(docId(clientId, achievementId));
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists || pendingSnap.data()?.status !== "pending") return null;

  const granted = await grantAchievement(db, clientId, achievementId);
  if (!granted) return null;

  await pendingRef.delete();
  return granted;
}

/** Coach dismisses a pending badge — won't be re-queued. */
export async function dismissPendingAchievement(
  db: Firestore,
  coachId: string,
  clientId: string,
  achievementId: string
): Promise<boolean> {
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return false;
  if ((clientSnap.data() as { coachId?: string }).coachId !== coachId) return false;

  const pendingRef = db.collection(PENDING_COLLECTION).doc(docId(clientId, achievementId));
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists || pendingSnap.data()?.status !== "pending") return false;

  await pendingRef.update({
    status: "dismissed",
    dismissedAt: new Date(),
  });
  return true;
}

function clientName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Client";
}

/** Backfill / evaluate badges for every client belonging to a coach. */
export async function evaluateAchievementsForCoachClients(
  db: Firestore,
  coachId: string
): Promise<void> {
  const snap = await db.collection("clients").where("coachId", "==", coachId).get();
  await Promise.all(snap.docs.map((d) => evaluateAndAwardAchievements(db, d.id)));
}

/** Coach hub: all badge definitions, settings, and allocations across clients. */
export async function getCoachBadgesOverview(
  db: Firestore,
  coachId: string
): Promise<CoachBadgesOverview> {
  const [clientsSnap, pendingSnap, defaultBadgeAwardMode] = await Promise.all([
    db.collection("clients").where("coachId", "==", coachId).get(),
    db.collection(PENDING_COLLECTION).where("coachId", "==", coachId).get(),
    getCoachDefaultBadgeAwardMode(db, coachId),
  ]);

  const clientMap = new Map<
    string,
    { firstName: string; lastName: string; badgeAwardMode: ClientBadgeAwardMode }
  >();
  const clientIds: string[] = [];

  for (const d of clientsSnap.docs) {
    const data = d.data();
    const mode = data.badgeAwardMode;
    clientMap.set(d.id, {
      firstName: (data.firstName as string) ?? "",
      lastName: (data.lastName as string) ?? "",
      badgeAwardMode:
        mode === "auto" || mode === "coach" ? mode : "default",
    });
    clientIds.push(d.id);
  }

  const earnedRows: CoachBadgeAllocation[] = [];
  for (let i = 0; i < clientIds.length; i += 30) {
    const chunk = clientIds.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const snap = await db.collection(COLLECTION).where("clientId", "in", chunk).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const achievementId = data.achievementId as string;
      const clientId = data.clientId as string;
      const earnedAt = toIso(data.earnedAt);
      const def = ACHIEVEMENTS_BY_ID[achievementId];
      const c = clientMap.get(clientId);
      if (!def || !earnedAt || !c) continue;
      earnedRows.push({
        clientId,
        clientName: clientName(c.firstName, c.lastName),
        achievementId,
        emoji: def.emoji,
        name: def.name,
        date: earnedAt,
      });
    }
  }

  const pendingRows: CoachBadgeAllocation[] = [];
  for (const doc of pendingSnap.docs) {
    const data = doc.data();
    if (data.status !== "pending") continue;
    const achievementId = data.achievementId as string;
    const clientId = data.clientId as string;
    const eligibleAt = toIso(data.eligibleAt);
    const def = ACHIEVEMENTS_BY_ID[achievementId];
    const c = clientMap.get(clientId);
    if (!def || !eligibleAt || !c) continue;
    pendingRows.push({
      clientId,
      clientName: clientName(c.firstName, c.lastName),
      achievementId,
      emoji: def.emoji,
      name: def.name,
      date: eligibleAt,
    });
  }

  earnedRows.sort((a, b) => b.date.localeCompare(a.date));
  pendingRows.sort((a, b) => b.date.localeCompare(a.date));

  const badgeStats: Record<string, { earned: number; pending: number }> = {};
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    badgeStats[def.id] = { earned: 0, pending: 0 };
  }
  for (const row of earnedRows) {
    badgeStats[row.achievementId]!.earned++;
  }
  for (const row of pendingRows) {
    badgeStats[row.achievementId]!.pending++;
  }

  const clients: CoachBadgesClientSummary[] = clientIds.map((id) => {
    const c = clientMap.get(id)!;
    const earnedIds = earnedRows.filter((r) => r.clientId === id).map((r) => r.achievementId);
    const pendingIds = pendingRows.filter((r) => r.clientId === id).map((r) => r.achievementId);
    return {
      id,
      firstName: c.firstName,
      lastName: c.lastName,
      badgeAwardMode: c.badgeAwardMode,
      earnedCount: earnedIds.length,
      pendingCount: pendingIds.length,
      earnedIds,
      pendingIds,
    };
  });

  clients.sort((a, b) => {
    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
    if (b.earnedCount !== a.earnedCount) return b.earnedCount - a.earnedCount;
    return clientName(a.firstName, a.lastName).localeCompare(clientName(b.firstName, b.lastName));
  });

  return {
    definitions: ACHIEVEMENT_DEFINITIONS,
    defaultBadgeAwardMode,
    badgeStats,
    totalEarned: earnedRows.length,
    totalPending: pendingRows.length,
    earned: earnedRows,
    pending: pendingRows,
    clients,
  };
}
