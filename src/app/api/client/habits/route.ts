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
  HABIT_ENTRIES_COLLECTION,
} from "@/lib/habits-streaks";

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

  return NextResponse.json({
    habits: HABIT_DEFINITIONS,
    todayEntries,
    streaks,
  });
}
