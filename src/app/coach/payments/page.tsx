"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

type PaymentFilter = "all" | "paid" | "behind" | "not_linked";

interface PaymentClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  stripeCustomerId: string | null;
  paymentStatus: string | null;
  lastPaymentAt: string | null;
  nextBillingAt: string | null;
  packageExpiresAt: string | null;
}

interface PaymentsData {
  clients: PaymentClient[];
  stats: { paidUp: number; behind: number; notLinked: number; total: number };
}

function getPaymentLabel(c: PaymentClient): string {
  if (c.packageExpiresAt) return "Paid up";
  if (!c.stripeCustomerId) return "Not linked";
  switch (c.paymentStatus) {
    case "paid":
      return "Paid up";
    case "failed":
      return "Payment failed";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    default:
      return "Not synced";
  }
}

function matchesFilter(c: PaymentClient, filter: PaymentFilter): boolean {
  if (filter === "all") return true;
  const isPaidUp = c.packageExpiresAt != null && c.packageExpiresAt !== "" || c.paymentStatus === "paid";
  if (filter === "not_linked") return !c.stripeCustomerId && !c.packageExpiresAt;
  if (filter === "paid") return isPaidUp;
  if (filter === "behind") return !isPaidUp && (c.paymentStatus === "failed" || c.paymentStatus === "past_due" || c.paymentStatus === "canceled");
  return true;
}

export default function CoachPaymentsPage() {
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [filter, setFilter] = useState<PaymentFilter>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const res = await fetchWithAuth("/api/coach/payments");
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.ok) {
          const json = await res.json();
          setData({ clients: json.clients ?? [], stats: json.stats ?? { paidUp: 0, behind: 0, notLinked: 0, total: 0 } });
        } else {
          setData({ clients: [], stats: { paidUp: 0, behind: 0, notLinked: 0, total: 0 } });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  if (authError) return <AuthErrorRetry onRetry={() => window.location.reload()} />;

  const clients = data?.clients ?? [];
  const stats = data?.stats ?? { paidUp: 0, behind: 0, notLinked: 0, total: 0 };
  const filtered = clients.filter((c) => matchesFilter(c, filter));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Payment</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          See who is up to date or behind on payment. Link clients to Stripe in Client Settings → Billing.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && (
        <>
          <div className="flex flex-wrap gap-3">
            <Card className="flex items-center gap-2 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
              <span className="text-sm font-medium text-[var(--color-text)]">Paid up</span>
              <span className="text-sm text-[var(--color-text-muted)]">{stats.paidUp}</span>
            </Card>
            <Card className="flex items-center gap-2 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
              <span className="text-sm font-medium text-[var(--color-text)]">Behind</span>
              <span className="text-sm text-[var(--color-text-muted)]">{stats.behind}</span>
            </Card>
            <Card className="flex items-center gap-2 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[var(--color-border)]" aria-hidden />
              <span className="text-sm font-medium text-[var(--color-text)]">Not linked</span>
              <span className="text-sm text-[var(--color-text-muted)]">{stats.notLinked}</span>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">Show:</span>
            {(["all", "paid", "behind", "not_linked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  filter === f
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {f === "all" ? "All" : f === "paid" ? "Paid up" : f === "behind" ? "Behind" : "Not linked"}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
                {clients.length === 0
                  ? "No clients yet. Clients assigned to you will appear here."
                  : `No clients match “${filter === "all" ? "All" : filter === "paid" ? "Paid up" : filter === "behind" ? "Behind" : "Not linked"}”.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <th className="sticky left-0 z-10 min-w-[100px] bg-[var(--color-bg-elevated)] px-4 py-3 text-left font-medium text-[var(--color-text-muted)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Expiry / Last payment</th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const label = getPaymentLabel(c);
                      const isPaidUp = (c.packageExpiresAt != null && c.packageExpiresAt !== "") || c.paymentStatus === "paid";
                      const isBehind = label === "Payment failed" || label === "Past due" || label === "Canceled";
                      const isNotLinked = !c.stripeCustomerId && !c.packageExpiresAt;
                      const dateDisplay = c.packageExpiresAt
                        ? formatDateDisplay(c.packageExpiresAt)
                        : c.lastPaymentAt
                          ? formatDateDisplay(c.lastPaymentAt)
                          : "—";
                      return (
                        <tr key={c.id} className="group border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elevated)]">
                          <td className="sticky left-0 z-10 min-w-[100px] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-[var(--color-bg-elevated)]">
                            <Link
                              href={`/coach/payments/${c.id}`}
                              className="font-medium text-[var(--color-primary)] hover:underline"
                            >
                              {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.email || "—"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 ${
                                isPaidUp
                                  ? "text-green-600 dark:text-green-400"
                                  : isBehind
                                    ? "text-red-600 dark:text-red-400"
                                    : isNotLinked
                                      ? "text-[var(--color-text-muted)]"
                                      : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isPaidUp ? "bg-green-500" : isBehind ? "bg-red-500" : isNotLinked ? "bg-[var(--color-border)]" : "bg-amber-500"
                                }`}
                                aria-hidden
                              />
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3" title={c.packageExpiresAt ? "Package expires" : undefined}>
                            <span
                              className={
                                c.packageExpiresAt && dateDisplay !== "—"
                                  ? "font-semibold text-green-600 dark:text-green-400"
                                  : "text-[var(--color-text-muted)]"
                              }
                            >
                              {dateDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/coach/clients/${c.id}/settings`}
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              Settings
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
