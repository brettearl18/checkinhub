"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface CheckInRow {
  id: string;
  formTitle: string;
  formId: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  reflectionWeekStart: string | null;
  responseId: string | null;
}

interface FormOption {
  id: string;
  title?: string;
}

// Monday YYYY-MM-DD for a given date
function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  return m.toISOString().slice(0, 10);
}

// Last N weeks + this week (Mondays)
function getWeekOptions(count: number): { value: string; label: string }[] {
  const today = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = count; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - 7 * i);
    const monday = getMonday(d);
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    const label = `${monday} – ${end.toISOString().slice(0, 10)}`;
    options.push({ value: monday, label });
  }
  return options;
}

export default function CoachClientCheckInsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<CheckInRow[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [assignFormId, setAssignFormId] = useState("");
  const [assignWeek, setAssignWeek] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const weekOptions = useMemo(() => getWeekOptions(2), []);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const [clientsRes, checkInsRes] = await Promise.all([
        fetchWithAuth("/api/coach/clients"),
        fetchWithAuth(`/api/coach/clients/${clientId}/check-ins`),
      ]);
      if (clientsRes.status === 401 || checkInsRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (checkInsRes.status === 404) {
        setError("Client not found.");
        setList([]);
        return;
      }
      if (clientsRes.ok) {
        const clients = await clientsRes.json();
        const client = Array.isArray(clients) ? clients.find((c: { id: string }) => c.id === clientId) : null;
        if (client) setClientName(`${client.firstName} ${client.lastName}`);
      }
      if (checkInsRes.ok) {
        const data = await checkInsRes.json();
        setList(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth, clientId]);

  useEffect(() => {
    if (!assignOpen) return;
    setAssignError(null);
    setAssignWeek(weekOptions[weekOptions.length - 1]?.value ?? "");
    setAssignFormId("");
    (async () => {
      try {
        const res = await fetchWithAuth("/api/coach/forms");
        if (res.ok) {
          const list = await res.json();
          setForms(Array.isArray(list) ? list : []);
          if (list?.length && !assignFormId) setAssignFormId(list[0].id);
        }
      } catch {
        setForms([]);
      }
    })();
  }, [assignOpen]);

  const handleAssign = async () => {
    if (!assignFormId || !assignWeek) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: assignFormId, reflectionWeekStart: assignWeek }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        setAssignError(t || "Failed to assign.");
        return;
      }
      setAssignOpen(false);
      await load();
    } catch {
      setAssignError("Failed to assign.");
    } finally {
      setAssigning(false);
    }
  };

  const handleDeletePending = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/coach/check-ins/delete-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Delete failed.");
        return;
      }
      await load();
    } catch {
      setError("Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = list.filter((r) => ["pending", "overdue", "started"].includes(r.status)).length;

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Back to clients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
            {clientName ?? "Client"} – Check-ins
          </h1>
        </div>
        <Button onClick={() => setAssignOpen(true)}>Assign check-in</Button>
      </div>

      {assignOpen && (
        <Card className="p-4 max-w-md space-y-4">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Assign check-in</h2>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Form</label>
            <select
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              value={assignFormId}
              onChange={(e) => setAssignFormId(e.target.value)}
            >
              <option value="">Select form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>{f.title ?? f.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Reflection week (Monday)</label>
            <select
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              value={assignWeek}
              onChange={(e) => setAssignWeek(e.target.value)}
            >
              {weekOptions.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
          {assignError && <p className="text-sm text-[var(--color-error)]" role="alert">{assignError}</p>}
          <div className="flex gap-2">
            <Button onClick={handleAssign} disabled={!assignFormId || !assignWeek || assigning}>
              {assigning ? "Assigning…" : "Assign"}
            </Button>
            <Button variant="secondary" onClick={() => setAssignOpen(false)} disabled={assigning}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {pendingCount > 0 && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {pendingCount} pending check-in{pendingCount !== 1 ? "s" : ""}.
          </span>
          <Button
            variant="secondary"
            onClick={handleDeletePending}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete pending"}
          </Button>
        </Card>
      )}

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <EmptyState
          title="No check-ins"
          description="This client has no check-in assignments yet."
          actionLabel="Back to clients"
          actionHref="/coach"
        />
      )}
      {!loading && list.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  <th className="px-4 py-3 font-medium text-[var(--color-text)]">Form</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text)]">Week</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text)]">Status</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text)]">Date</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text)]" aria-label="View response" />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const isCompleted = row.status === "completed";
                  const displayDate = isCompleted && row.completedAt
                    ? new Date(row.completedAt).toLocaleDateString()
                    : row.dueDate
                      ? new Date(row.dueDate).toLocaleDateString()
                      : "—";
                  const dateLabel = isCompleted ? "Completed" : "Due";
                  return (
                    <tr key={row.id} className="border-b border-[var(--color-border)]">
                      <td className="px-4 py-3 text-[var(--color-text)]">{row.formTitle}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {row.reflectionWeekStart ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text)]">{row.status}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        <span className="text-xs">{dateLabel}: </span>
                        {displayDate}
                      </td>
                      <td className="px-4 py-3">
                        {row.responseId ? (
                          <Link
                            href={`/coach/clients/${clientId}/responses/${row.responseId}`}
                            className="text-sm text-[var(--color-primary)] hover:underline"
                          >
                            View response
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
