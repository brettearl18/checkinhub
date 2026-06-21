"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { CyclePhaseRing } from "@/components/client/CyclePhaseRing";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import type { CyclePhaseInfo } from "@/lib/cycle-tracking";

interface CoachCycleData {
  shared: boolean;
  reason?: string;
  phase?: CyclePhaseInfo;
  profile?: {
    lastPeriodStart: string | null;
    lastPeriodEnd: string | null;
    averageCycleLength: number;
    averagePeriodLength: number;
  };
  summary?: {
    avgMood7d: number | null;
    avgEnergy7d: number | null;
    daysLogged: number;
  };
  recentLogs?: {
    date: string;
    mood: number | null;
    energy: number | null;
    symptoms: string[];
    feelings: string[];
    isPeriodDay: boolean;
    note?: string;
  }[];
}

export default function CoachClientCyclePage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { fetchWithAuth } = useApiClient();
  const [clientName, setClientName] = useState<string | null>(null);
  const [data, setData] = useState<CoachCycleData | null>(null);
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
        const [clientsRes, cycleRes] = await Promise.all([
          fetchWithAuth("/api/coach/clients"),
          fetchWithAuth(`/api/coach/clients/${clientId}/cycle`),
        ]);
        if (clientsRes.status === 401 || cycleRes.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (clientsRes.ok) {
          const clients = await clientsRes.json();
          const client = Array.isArray(clients) ? clients.find((c: { id: string }) => c.id === clientId) : null;
          if (!cancelled && client) setClientName(`${client.firstName} ${client.lastName}`);
        }
        if (cycleRes.ok && !cancelled) {
          setData(await cycleRes.json());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
          {clientName ?? "Client"} – Cycle
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Read-only view. Shown only when the client opts in to share with their coach.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && data && !data.shared && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Not shared</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This client has not opted in to share cycle data with you, or cycle tracking is turned off.
            They can enable sharing from their Cycle & wellbeing page in the client portal.
          </p>
        </Card>
      )}

      {!loading && data?.shared && data.phase && data.profile && (
        <>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text)]">Current estimate</h2>
            <CyclePhaseRing
              profile={{
                clientId,
                trackingEnabled: true,
                shareWithCoach: true,
                shareNotesWithCoach: false,
                averageCycleLength: data.profile.averageCycleLength,
                averagePeriodLength: data.profile.averagePeriodLength ?? 5,
                lastPeriodStart: data.profile.lastPeriodStart,
                lastPeriodEnd: data.profile.lastPeriodEnd ?? null,
                periodHistory: [],
                trackSexualActivity: false,
                cycleRegularity: null,
                onHormonalBirthControl: null,
                computedCycleLengthMin: null,
                computedCycleLengthMax: null,
                cyclePromoDismissedAt: null,
                cycleDashboardBannerDismissedAt: null,
                setupCompleted: true,
              }}
              phaseInfo={data.phase}
            />
            {data.profile?.lastPeriodStart && (
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                Last period: {formatDateDisplay(data.profile.lastPeriodStart)}
                {data.profile.lastPeriodEnd
                  ? ` – ${formatDateDisplay(data.profile.lastPeriodEnd)}`
                  : ""}{" "}
                · Cycle length {data.profile.averageCycleLength} days
              </p>
            )}
          </Card>

          {data.summary && (
            <Card className="p-6">
              <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Last 2 weeks</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">Avg mood</p>
                  <p className="text-xl font-semibold text-[var(--color-text)]">
                    {data.summary.avgMood7d ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">Avg energy</p>
                  <p className="text-xl font-semibold text-[var(--color-text)]">
                    {data.summary.avgEnergy7d ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">Days logged</p>
                  <p className="text-xl font-semibold text-[var(--color-text)]">{data.summary.daysLogged}</p>
                </div>
              </div>
            </Card>
          )}

          {(data.recentLogs?.length ?? 0) > 0 && (
            <Card className="p-6">
              <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Daily logs</h2>
              <ul className="space-y-3">
                {data.recentLogs!.map((log) => (
                  <li
                    key={log.date}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-text)]">
                        {formatDateDisplay(log.date)}
                      </span>
                      <span className="text-[var(--color-text-secondary)]">
                        {log.mood != null && `Mood ${log.mood}`}
                        {log.mood != null && log.energy != null && " · "}
                        {log.energy != null && `Energy ${log.energy}`}
                        {log.isPeriodDay && " · Period"}
                      </span>
                    </div>
                    {(log.symptoms.length > 0 || log.feelings.length > 0) && (
                      <p className="mt-1 text-[var(--color-text-muted)]">
                        {[...log.symptoms, ...log.feelings].join(", ")}
                      </p>
                    )}
                    {log.note && (
                      <p className="mt-2 text-[var(--color-text-secondary)] italic">&ldquo;{log.note}&rdquo;</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
