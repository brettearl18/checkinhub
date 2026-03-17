import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { HABIT_DEFINITIONS } from "@/lib/habits";
import {
  entriesByHabitAndDate,
  computeStreakFromEntries,
  fetchClientHabitEntries,
  todayDate,
} from "@/lib/habits-streaks";
import { isGoalMet } from "@/lib/habits";

/**
 * GET /api/client/habits
 * Returns habit definitions, today's entries, and streak summary for the authenticated client.
 */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      habits: HABIT_DEFINITIONS,
      todayEntries: {} as Record<string, string>,
      streaks: Object.fromEntries(
        HABIT_DEFINITIONS.map((h) => [
          h.id,
          { current: 0, longest: 0, goalMetToday: false },
        ])
      ),
      history: { start: today, end: today, byDate: {} as Record<string, Record<string, "met" | "missed">> },
    });
  }

  const db = getAdminDb();
  const today = todayDate();
  const docs = await fetchClientHabitEntries(db, clientId);
  const byHabit = entriesByHabitAndDate(docs);

  const todayEntries: Record<string, string> = {};
  HABIT_DEFINITIONS.forEach((h) => {
    const map = byHabit.get(h.id);
    const v = map?.get(today);
    if (v) todayEntries[h.id] = v;
  });

  const streaks: Record<string, { current: number; longest: number; goalMetToday: boolean }> = {};
  HABIT_DEFINITIONS.forEach((h) => {
    const entriesByDate = byHabit.get(h.id) ?? new Map();
    streaks[h.id] = computeStreakFromEntries(h.id, entriesByDate, todayEntries);
  });

  // History for dot map: last 12 weeks (84 days), per day per habit: 'met' | 'missed' | null
  const historyDays = 84;
  const historyEnd = new Date(today);
  const historyStart = new Date(historyEnd);
  historyStart.setDate(historyStart.getDate() - historyDays + 1);
  const byDate: Record<string, Record<string, "met" | "missed">> = {};
  for (let i = 0; i < historyDays; i++) {
    const d = new Date(historyStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    byDate[dateStr] = {};
    for (const h of HABIT_DEFINITIONS) {
      const value = byHabit.get(h.id)?.get(dateStr);
      if (value == null) continue;
      byDate[dateStr][h.id] = isGoalMet(h.id, value) ? "met" : "missed";
    }
  }

  return NextResponse.json({
    habits: HABIT_DEFINITIONS,
    todayEntries,
    streaks,
    history: {
      start: historyStart.toISOString().slice(0, 10),
      end: today,
      byDate,
    },
  });
}
