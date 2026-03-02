"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ClientInventoryPanel, type InventoryClient, type InventoryStats } from "@/components/coach/ClientInventoryPanel";
import { useApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
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

export default function CoachDashboardPage() {
  const { user, identity } = useAuth();
  const { fetchWithAuth } = useApiClient();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [inventoryClients, setInventoryClients] = useState<InventoryClient[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [checkInsTab, setCheckInsTab] = useState<"toReview" | "completed">("toReview");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateRange, setDateRange] = useState<string>("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySort, setInventorySort] = useState<"name" | "lastCheckIn" | "overdue">("name");

  const coachName = identity?.firstName
    ? identity.firstName
    : (user?.displayName ?? "").split(" ")[0] || null;
  const welcome = coachName ? `Welcome back, ${coachName}!` : "Dashboard";
  const coachCode = identity?.coachCode;

  const load = async () => {
    setLoading(true);
    setInventoryLoading(true);
    setAuthError(false);
    try {
      const [overviewRes, inventoryRes] = await Promise.all([
        fetchWithAuth("/api/coach/dashboard"),
        fetchWithAuth("/api/coach/clients/inventory"),
      ]);
      if (overviewRes.status === 401 || inventoryRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (overviewRes.ok) {
        const data = await overviewRes.json();
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
      if (inventoryRes.ok) {
        const data = await inventoryRes.json();
        setInventoryStats(data.stats ?? null);
        setInventoryClients(Array.isArray(data.clients) ? data.clients : []);
      }
    } finally {
      setLoading(false);
      setInventoryLoading(false);
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
    <div className="space-y-8">
      {/* Header: title, welcome, coach code */}
      <header className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{welcome}</p>
        </div>
        {coachCode && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-primary)] bg-[var(--color-primary-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)]"
              title="Coach code"
            >
              <span aria-hidden className="text-[var(--color-primary)] opacity-80">
                <CodeIcon />
              </span>
              {coachCode}
            </span>
          </div>
        )}
      </header>

      {loading && <DashboardSkeleton />}

      {!loading && overview && (
        <>
          {/* KPI cards – match reference labels */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {overview.needsResponse}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--color-text-secondary)]">
                    Needs Response
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Awaiting your feedback</p>
                </div>
                <span className="rounded-lg bg-[var(--color-primary-subtle)] p-2 text-[var(--color-primary)]" aria-hidden>
                  <ClockIcon />
                </span>
              </div>
            </Card>
            <Card className="p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {overview.activeClients}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--color-text-secondary)]">
                    Client Engagement
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Active clients</p>
                </div>
                <span className="rounded-lg bg-[var(--color-primary-subtle)] p-2 text-[var(--color-primary)]" aria-hidden>
                  <PeopleIcon />
                </span>
              </div>
            </Card>
            <Card className="p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {overview.formsCount}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--color-text-secondary)]">
                    Platform Resources
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Available forms</p>
                </div>
                <span className="rounded-lg bg-[var(--color-primary-subtle)] p-2 text-[var(--color-primary)]" aria-hidden>
                  <DocIcon />
                </span>
              </div>
            </Card>
            <Card className="p-5 transition-shadow hover:shadow-sm border-[var(--color-primary-muted)]/30 bg-[var(--color-primary-subtle)]/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {overview.completedThisWeek}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--color-text-secondary)]">
                    Recent Activity
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Completed this week</p>
                </div>
                <span className="rounded-lg bg-[var(--color-primary-subtle)] p-2 text-[var(--color-primary)]" aria-hidden>
                  <CheckIcon />
                </span>
              </div>
            </Card>
          </div>

          {/* Check-ins Management – compact table */}
          <section>
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Check-ins Management
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
          </section>

          {/* Client inventory panel */}
          <ClientInventoryPanel
            stats={inventoryStats}
            clients={inventoryClients}
            loading={inventoryLoading}
            search={inventorySearch}
            onSearchChange={setInventorySearch}
            sort={inventorySort}
            onSortChange={setInventorySort}
            compactTitle
          />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5">
            <div className="h-8 w-16 rounded bg-[var(--color-border)]" />
            <div className="mt-3 h-4 w-24 rounded bg-[var(--color-border)]" />
            <div className="mt-2 h-3 w-32 rounded bg-[var(--color-border)]" />
          </Card>
        ))}
      </div>
      <div>
        <div className="h-6 w-48 rounded bg-[var(--color-border)]" />
        <div className="mt-3 flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-[var(--color-border)]" />
          <div className="h-10 w-24 rounded-lg bg-[var(--color-border)]" />
        </div>
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="h-5 w-32 rounded bg-[var(--color-border)]" />
              <div className="mt-2 h-4 w-48 rounded bg-[var(--color-border)]" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  );
}
