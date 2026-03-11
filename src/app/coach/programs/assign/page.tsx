"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function AssignForm() {
  const searchParams = useSearchParams();
  const programId = searchParams.get("programId") ?? "";
  const { fetchWithAuth } = useApiClient();
  const [programName, setProgramName] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState(getNextMonday());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithAuth(`/api/coach/programs/${programId}`),
      fetchWithAuth("/api/coach/clients"),
    ])
      .then(([progRes, clientsRes]) => {
        if (cancelled) return;
        if (progRes.status === 401 || clientsRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (progRes.ok) {
          progRes.json().then((p: { name?: string }) => {
            if (!cancelled && p) setProgramName(p.name ?? "");
          });
        }
        if (clientsRes.ok) {
          clientsRes.json().then((list: ClientOption[]) => {
            if (!cancelled && Array.isArray(list)) setClients(list.filter((c) => c.status !== "archived"));
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [programId, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId || !clientId || !startDate) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/program`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, startDate }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to assign program.");
        return;
      }
      setDone(true);
    } catch {
      setError("Failed to assign program.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (!programId) {
    return (
      <div className="space-y-6">
        <Link href="/coach/programs" className="text-sm text-[var(--color-primary)] hover:underline">← Programs</Link>
        <p className="text-[var(--color-error)]">No program selected. Choose a program and click Assign.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/coach/programs" className="text-sm text-[var(--color-primary)] hover:underline">← Programs</Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Link href="/coach/programs" className="text-sm text-[var(--color-primary)] hover:underline">← Programs</Link>
        <Card className="p-6">
          <p className="font-medium text-[var(--color-text)]">Program assigned.</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            The client can now see their program under Program in the app.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="primary">
              <Link href={`/coach/clients/${clientId}`}>View client</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/coach/programs">Back to programs</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/programs" className="text-sm text-[var(--color-primary)] hover:underline">← Programs</Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Assign program</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {programName ? `Assign “${programName}” to a client.` : "Select client and start date."}
        </p>
      </div>

      <Card className="p-6 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Start date (Week 1 Monday)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              required
            />
          </div>
          {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!clientId || !startDate || submitting}>
              {submitting ? "Assigning…" : "Assign"}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/coach/programs">Cancel</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function CoachProgramsAssignPage() {
  return (
    <Suspense fallback={<p className="text-[var(--color-text-muted)]">Loading…</p>}>
      <AssignForm />
    </Suspense>
  );
}
