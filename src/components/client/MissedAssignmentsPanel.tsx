"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";
import { formatDateDdMmYyyy } from "@/lib/format-date";

export interface MissedAssignment {
  id: string;
  formTitle: string | null;
  reflectionWeekStart: string | null;
}

export function MissedAssignmentsPanel({ onRestored }: { onRestored?: () => void }) {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<MissedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/check-in/missed-assignments");
      if (!res.ok) {
        setList([]);
        return;
      }
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const undoMissed = async (assignmentId: string) => {
    setError(null);
    setUndoingId(assignmentId);
    try {
      const res = await fetchWithAuth(`/api/check-in/${assignmentId}/undo-missed`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : "Could not undo missed check-in.");
        return;
      }
      setList((prev) => prev.filter((m) => m.id !== assignmentId));
      onRestored?.();
    } catch {
      setError("Could not undo missed check-in.");
    } finally {
      setUndoingId(null);
    }
  };

  if (loading || list.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <details className="group">
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)]">Marked as missed</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                Tapped by mistake? Undo to put a check-in back on your to-do list.
              </p>
            </div>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)] group-open:hidden">
              {list.length} · Show
            </span>
            <span className="hidden shrink-0 text-xs text-[var(--color-text-muted)] group-open:inline">
              Hide
            </span>
          </div>
        </summary>

        {error && (
          <p className="border-t border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-error)]">
            {error}
          </p>
        )}

        <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {list.map((m) => {
            const weekLabel = m.reflectionWeekStart ? formatDateDdMmYyyy(m.reflectionWeekStart) : null;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{m.formTitle ?? "Check-in"}</p>
                  {weekLabel && (
                    <p className="text-xs text-[var(--color-text-muted)]">Week of {weekLabel}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 py-1.5 text-xs"
                  disabled={undoingId === m.id}
                  onClick={() => undoMissed(m.id)}
                >
                  {undoingId === m.id ? "Restoring…" : "Undo missed"}
                </Button>
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}
