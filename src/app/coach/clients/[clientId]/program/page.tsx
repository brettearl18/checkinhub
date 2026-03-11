"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

type Block = {
  type: string;
  restSeconds?: number;
  exercises: {
    exerciseId: string;
    exerciseName?: string;
    sets?: string;
    reps?: string;
    notes?: string;
  }[];
};

interface Assignment {
  clientId: string;
  programId: string;
  programName: string;
  programSnapshot: { days: { name?: string; blocks: Block[] }[] }[];
  startDate: string;
  currentWeek: number;
  status: string;
}

function formatDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CoachClientProgramViewPage() {
  const params = useParams();
  const clientId = params?.clientId as string;
  const { fetchWithAuth } = useApiClient();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithAuth(`/api/coach/clients/${clientId}/program`),
      fetchWithAuth("/api/coach/clients"),
    ])
      .then(([progRes, clientsRes]) => {
        if (cancelled) return;
        if (progRes.status === 401 || clientsRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (progRes.ok) {
          progRes.json().then((data) => {
            if (!cancelled && data && data.programId) setAssignment(data);
          });
        } else {
          if (!cancelled) setAssignment(null);
        }
        if (clientsRes.ok) {
          clientsRes.json().then((list: { id: string; firstName?: string; lastName?: string }[]) => {
            if (!cancelled && Array.isArray(list)) {
              const c = list.find((x) => x.id === clientId);
              if (c) setClientName([c.firstName, c.lastName].filter(Boolean).join(" ") || clientId);
            }
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href={`/coach/clients/${clientId}`} className="text-sm text-[var(--color-primary)] hover:underline">← Check-ins</Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="space-y-6">
        <Link href={`/coach/clients/${clientId}`} className="text-sm text-[var(--color-primary)] hover:underline">← Check-ins</Link>
        <p className="text-[var(--color-text-muted)]">No program assigned to this client.</p>
      </div>
    );
  }

  const weeks = assignment.programSnapshot ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/coach/clients/${clientId}`} className="text-sm text-[var(--color-primary)] hover:underline">← Check-ins</Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          {clientName ?? "Client"} – Program
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {assignment.programName} · Started {formatDate(assignment.startDate)} · Week {assignment.currentWeek}
        </p>
      </div>

      <div className="space-y-6">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx}>
            <h2 className="text-sm font-semibold text-[var(--color-text)] mb-2">Week {weekIdx + 1}</h2>
            <div className="space-y-4">
              {(week.days ?? []).map((day, dayIdx) => (
                <Card key={dayIdx} className="p-4 space-y-3">
                  <p className="font-medium text-[var(--color-text)]">{day.name || `Day ${dayIdx + 1}`}</p>
                  {(day.blocks ?? []).map((block, blockIdx) => (
                    <div key={blockIdx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 space-y-2">
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                        <span className="font-medium uppercase tracking-wider">
                          {block.type === "superset" ? "Superset" : block.type === "circuit" ? "Circuit" : "Straight sets"}
                        </span>
                        {typeof block.restSeconds === "number" && block.restSeconds > 0 && (
                          <span>Rest {block.restSeconds}s after</span>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {(block.exercises ?? []).map((ex, exIdx) => (
                          <li key={exIdx} className="text-sm text-[var(--color-text-secondary)]">
                            <span className="font-medium text-[var(--color-text)]">{ex.exerciseName ?? ex.exerciseId}</span>
                            {(ex.sets != null && ex.sets !== "") || (ex.reps != null && ex.reps !== "") ? (
                              <span className="ml-2">
                                {ex.sets != null && ex.sets !== "" ? `${ex.sets} sets` : ""}
                                {ex.sets && ex.reps ? " × " : ""}
                                {ex.reps != null && ex.reps !== "" ? `${ex.reps} reps` : ""}
                              </span>
                            ) : null}
                            {ex.notes != null && ex.notes !== "" && (
                              <span className="ml-2 text-[var(--color-text-muted)]">· {ex.notes}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
