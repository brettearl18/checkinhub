import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { HABIT_DEFINITIONS } from "@/lib/habits";
import {
  entriesByHabitAndDate,
  computeStreakFromEntries,
  fetchClientHabitEntries,
  todayDate,
} from "@/lib/habits-streaks";

/**
 * GET /api/coach/clients/[clientId]/habits
 * Returns habit definitions, today's entries, streaks, and recent history for the client (coach view).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

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
      recentByDate: [],
    });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Build recent history: last 14 days, each day with { date, entries: { habitId, label, value, goalMet }[] }
  const recentByDate: { date: string; entries: { habitId: string; habitLabel: string; value: string; optionLabel: string; goalMet: boolean }[] }[] = [];
  const sortedDates = new Set<string>();
  byHabit.forEach((dateMap) => dateMap.forEach((_, d) => sortedDates.add(d)));
  const sorted = [...sortedDates].sort().reverse().slice(0, 14);
  for (const dateStr of sorted) {
    const entries: { habitId: string; habitLabel: string; value: string; optionLabel: string; goalMet: boolean }[] = [];
    for (const habit of HABIT_DEFINITIONS) {
      const map = byHabit.get(habit.id);
      const value = map?.get(dateStr);
      if (!value) continue;
      const opt = habit.options.find((o) => o.value === value);
      entries.push({
        habitId: habit.id,
        habitLabel: habit.label,
        value,
        optionLabel: opt?.label ?? value,
        goalMet: opt?.goalMet ?? false,
      });
    }
    if (entries.length > 0) {
      recentByDate.push({ date: dateStr, entries });
    }
  }

  return NextResponse.json({
    habits: HABIT_DEFINITIONS,
    todayEntries,
    streaks,
    recentByDate,
  });
}
