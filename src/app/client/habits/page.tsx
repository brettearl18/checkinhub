"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { HabitWeeklyStrip, type HabitStripRange } from "@/components/client/HabitWeeklyStrip";
import { useApiClient } from "@/lib/api-client";
import type { HabitDefinition } from "@/lib/habits";
import { todayDate } from "@/lib/habits-streaks";

interface StreakInfo {
  current: number;
  longest: number;
  goalMetToday: boolean;
}

interface HabitsHistory {
  start: string;
  end: string;
  byDate: Record<string, Record<string, "met" | "missed">>;
}

interface HabitsData {
  habits: HabitDefinition[];
  todayEntries: Record<string, string>;
  streaks: Record<string, StreakInfo>;
  history?: HabitsHistory;
}

export default function ClientHabitsPage() {
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<HabitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [stripRange, setStripRange] = useState<HabitStripRange>("7d");
  const [cellPicker, setCellPicker] = useState<{ habitId: string; date: string } | null>(null);
  const [habitLogError, setHabitLogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/client/habits");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setData({
          habits: json.habits ?? [],
          todayEntries: json.todayEntries ?? {},
          streaks: json.streaks ?? {},
          history: json.history ?? undefined,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const logEntry = async (habitId: string, value: string, entryDate?: string) => {
    if (!data) return;
    setHabitLogError(null);
    setSubmitting(habitId);
    try {
      const body: { habitId: string; value: string; date?: string } = { habitId, value };
      if (entryDate) body.date = entryDate;
      const res = await fetchWithAuth("/api/client/habits/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHabitLogError(typeof json.error === "string" ? json.error : "Could not save habit");
        return;
      }
      const today = todayDate();
      const loggedDate = (json.entry?.date as string | undefined) ?? entryDate ?? today;
      setData((prev) => {
        if (!prev) return prev;
        const nextHistory =
          prev.history && json.entry
            ? {
                ...prev.history,
                byDate: {
                  ...prev.history.byDate,
                  [loggedDate]: {
                    ...(prev.history.byDate[loggedDate] ?? {}),
                    [habitId]: json.entry.status as "met" | "missed",
                  },
                },
              }
            : prev.history;
        return {
          ...prev,
          todayEntries:
            loggedDate === today ? { ...prev.todayEntries, [habitId]: value } : prev.todayEntries,
          streaks: {
            ...prev.streaks,
            [habitId]: json.streak ?? prev.streaks[habitId],
          },
          history: nextHistory,
        };
      });
      setCellPicker(null);
    } finally {
      setSubmitting(null);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  const todayLabel = (() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  })();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{todayLabel}</p>
        <h1 className="mt-0.5 text-2xl font-semibold text-[var(--color-text)]">Habit tracker</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Tap a habit below for today, or open the week grid and tap any day up to today to back-date. Streaks count
          consecutive days you hit your goal.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && data && data.habits.length === 0 && (
        <p className="text-[var(--color-text-muted)]">No habits configured.</p>
      )}
      {!loading && data && data.habits.length > 0 && habitLogError && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {habitLogError}
        </p>
      )}

      {!loading && data && data.habits.length > 0 && (
        <>
          <ul className="space-y-6">
            {data.habits.map((habit) => {
            const selected = data.todayEntries[habit.id];
            const streak = data.streaks[habit.id] ?? { current: 0, longest: 0, goalMetToday: false };
            const busy = submitting === habit.id;
            return (
              <li key={habit.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h2 className="font-semibold text-[var(--color-text)]">{habit.label}</h2>
                      {habit.reminderTime && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Reminder at {habit.reminderTime}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--color-primary)] font-medium" title="Current streak">
                        🔥 {streak.current} day{streak.current !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[var(--color-text-muted)]" title="Longest streak">
                        Best: {streak.longest}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {habit.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={busy}
                        onClick={() => logEntry(habit.id, opt.value)}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                          selected === opt.value
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-muted)] hover:text-[var(--color-text)]"
                        } ${busy ? "opacity-70" : ""}`}
                      >
                        {opt.label}
                        {opt.goalMet && selected !== opt.value && " ✓"}
                        {selected === opt.value && " ✓"}
                      </button>
                    ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>

          {data.history && (
            <>
              <section className="mt-8">
                <div className="mb-3 flex gap-1 rounded-lg bg-[var(--color-bg)] p-1">
                  {(["7d", "30d", "all"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStripRange(r)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        stripRange === r
                          ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {r === "7d" ? "This week" : r === "30d" ? "1 month" : "All time"}
                    </button>
                  ))}
                </div>
                <HabitWeeklyStrip
                  habits={data.habits}
                  byDate={data.history.byDate}
                  range={stripRange}
                  historyStart={stripRange === "all" ? data.history.start : undefined}
                  historyEnd={stripRange === "all" ? data.history.end : undefined}
                  onCellClick={(habitId, date) => setCellPicker({ habitId, date })}
                />
              </section>
            </>
          )}
        </>
      )}

      {cellPicker && data && (() => {
        const habit = data.habits.find((h) => h.id === cellPicker.habitId);
        if (!habit) return null;
        const dateLabel = new Date(`${cellPicker.date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const busy = submitting === habit.id;
        const pickerIsToday = cellPicker.date === todayDate();
        const selectedForPicker = pickerIsToday ? data.todayEntries[habit.id] : undefined;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-cell-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCellPicker(null);
            }}
          >
            <Card className="w-full max-w-md p-6 shadow-lg">
              <h2 id="habit-cell-modal-title" className="text-lg font-semibold text-[var(--color-text)] mb-1">
                {habit.label}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">{dateLabel}</p>
              <div className="flex flex-wrap gap-2">
                {habit.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy}
                    onClick={() => logEntry(habit.id, opt.value, cellPicker.date)}
                    className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      selectedForPicker === opt.value
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-muted)] hover:text-[var(--color-text)]"
                    } ${busy ? "opacity-70" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  onClick={() => setCellPicker(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
