"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string | null;
  status: string;
  progress: number;
}

export default function ClientGoalsPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/client/goals");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Goals</h1>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <EmptyState
          title="No goals yet"
          description="Your coach may add goals for you here."
        />
      )}
      {!loading && list.length > 0 && (
        <ul className="space-y-4">
          {list.map((g) => (
            <Card key={g.id} className="p-6">
              <h3 className="font-medium text-[var(--color-text)]">{g.title}</h3>
              {g.description && (
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{g.description}</p>
              )}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-lg font-semibold text-[var(--color-primary)]">{g.currentValue}</span>
                <span className="text-sm text-[var(--color-text-muted)]">/ {g.targetValue} {g.unit}</span>
              </div>
              {g.deadline && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  By {formatDateDisplay(g.deadline)}
                </p>
              )}
              {typeof g.progress === "number" && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full bg-[var(--color-primary)]"
                    style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                  />
                </div>
              )}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
