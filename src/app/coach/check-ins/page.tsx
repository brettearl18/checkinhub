"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

type ResponseItem = {
  responseId: string;
  clientId: string;
  clientName: string;
  formTitle: string;
  submittedAt: number;
  score: number;
};

interface DashboardOverview {
  needsResponse: number;
  activeClients: number;
  formsCount: number;
  completedThisWeek: number;
  toReview: ResponseItem[];
  completed: ResponseItem[];
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const;

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

function formatTimeAgo(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return formatDateDisplay(ts);
}

export default function CoachCheckInsPage() {
  const { fetchWithAuth } = useApiClient();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [checkInsTab, setCheckInsTab] = useState<"toReview" | "completed">("toReview");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateRange, setDateRange] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/dashboard");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setOverview({
          ...data,
          toReview: data.toReview ?? [],
          completed: data.completed ?? [],
        });
      } else {
        setOverview({
          needsResponse: 0,
          activeClients: 0,
          formsCount: 0,
          completedThisWeek: 0,
          toReview: [],
          completed: [],
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const list = useMemo(() => {
    if (!overview) return [];
    const raw = checkInsTab === "toReview" ? overview.toReview : overview.completed;
    const days = dateRange === "all" ? null : parseInt(dateRange, 10);
    const cutoff = days != null && !Number.isNaN(days) ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    const filtered = cutoff > 0 ? raw.filter((r) => r.submittedAt >= cutoff) : raw;
    const sorted = [...filtered].sort((a, b) =>
      sort === "newest" ? b.submittedAt - a.submittedAt : a.submittedAt - b.submittedAt
    );
    return sorted;
  }, [overview, checkInsTab, sort, dateRange]);

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          Check-ins Management
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Review and respond to client check-ins. Filter by date range and sort as needed.
        </p>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-10 w-64 rounded bg-[var(--color-border)]" />
          <Card className="p-6">
            <div className="h-48 rounded bg-[var(--color-border)]" />
          </Card>
        </div>
      )}

      {!loading && overview && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Check-ins
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
                <button
                  type="button"
                  onClick={() => setCheckInsTab("toReview")}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    checkInsTab === "toReview"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
                  }`}
                >
                  To Review ({overview.needsResponse})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInsTab("completed")}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    checkInsTab === "completed"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
                  }`}
                >
                  Done ({overview.completed.length})
                </button>
              </div>
              <select
                id="date-range-checkins"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                aria-label="Filter by date range"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                id="sort-checkins"
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">
                {checkInsTab === "toReview"
                  ? "No check-ins awaiting feedback."
                  : "No completed check-ins yet."}
              </p>
              <Button asChild variant="primary" size="sm" className="mt-2">
                <Link href="/coach/clients">View clients</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                    <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Client</th>
                    <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Form</th>
                    <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-muted)]">Time</th>
                    <th className="px-3 py-1.5 text-right font-medium text-[var(--color-text-muted)]">Score</th>
                    <th className="px-3 py-1.5 text-right font-medium text-[var(--color-text-muted)] w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.responseId}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-subtle)]/40"
                    >
                      <td className="px-3 py-1.5 font-medium text-[var(--color-text)]">
                        {r.clientName}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)] truncate max-w-[140px]">
                        {r.formTitle}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatTimeAgo(r.submittedAt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text)]">
                        {typeof r.score === "number" ? `${r.score}%` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Link
                          href={`/coach/clients/${r.clientId}/responses/${r.responseId}`}
                          className="inline-block rounded bg-[var(--color-primary)] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          {checkInsTab === "toReview" ? "Respond" : "View"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
