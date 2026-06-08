import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { HABIT_DEFINITIONS, getHabitById, isGoalMet } from "@/lib/habits";
import {
  todayDate,
  HABIT_ENTRIES_COLLECTION,
  fetchClientHabitEntries,
  entriesByHabitAndDate,
  computeStreakFromEntries,
} from "@/lib/habits-streaks";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";

function isValidYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Calendar day at noon local (stable YYYY-MM-DD iteration). */
function addCalendarDays(isoDate: string, deltaDays: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/client/habits/entries
 * Body: { habitId: string, value: string, date?: string }
 * `date` optional YYYY-MM-DD (defaults to today). Past and today allowed; future rejected.
 * Upserts one entry per habit per day; returns updated streak for that habit.
 */
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: { habitId?: string; value?: string; date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const habitId = typeof body.habitId === "string" ? body.habitId.trim() : "";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!habitId || !value) {
    return NextResponse.json({ error: "habitId and value required" }, { status: 400 });
  }

  const habit = getHabitById(habitId);
  if (!habit || !habit.options.some((o) => o.value === value)) {
    return NextResponse.json({ error: "Invalid habit or value" }, { status: 400 });
  }

  const today = todayDate();
  let entryDate = today;
  if (body.date !== undefined && body.date !== null && body.date !== "") {
    const raw = typeof body.date === "string" ? body.date.trim() : "";
    if (!isValidYyyyMmDd(raw)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    if (raw > today) {
      return NextResponse.json({ error: "Cannot log habits for a future date" }, { status: 400 });
    }
    const oldest = addCalendarDays(today, -729);
    if (raw < oldest) {
      return NextResponse.json({ error: "Date is too far in the past" }, { status: 400 });
    }
    entryDate = raw;
  }

  if (!isAdminConfigured()) {
    const met = isGoalMet(habitId, value);
    return NextResponse.json({
      ok: true,
      streak: { current: 0, longest: 0, goalMetToday: false },
      entry: { date: entryDate, habitId, status: met ? "met" : "missed" },
    });
  }

  const db = getAdminDb();
  const docId = `${clientId}_${habitId}_${entryDate}`;
  const now = new Date();

  await db.collection(HABIT_ENTRIES_COLLECTION).doc(docId).set(
    {
      clientId,
      habitId,
      date: entryDate,
      value,
      updatedAt: now,
    },
    { merge: true }
  );

  const docs = await fetchClientHabitEntries(db, clientId);
  const byHabit = entriesByHabitAndDate(docs);
  const todayEntries: Record<string, string> = {};
  HABIT_DEFINITIONS.forEach((h) => {
    const map = byHabit.get(h.id);
    const v = map?.get(today);
    if (v) todayEntries[h.id] = v;
  });
  const entriesByDate = byHabit.get(habitId) ?? new Map();
  const streak = computeStreakFromEntries(habitId, entriesByDate, todayEntries);

  const status = isGoalMet(habitId, value) ? "met" : "missed";
  const newlyEarned = await evaluateAndAwardAchievements(db, clientId);

  return NextResponse.json({
    ok: true,
    streak,
    entry: { date: entryDate, habitId, status },
    newlyEarned,
  });
}
