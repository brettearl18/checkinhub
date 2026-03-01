"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
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
      const res = await fetchWithAuth("/api/coach/clients");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
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
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Clients</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Your client list. Open a client to view check-ins, add feedback, or assign a check-in.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Clients assigned to you will appear here."
        />
      )}

      {!loading && clients.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-1">
            {clients.map((c) => (
              <Card
                key={c.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text)] truncate">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">{c.email}</p>
                  {c.status && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{c.status}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/coach/clients/${c.id}/progress`}>Progress</Link>
                  </Button>
                  <Button asChild variant="primary">
                    <Link href={`/coach/clients/${c.id}`}>View check-ins</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
