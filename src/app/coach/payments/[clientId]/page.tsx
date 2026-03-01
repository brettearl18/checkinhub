"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  created: string | null;
  dueDate: string | null;
  paid: boolean;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
}

interface HistoryData {
  clientId: string;
  customerId: string | null;
  invoices: Invoice[];
  message?: string;
}

function formatAmount(cents: number, currency: string): string {
  const code = (currency || "aud").toUpperCase();
  const symbol = code === "AUD" ? "A$" : code === "USD" ? "$" : code + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export default function CoachPaymentHistoryPage() {
  const params = useParams();
  const clientId = params?.clientId as string | undefined;
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<HistoryData | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetchWithAuth(`/api/coach/clients/${clientId}/profile`),
          fetchWithAuth(`/api/coach/clients/${clientId}/billing/history`),
        ]);
        if (profileRes.status === 401 || historyRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setClientName([profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Client");
        }
        if (historyRes.ok) {
          const json = await historyRes.json();
          setData({
            clientId: json.clientId ?? clientId,
            customerId: json.customerId ?? null,
            invoices: Array.isArray(json.invoices) ? json.invoices : [],
            message: json.message,
          });
        } else {
          setData({ clientId: clientId!, customerId: null, invoices: [], message: "Could not load history" });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  if (!clientId) {
    return (
      <div className="space-y-6">
        <Link href="/coach/payments" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Payment
        </Link>
        <p className="text-[var(--color-text-muted)]">Invalid client.</p>
      </div>
    );
  }

  if (authError) return <AuthErrorRetry onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/payments" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Payment
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          Payment history {clientName ? `: ${clientName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Invoices for this client from Stripe. Link the client in Settings → Billing if needed.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && data && (
        <>
          {!data.customerId ? (
            <Card className="p-6">
              <p className="text-[var(--color-text-muted)]">
                This client is not linked to a Stripe customer. Link them in Settings to see payment history.
              </p>
              <Link
                href={`/coach/clients/${clientId}/settings`}
                className="mt-3 inline-block text-[var(--color-primary)] hover:underline"
              >
                Open Settings →
              </Link>
            </Card>
          ) : data.invoices.length === 0 ? (
            <Card className="p-6">
              <p className="text-[var(--color-text-muted)]">No invoices yet for this customer.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Invoice</th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                          {inv.created ? new Date(inv.created).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text)] font-mono">
                          {inv.number || inv.id}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              inv.paid
                                ? "text-green-600 dark:text-green-400"
                                : inv.status === "open" || inv.status === "draft"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                            }
                          >
                            {inv.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text)]">
                          {formatAmount(inv.amountPaid || inv.amountDue, inv.currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.hostedInvoiceUrl && (
                            <a
                              href={inv.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              View
                            </a>
                          )}
                          {inv.invoicePdf && (
                            <>
                              {" · "}
                              <a
                                href={inv.invoicePdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-primary)] hover:underline"
                              >
                                PDF
                              </a>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <p className="text-sm text-[var(--color-text-muted)]">
            <Link href={`/coach/clients/${clientId}/settings`} className="text-[var(--color-primary)] hover:underline">
              Client settings
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
