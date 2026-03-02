import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { HABIT_DEFINITIONS, getHabitById } from "@/lib/habits";
import {
  todayDate,
  HABIT_ENTRIES_COLLECTION,
  fetchClientHabitEntries,
  entriesByHabitAndDate,
  computeStreakFromEntries,
} from "@/lib/habits-streaks";

/**
 * POST /api/client/habits/entries
 * Body: { habitId: string, value: string }
 * Upserts today's entry for the habit; returns updated streak for that habit.
 */
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  let body: { habitId?: string; value?: string };
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

  if (!isAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      streak: { current: 0, longest: 0, goalMetToday: false },
    });
  }

  const db = getAdminDb();
  const today = todayDate();
  const docId = `${clientId}_${habitId}_${today}`;
  const now = new Date();

  await db.collection(HABIT_ENTRIES_COLLECTION).doc(docId).set(
    {
      clientId,
      habitId,
      date: today,
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

  return NextResponse.json({ ok: true, streak });
}
