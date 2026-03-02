import type { Firestore } from "firebase-admin/firestore";
import { getHabitById, isGoalMet } from "./habits";

const COLLECTION = "habitEntries";

type HabitEntryDoc = { data: () => { habitId?: string; date?: string; value?: string } };

function todayYYYYMMDD(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export interface StreakResult {
  current: number;
  longest: number;
  goalMetToday: boolean;
}

/** Entries grouped by habitId then date (YYYY-MM-DD) -> value */
export function entriesByHabitAndDate(docs: HabitEntryDoc[]): Map<string, Map<string, string>> {
  const byHabit = new Map<string, Map<string, string>>();
  docs.forEach((doc) => {
    const data = doc.data();
    const habitId = data.habitId;
    const date = data.date;
    const value = data.value;
    if (!habitId || !date || !value) return;
    let map = byHabit.get(habitId);
    if (!map) {
      map = new Map();
      byHabit.set(habitId, map);
    }
    map.set(date, value);
  });
  return byHabit;
}

/**
 * Compute current and longest streak for one habit from pre-fetched entries.
 */
export function computeStreakFromEntries(
  habitId: string,
  entriesByDate: Map<string, string>,
  todayEntries: Record<string, string>
): StreakResult {
  const today = todayYYYYMMDD();
  const todayValue = todayEntries[habitId] ?? null;
  const goalMetToday = todayValue !== null && isGoalMet(habitId, todayValue);

  const habit = getHabitById(habitId);
  if (!habit) return { current: 0, longest: 0, goalMetToday };

  // Current streak: from today backwards
  let current = 0;
  let d = new Date(today);
  for (let i = 0; i < 366; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const value = entriesByDate.get(dateStr);
    if (value == null) break;
    const met = habit.options.find((o) => o.value === value)?.goalMet ?? false;
    if (!met) break;
    current++;
    d.setDate(d.getDate() - 1);
  }

  // Longest: sort dates ascending, walk consecutive goal-met days
  const sortedDates = [...entriesByDate.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const dateStr of sortedDates) {
    const value = entriesByDate.get(dateStr)!;
    const met = habit.options.find((o) => o.value === value)?.goalMet ?? false;
    if (!met) {
      run = 0;
      prev = null;
      continue;
    }
    if (prev === null || isConsecutiveDay(prev, dateStr)) {
      run++;
      if (longest < run) longest = run;
    } else {
      run = 1;
      if (longest < run) longest = run;
    }
    prev = dateStr;
  }

  return { current, longest, goalMetToday };
}

function isConsecutiveDay(prev: string, next: string): boolean {
  const a = new Date(prev);
  const b = new Date(next);
  a.setDate(a.getDate() + 1);
  return a.toISOString().slice(0, 10) === next;
}

export const HABIT_ENTRIES_COLLECTION = COLLECTION;
export function todayDate() {
  return todayYYYYMMDD();
}

/** Fetch all habit entries for a client (for streak computation). */
export async function fetchClientHabitEntries(
  db: Firestore,
  clientId: string
): Promise<HabitEntryDoc[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("clientId", "==", clientId)
    .limit(500)
    .get();
  return snap.docs as unknown as HabitEntryDoc[];
}
