"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

function formatDateDisplay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  programWeeks: number | null;
  paymentStatus: string | null;
  lastPaymentAt: string | null;
  weightLossKg: number | null;
  trendPct: number;
  avgCheckInPct?: number;
  allocatedForms?: string | null;
}

function paymentLabel(paymentStatus: string | null): string {
  if (!paymentStatus) return "—";
  if (paymentStatus === "paid") return "Paid";
  if (paymentStatus === "past_due") return "Past due";
  if (paymentStatus === "failed") return "Failed";
  if (paymentStatus === "canceled") return "Canceled";
  return paymentStatus;
}

export default function CoachClientsListPage() {
  const { fetchWithAuth } = useApiClient();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forms, setForms] = useState<{ id: string; title?: string }[]>([]);
  const [bulkFormId, setBulkFormId] = useState("");
  const [bulkWeek, setBulkWeek] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resendState, setResendState] = useState<{ clientId: string; loading: boolean; message: string | null }>({
    clientId: "",
    loading: false,
    message: null,
  });

  const bulkWeekOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = -2; i <= 1; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + 7 * i);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const m = new Date(d);
      m.setDate(diff);
      const monday = m.toISOString().slice(0, 10);
      const [y, mo, dayNum] = monday.split("-").map(Number);
      const end = new Date(y, mo - 1, dayNum);
      end.setDate(end.getDate() + 6);
      const endStr = end.toISOString().slice(0, 10);
      options.push({ value: monday, label: `${formatDateDisplay(monday)} – ${formatDateDisplay(endStr)}` });
    }
    return options;
  }, []);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setLoadError(null);
    try {
      const res = await fetchWithAuth("/api/coach/clients/inventory");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data.clients) ? data.clients : []);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth("/api/coach/forms");
        if (res.ok) {
          const data = await res.json();
          setForms(Array.isArray(data) ? data : []);
        }
      } catch {
        // non-fatal
      }
    })();
  }, [fetchWithAuth]);

  const applyBulkRecurring = async () => {
    if (!bulkFormId || !bulkWeek) return;
    setBulkApplying(true);
    setBulkResult(null);
    try {
      const res = await fetchWithAuth("/api/coach/assignments/bulk-recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: bulkFormId, reflectionWeekStart: bulkWeek }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkResult({ type: "error", text: data.error ?? "Failed to apply to all clients." });
        return;
      }
      setBulkResult({
        type: "success",
        text: `Created ${data.created ?? 0} assignments for ${data.clientsProcessed ?? 0} clients.${(data.errors?.length ?? 0) > 0 ? ` ${data.errors.length} client(s) had errors.` : ""}`,
      });
      setBulkFormId("");
      setBulkWeek("");
      load();
    } finally {
      setBulkApplying(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Clients</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Your client list. Open a client to view check-ins, add feedback, or assign a check-in.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/coach/clients/new">Add new client</Link>
        </Button>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {loadError && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          <p>{loadError}</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !loadError && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Add your first client to get started."
          actionLabel="Add new client"
          actionHref="/coach/clients/new"
        />
      )}

      {!loading && !loadError && clients.length > 0 && (
        <>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <button
              type="button"
              onClick={() => setBulkOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-[var(--color-text)]"
            >
              Assign recurring check-in to all profiles
              <span className="text-[var(--color-text-muted)]">{bulkOpen ? "▼" : "▶"}</span>
            </button>
            {bulkOpen && (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--color-border)] pt-4">
                <div className="min-w-[200px]">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Form</label>
                  <select
                    value={bulkFormId}
                    onChange={(e) => setBulkFormId(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="">Select form</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>{f.title ?? f.id}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[220px]">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">First week</label>
                  <select
                    value={bulkWeek}
                    onChange={(e) => setBulkWeek(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="">Select week</option>
                    {bulkWeekOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  onClick={applyBulkRecurring}
                  disabled={!bulkFormId || !bulkWeek || bulkApplying}
                >
                  {bulkApplying ? "Applying…" : `Apply to all ${clients.length} clients`}
                </Button>
                {bulkResult && (
                  <p className={`text-sm ${bulkResult.type === "success" ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`} role="alert">
                    {bulkResult.text}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="sticky left-0 z-10 min-w-[120px] bg-[var(--color-bg-elevated)] px-3 py-2 text-left font-medium text-[var(--color-text)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Check-in form</th>
                  <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Weeks</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Payment</th>
                  <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Weight Δ</th>
                  <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Check-in %</th>
                  <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
                  >
                    <td className="sticky left-0 z-10 min-w-[120px] bg-[var(--color-bg)] px-3 py-2 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-[var(--color-bg-elevated)]">
                      <span className="font-medium text-[var(--color-text)]">
                        {c.firstName} {c.lastName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)] truncate max-w-[180px]" title={c.email}>
                      {c.email}
                    </td>
                    <td className="px-3 py-2">
                      <span className="capitalize text-[var(--color-text-secondary)]">{c.status}</span>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] max-w-[200px] truncate" title={c.allocatedForms ?? undefined}>
                      {c.allocatedForms ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-secondary)] tabular-nums">
                      {c.programWeeks != null ? c.programWeeks : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {c.paymentStatus ? (
                        <span className={c.paymentStatus === "paid" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                          {paymentLabel(c.paymentStatus)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {c.weightLossKg != null ? (
                        <span className={c.weightLossKg <= 0 ? "text-green-600 dark:text-green-400" : ""}>
                          {c.weightLossKg > 0 ? "+" : ""}{c.weightLossKg} kg
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {(c.avgCheckInPct ?? c.trendPct) != null ? `${c.avgCheckInPct ?? c.trendPct}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {c.status === "pending" && (
                          <Button
                            variant="secondary"
                            disabled={resendState.loading}
                            onClick={async () => {
                              setResendState({ clientId: c.id, loading: true, message: null });
                              try {
                                const res = await fetchWithAuth(`/api/coach/clients/${c.id}/resend-onboarding`, {
                                  method: "POST",
                                });
                                const data = await res.json().catch(() => ({}));
                                if (res.ok) {
                                  setResendState({
                                    clientId: c.id,
                                    loading: false,
                                    message: "Invite sent.",
                                  });
                                } else {
                                  setResendState({
                                    clientId: c.id,
                                    loading: false,
                                    message: (data.error as string) || "Failed",
                                  });
                                }
                              } catch {
                                setResendState({
                                  clientId: c.id,
                                  loading: false,
                                  message: "Request failed",
                                });
                              }
                            }}
                          >
                            {resendState.clientId === c.id && resendState.loading ? "Sending…" : "Resend invite"}
                          </Button>
                        )}
                        <Button asChild variant="secondary">
                          <Link href={`/coach/clients/${c.id}/progress`}>Progress</Link>
                        </Button>
                        <Button asChild variant="primary">
                          <Link href={`/coach/clients/${c.id}`}>Check-ins</Link>
                        </Button>
                      </div>
                      {c.status === "pending" && resendState.clientId === c.id && resendState.message && !resendState.loading && (
                        <p className={`mt-1 text-xs text-right ${resendState.message === "Invite sent." ? "text-green-600 dark:text-green-400" : "text-[var(--color-error)]"}`}>
                          {resendState.message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
