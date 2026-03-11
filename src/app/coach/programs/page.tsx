"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

type ProgramBlock = { type: string; restSeconds?: number; exercises: { exerciseId: string }[] };
type ProgramDay = { name?: string; blocks?: ProgramBlock[] };
type ProgramWeek = { days: ProgramDay[] };

interface Program {
  id: string;
  name: string;
  description: string;
  durationWeeks?: number;
  phaseName?: string;
  weeks: ProgramWeek[];
  createdAt: string | null;
  updatedAt: string | null;
}

function exerciseCount(weeks: ProgramWeek[]): number {
  let n = 0;
  for (const w of weeks) {
    for (const d of w.days) {
      for (const b of d.blocks ?? []) {
        n += (b.exercises?.length ?? 0);
      }
    }
  }
  return n;
}

export default function CoachProgramsPage() {
  const { fetchWithAuth } = useApiClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/programs");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPrograms(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this program? You can no longer assign it to clients.")) return;
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/coach/programs/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setDeletingId(null);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Programs</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Create program templates (weeks → days → exercises). Assign them to clients later.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/coach/programs/new">New program</Link>
        </Button>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && programs.length === 0 && (
        <EmptyState
          title="No programs yet"
          description="Create your first program template. Add weeks, days, and exercises from your library."
          actionLabel="New program"
          actionHref="/coach/programs/new"
        />
      )}

      {!loading && programs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Description</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Weeks · Days · Exercises</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((prog) => {
                const weeks = prog.weeks?.length ?? 0;
                let days = 0;
                const exCount = exerciseCount(prog.weeks ?? []);
                for (const w of prog.weeks ?? []) days += w.days?.length ?? 0;
                return (
                  <tr key={prog.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{prog.name}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-[var(--color-text-muted)]" title={prog.description || undefined}>
                      {prog.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {weeks} week{weeks !== 1 ? "s" : ""} · {days} day{days !== 1 ? "s" : ""} · {exCount} exercise{exCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="ghost" className="min-h-[36px]">
                          <Link href={`/coach/programs/assign?programId=${encodeURIComponent(prog.id)}`}>Assign</Link>
                        </Button>
                        <Button asChild variant="ghost" className="min-h-[36px]">
                          <Link href={`/coach/programs/${prog.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-[36px] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                          onClick={() => handleDelete(prog.id)}
                          disabled={deletingId === prog.id}
                        >
                          {deletingId === prog.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
