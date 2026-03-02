"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

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

  const load = async () => {
    setLoading(true);
    setAuthError(false);
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

      {!loading && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Add your first client to get started."
          actionLabel="Add new client"
          actionHref="/coach/clients/new"
        />
      )}

      {!loading && clients.length > 0 && (
        <>
          <p className="text-sm text-[var(--color-text-muted)]">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Status</th>
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
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
                  >
                    <td className="px-3 py-2">
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
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="secondary">
                          <Link href={`/coach/clients/${c.id}/progress`}>Progress</Link>
                        </Button>
                        <Button asChild variant="primary">
                          <Link href={`/coach/clients/${c.id}`}>Check-ins</Link>
                        </Button>
                      </div>
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
