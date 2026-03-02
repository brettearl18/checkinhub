"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

interface HistoryItem {
  id: string;
  formTitle: string;
  reflectionWeekStart?: string;
  completedAt: string | null;
  score: number | null;
  responseId: string | null;
}

export default function ClientHistoryPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setLoadError(null);
    try {
      const res = await fetchWithAuth("/api/client/history");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      } else {
        setLoadError("Couldn’t load history. Please try again.");
        setList([]);
      }
    } catch {
      setLoadError("Couldn’t load history. Please try again.");
      setList([]);
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
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Check-in history</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">Past check-ins, sorted by date completed.</p>

      {loadError && (
        <div className="rounded border border-[var(--color-error)] px-4 py-3 text-sm text-[var(--color-error)] flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" onClick={load} className="font-medium underline hover:no-underline">
            Retry
          </button>
        </div>
      )}
      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && !loadError && list.length === 0 && (
        <EmptyState
          title="No check-ins yet"
          description="Complete a check-in to see it here."
          actionLabel="New check-in"
          actionHref="/client/check-in/new"
        />
      )}
      {!loading && list.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {list.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-primary-subtle)]"
              >
                <Link
                  href={item.responseId ? `/client/response/${item.responseId}` : `/client/check-in/${item.id}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--color-text)]">{item.formTitle}</span>
                    {item.score != null && (
                      <span className="text-sm text-[var(--color-text-muted)] shrink-0">{item.score}%</span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-2 text-sm text-[var(--color-text-muted)]">
                    {item.completedAt && (
                      <span>Completed {formatDateDisplay(item.completedAt)}</span>
                    )}
                    {item.reflectionWeekStart && (
                      <span>Week of {formatDateDisplay(item.reflectionWeekStart)}</span>
                    )}
                  </div>
                </Link>
                {item.responseId && (
                  <Button asChild variant="secondary" className="shrink-0">
                    <Link href={`/client/response/${item.responseId}`}>Scorecard</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
