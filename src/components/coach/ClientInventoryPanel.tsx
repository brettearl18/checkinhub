"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export interface InventoryClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  lastCheckInAt: string | null;
  overdueCount: number;
  avgScore: number | null;
  trendCompleted: number;
  trendTotal: number;
  trendPct: number;
  progressDots: ("green" | "orange" | "red" | "empty")[];
  weeks: number;
}

export interface InventoryStats {
  total: number;
  active: number;
  pending: number;
  overdue: number;
  avgProgress: number | null;
}

function initial(name: string): string {
  const n = name.trim();
  return n ? n[0].toUpperCase() : "?";
}

function formatLastCheckIn(iso: string | null, overdueCount: number): string {
  if (!iso) return overdueCount > 0 ? `Never (${overdueCount} overdue)` : "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

interface ClientInventoryPanelProps {
  stats: InventoryStats | null;
  clients: InventoryClient[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  sort: "name" | "lastCheckIn" | "overdue";
  onSortChange: (value: "name" | "lastCheckIn" | "overdue") => void;
  /** If true, show compact header (e.g. when embedded on dashboard). */
  compactTitle?: boolean;
}

export function ClientInventoryPanel({
  stats,
  clients,
  loading,
  search,
  onSearchChange,
  sort,
  onSortChange,
  compactTitle,
}: ClientInventoryPanelProps) {
  const filtered = clients.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    const email = (c.email ?? "").toLowerCase();
    const phone = (c.phone ?? "").replace(/\s/g, "");
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") {
      const na = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nb = `${b.firstName} ${b.lastName}`.toLowerCase();
      return na.localeCompare(nb);
    }
    if (sort === "lastCheckIn") {
      const ta = a.lastCheckInAt ? new Date(a.lastCheckInAt).getTime() : 0;
      const tb = b.lastCheckInAt ? new Date(b.lastCheckInAt).getTime() : 0;
      return tb - ta;
    }
    return b.overdueCount - a.overdueCount;
  });

  return (
    <section className="space-y-4">
      {!compactTitle && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Client Inventory</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            Manage your client relationships and track their progress.
          </p>
        </div>
      )}
      {compactTitle && (
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Client Inventory</h2>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-4">
            <p className="text-2xl font-semibold text-[var(--color-text)]">{stats.total}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Total clients</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-green-500">
            <p className="text-2xl font-semibold text-[var(--color-text)]">{stats.active}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Active</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-semibold text-[var(--color-text)]">{stats.pending}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Pending</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-2xl font-semibold text-[var(--color-text)]">{stats.overdue}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Overdue</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-semibold text-[var(--color-text)]">
              {stats.avgProgress != null ? `${stats.avgProgress}%` : "N/A"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Avg progress</p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as "name" | "lastCheckIn" | "overdue")}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="name">Name A–Z</option>
          <option value="lastCheckIn">Last check-in</option>
          <option value="overdue">Overdue</option>
        </select>
        {stats && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {sorted.length} client{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && sorted.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            {clients.length === 0
              ? "No clients yet. Clients assigned to you will appear here."
              : "No clients match your search."}
          </p>
        </Card>
      )}

      {!loading && sorted.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">NAME</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">STATUS</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">PROGRESS</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">TREND</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">WEEKS</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">AVG SCORE</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">LAST CHECK-IN</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-primary-subtle)]/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-muted)] text-sm font-medium text-[var(--color-text)]"
                          aria-hidden
                        >
                          {initial(c.firstName)}
                        </span>
                        <div>
                          <span className="font-medium text-[var(--color-text)]">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="ml-2 inline rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {c.status === "active" ? "Active" : c.status || "—"}
                          </span>
                          {c.phone && (
                            <p className="text-xs text-[var(--color-text-muted)]">{c.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {c.overdueCount > 0 ? (
                        <span className="text-red-600 dark:text-red-400">{c.overdueCount} overdue</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {c.progressDots.map((dot, i) => (
                          <span
                            key={i}
                            className={`h-2.5 w-2.5 rounded-full ${
                              dot === "green"
                                ? "bg-green-500"
                                : dot === "orange"
                                  ? "bg-amber-500"
                                  : dot === "red"
                                    ? "bg-red-500"
                                    : "bg-[var(--color-border)]"
                            }`}
                            title={dot !== "empty" ? `Score band ${i + 1}` : "No data"}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[var(--color-text)]">
                        {c.trendCompleted}/{c.trendTotal}
                      </span>
                      <span className="ml-1 text-[var(--color-text-muted)]">({c.trendPct}%)</span>
                      <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-border)]">
                        <div
                          className={`h-full ${
                            c.trendPct >= 70 ? "bg-green-500" : c.trendPct >= 40 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${c.trendPct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.weeks}</td>
                    <td className="px-4 py-3">
                      {c.avgScore != null ? (
                        <span className="text-[var(--color-text)]">{c.avgScore}%</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {formatLastCheckIn(c.lastCheckInAt, c.overdueCount)}
                      {c.overdueCount > 0 && c.lastCheckInAt && (
                        <span className="ml-1 text-red-600 dark:text-red-400">
                          {c.overdueCount} overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/coach/clients/${c.id}/progress`}
                          className="text-sm text-[var(--color-primary)] hover:underline"
                        >
                          Progress
                        </Link>
                        <span className="text-[var(--color-border)]">|</span>
                        <Link
                          href={`/coach/clients/${c.id}`}
                          className="inline-block rounded border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-muted)]"
                        >
                          View check-ins
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
