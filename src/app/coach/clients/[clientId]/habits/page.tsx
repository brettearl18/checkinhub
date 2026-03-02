"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import type { HabitDefinition } from "@/lib/habits";

interface StreakInfo {
  current: number;
  longest: number;
  goalMetToday: boolean;
}

interface RecentEntry {
  habitId: string;
  habitLabel: string;
  value: string;
  optionLabel: string;
  goalMet: boolean;
}

interface HabitsData {
  habits: HabitDefinition[];
  todayEntries: Record<string, string>;
  streaks: Record<string, StreakInfo>;
  recentByDate: { date: string; entries: RecentEntry[] }[];
}

export default function CoachClientHabitsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { fetchWithAuth } = useApiClient();
  const [clientName, setClientName] = useState<string | null>(null);
  const [data, setData] = useState<HabitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const [clientsRes, habitsRes] = await Promise.all([
          fetchWithAuth("/api/coach/clients"),
          fetchWithAuth(`/api/coach/clients/${clientId}/habits`),
        ]);
        if (clientsRes.status === 401 || habitsRes.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (habitsRes.status === 404 || habitsRes.status === 403) {
          if (!cancelled) setData(null);
          return;
        }
        if (clientsRes.ok) {
          const clients = await clientsRes.json();
          const client = Array.isArray(clients) ? clients.find((c: { id: string }) => c.id === clientId) : null;
          if (!cancelled && client) setClientName(`${client.firstName} ${client.lastName}`);
        }
        if (habitsRes.ok && !cancelled) {
          const json = await habitsRes.json();
          setData({
            habits: json.habits ?? [],
            todayEntries: json.todayEntries ?? {},
            streaks: json.streaks ?? {},
            recentByDate: json.recentByDate ?? [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/coach/clients/${clientId}`} className="text-sm text-[var(--color-primary)] hover:underline">
          ← Back to client
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          {clientName ?? "Client"} – Habits
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Read-only view of habit logs and streaks. Clients log from their dashboard or via push.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && data && data.habits.length === 0 && (
        <p className="text-[var(--color-text-muted)]">No habits configured.</p>
      )}

      {!loading && data && data.habits.length > 0 && (
        <>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
              Today &amp; streaks
            </h2>
            <ul className="space-y-4">
              {data.habits.map((habit) => {
                const todayValue = data.todayEntries[habit.id];
                const streak = data.streaks[habit.id] ?? { current: 0, longest: 0, goalMetToday: false };
                const optionLabel = todayValue
                  ? habit.options.find((o) => o.value === todayValue)?.label ?? todayValue
                  : null;
                return (
                  <li key={habit.id}>
                    <Card className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-[var(--color-text)]">{habit.label}</h3>
                          {habit.reminderTime && (
                            <p className="text-xs text-[var(--color-text-muted)]">
                              Reminder at {habit.reminderTime}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-[var(--color-primary)] font-medium">
                            🔥 {streak.current} day{streak.current !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[var(--color-text-muted)]">Best: {streak.longest}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Today: {optionLabel ?? "— Not logged yet"}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>

          {data.recentByDate.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                Recent activity
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-[var(--color-border)]">
                  {data.recentByDate.map(({ date, entries }) => (
                    <li key={date} className="px-4 py-3">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {formatDateDisplay(date)}
                      </span>
                      <ul className="mt-1.5 space-y-0.5 text-sm text-[var(--color-text-secondary)]">
                        {entries.map((e) => (
                          <li key={`${date}-${e.habitId}`}>
                            {e.habitLabel}: {e.optionLabel}
                            {e.goalMet && " ✓"}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
