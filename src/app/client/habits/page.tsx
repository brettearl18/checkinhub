"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import type { HabitDefinition } from "@/lib/habits";

interface StreakInfo {
  current: number;
  longest: number;
  goalMetToday: boolean;
}

interface HabitsData {
  habits: HabitDefinition[];
  todayEntries: Record<string, string>;
  streaks: Record<string, StreakInfo>;
}

export default function ClientHabitsPage() {
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<HabitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

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
        });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const logEntry = async (habitId: string, value: string) => {
    if (!data) return;
    setSubmitting(habitId);
    try {
      const res = await fetchWithAuth("/api/client/habits/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, value }),
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            todayEntries: { ...prev.todayEntries, [habitId]: value },
            streaks: {
              ...prev.streaks,
              [habitId]: json.streak ?? prev.streaks[habitId],
            },
          };
        });
      }
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
          Tap to log today. Streaks count consecutive days you hit your goal. Resets at midnight.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && data && data.habits.length === 0 && (
        <p className="text-[var(--color-text-muted)]">No habits configured.</p>
      )}
      {!loading && data && data.habits.length > 0 && (
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
      )}
    </div>
  );
}
