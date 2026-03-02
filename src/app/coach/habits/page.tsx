"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface HabitSummary {
  todayLabel: string | null;
  current: number;
  longest: number;
}

interface ClientHabitRow {
  clientId: string;
  firstName: string;
  lastName: string;
  habits: Record<string, HabitSummary>;
}

const HABIT_COLUMNS = [
  { id: "steps", label: "Steps", todayKey: "today", streakKey: "streak" },
  { id: "hydration", label: "Hydration", todayKey: "today", streakKey: "streak" },
  { id: "sleep", label: "Sleep", todayKey: "today", streakKey: "streak" },
] as const;

export default function CoachHabitsOverviewPage() {
  const { fetchWithAuth } = useApiClient();
  const [clients, setClients] = useState<ClientHabitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/habits");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data.clients) ? data.clients : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Habits</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Quick reference: today&apos;s log and current streak per client. Open a client for full history.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && clients.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--color-text-muted)]">No clients yet. Habit data will appear here once clients log habits.</p>
        </Card>
      )}

      {!loading && clients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="px-3 py-2.5 text-left font-medium text-[var(--color-text)]">Client</th>
                  {HABIT_COLUMNS.map((col) => (
                    <th key={col.id} colSpan={2} className="px-3 py-2.5 text-center font-medium text-[var(--color-text)]">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-medium text-[var(--color-text)]">Actions</th>
                </tr>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--color-text-muted)]" />
                  {HABIT_COLUMNS.map((col) => (
                    <Fragment key={col.id}>
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-[var(--color-text-muted)]">
                        Today
                      </th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-[var(--color-text-muted)]">
                        Streak
                      </th>
                    </Fragment>
                  ))}
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.clientId}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-[var(--color-text)]">
                        {c.firstName} {c.lastName}
                      </span>
                    </td>
                    {HABIT_COLUMNS.map((col) => {
                      const h = c.habits[col.id];
                      const todayLabel = h?.todayLabel ?? "—";
                      const streak = h ? `${h.current} (best ${h.longest})` : "—";
                      return (
                        <Fragment key={col.id}>
                          <td className="px-2 py-2.5 text-center text-[var(--color-text-secondary)] max-w-[140px] truncate" title={todayLabel ?? undefined}>
                            {todayLabel}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[var(--color-text-muted)]">
                            {streak}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/coach/clients/${c.clientId}/habits`}
                        className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </Card>
      )}
    </div>
  );
}
