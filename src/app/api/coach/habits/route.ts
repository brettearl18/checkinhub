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

export interface ClientHabitSummary {
  clientId: string;
  firstName: string;
  lastName: string;
  habits: Record<
    string,
    { todayLabel: string | null; current: number; longest: number }
  >;
}

/**
 * GET /api/coach/habits
 * Returns all of the coach's clients with habit summary (today's log label + streaks per habit).
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      clients: [
        {
          clientId: "mock-client-1",
          firstName: "Test",
          lastName: "Client",
          habits: Object.fromEntries(
            HABIT_DEFINITIONS.map((h) => [
              h.id,
              { todayLabel: null, current: 0, longest: 0 },
            ])
          ),
        },
      ],
    });
  }

  const db = getAdminDb();
  const clientsSnap = await db
    .collection("clients")
    .where("coachId", "==", coachId)
    .get();

  const today = todayDate();
  const clients: ClientHabitSummary[] = [];

  for (const doc of clientsSnap.docs) {
    const clientId = doc.id;
    const data = doc.data() as { firstName?: string; lastName?: string };
    const todayEntries: Record<string, string> = {};
    const docs = await fetchClientHabitEntries(db, clientId);
    const byHabit = entriesByHabitAndDate(docs);

    HABIT_DEFINITIONS.forEach((h) => {
      const map = byHabit.get(h.id);
      const v = map?.get(today);
      if (v) todayEntries[h.id] = v;
    });

    const streaks: Record<
      string,
      { current: number; longest: number; goalMetToday: boolean }
    > = {};
    HABIT_DEFINITIONS.forEach((h) => {
      const entriesByDate = byHabit.get(h.id) ?? new Map();
      streaks[h.id] = computeStreakFromEntries(h.id, entriesByDate, todayEntries);
    });

    const habits: Record<
      string,
      { todayLabel: string | null; current: number; longest: number }
    > = {};
    HABIT_DEFINITIONS.forEach((h) => {
      const value = todayEntries[h.id];
      const opt = value ? h.options.find((o) => o.value === value) : null;
      habits[h.id] = {
        todayLabel: opt?.label ?? null,
        current: streaks[h.id]?.current ?? 0,
        longest: streaks[h.id]?.longest ?? 0,
      };
    });

    clients.push({
      clientId,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      habits,
    });
  }

  return NextResponse.json({ clients });
}
