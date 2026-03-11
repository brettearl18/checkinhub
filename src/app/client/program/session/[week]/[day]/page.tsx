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
    exerciseName: string;
    sets?: string;
    reps?: string;
    notes?: string;
    videoUrl?: string;
    imageUrl?: string;
  }[];
};

interface SessionData {
  programName: string;
  weekIndex: number;
  dayIndex: number;
  session: {
    weekLabel: string;
    dayLabel: string;
    blocks: Block[];
  };
}

export default function ClientProgramSessionPage() {
  const params = useParams();
  const week = params?.week as string;
  const day = params?.day as string;
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!week || !day) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithAuth(`/api/client/program/session?week=${encodeURIComponent(week)}&day=${encodeURIComponent(day)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (!res.ok) {
          setError("Session not found.");
          return;
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [week, day, fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/client/program" className="text-sm text-[var(--color-primary)] hover:underline">← Program</Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link href="/client/program" className="text-sm text-[var(--color-primary)] hover:underline">← Program</Link>
        <p className="text-[var(--color-error)]">{error ?? "Session not found."}</p>
      </div>
    );
  }

  const { session } = data;

  return (
    <div className="space-y-6">
      <Link href="/client/program" className="text-sm text-[var(--color-primary)] hover:underline">← Program</Link>
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{data.programName}</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          {session.weekLabel} – {session.dayLabel}
        </p>
      </div>

      <div className="space-y-6">
        {session.blocks.map((block, blockIdx) => (
          <Card key={blockIdx} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {block.type === "superset" ? "Superset" : block.type === "circuit" ? "Circuit" : "Straight sets"}
              </span>
              {typeof block.restSeconds === "number" && block.restSeconds > 0 && (
                <span className="text-xs text-[var(--color-text-muted)]">Rest {block.restSeconds}s after</span>
              )}
            </div>
            <ul className="space-y-3">
              {block.exercises.map((ex, exIdx) => (
                <li key={exIdx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="font-medium text-[var(--color-text)]">{ex.exerciseName}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm text-[var(--color-text-secondary)]">
                    {ex.sets != null && ex.sets !== "" && <span>Sets: {ex.sets}</span>}
                    {ex.reps != null && ex.reps !== "" && <span>Reps: {ex.reps}</span>}
                    {(ex.sets || ex.reps) && <span>·</span>}
                    {ex.notes != null && ex.notes !== "" && <span>{ex.notes}</span>}
                  </div>
                  {(ex.videoUrl || ex.imageUrl) && (
                    <p className="mt-1 text-xs text-[var(--color-primary)]">
                      {ex.videoUrl ? "Video available" : "Image available"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
