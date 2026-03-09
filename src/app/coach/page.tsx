"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ClientInventoryPanel, type InventoryClient, type InventoryStats } from "@/components/coach/ClientInventoryPanel";
import { useApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

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


export default function CoachDashboardPage() {
  const { user, identity } = useAuth();
  const { fetchWithAuth } = useApiClient();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [inventoryClients, setInventoryClients] = useState<InventoryClient[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySort, setInventorySort] = useState<"name" | "lastCheckIn" | "overdue">("name");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remindLoadingId, setRemindLoadingId] = useState<string | null>(null);
  const [remindResult, setRemindResult] = useState<{ clientId: string; type: "success" | "error"; text: string } | null>(null);
  const coachName = identity?.firstName
    ? identity.firstName
    : (user?.displayName ?? "").split(" ")[0] || null;
  const welcome = coachName ? `Welcome back, ${coachName}!` : "Dashboard";
  const coachCode = identity?.coachCode;

  const load = async () => {
    setLoading(true);
    setInventoryLoading(true);
    setAuthError(false);
    setLoadError(null);
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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

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

      {loadError && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          <p>{loadError}</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !loadError && overview && (
        <>
          {/* KPI cards – match reference labels */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/coach/check-ins">
              <Card className="p-5 transition-shadow hover:shadow-sm hover:border-[var(--color-primary-muted)] cursor-pointer">
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
            </Link>
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Check-ins</h2>
            <Button asChild variant="primary">
              <Link href="/coach/check-ins">
                View {overview.needsResponse}
                {overview.needsResponse === 1 ? " check-in" : " check-ins"} to review →
              </Link>
            </Button>
          </div>

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
            onSendReminder={async (clientId) => {
              setRemindResult(null);
              setRemindLoadingId(clientId);
              try {
                const res = await fetchWithAuth(`/api/coach/clients/${clientId}/send-check-in-reminder`, {
                  method: "POST",
                });
                const data = await res.json().catch(() => ({}));
                if (res.status === 401) {
                  setAuthError(true);
                  return;
                }
                if (res.ok) {
                  setRemindResult({ clientId, type: "success", text: "Sent" });
                } else {
                  setRemindResult({ clientId, type: "error", text: (data.error as string) || "Failed" });
                }
              } catch {
                setRemindResult({ clientId, type: "error", text: "Failed" });
              } finally {
                setRemindLoadingId(null);
              }
            }}
            remindLoadingId={remindLoadingId}
            remindResult={remindResult}
          />

          {/* Email settings link */}
          <Link href="/coach/settings">
            <Card className="p-5 border-[var(--color-border)] bg-[var(--color-bg-elevated)] transition-shadow hover:shadow-sm hover:border-[var(--color-primary-muted)] cursor-pointer">
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Email</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Test Mailgun and preview reminder emails (check-in open / closing). Configure in Settings.
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--color-primary)]">Open email settings →</p>
            </Card>
          </Link>
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
