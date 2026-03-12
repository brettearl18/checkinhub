"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";

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

interface ProgramOption {
  id: string;
  name: string;
}

interface ClientProgramAssignment {
  programId: string;
  programName: string;
  startDate: string;
  currentWeek: number;
  status: string;
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
    d.setDate(today.getDate() - 7 * i);
    const monday = getMonday(d);
    const [y, mo, day] = monday.split("-").map(Number);
    const end = new Date(y, mo - 1, day);
    end.setDate(end.getDate() + 6);
    const label = `${formatDateDisplay(monday)} – ${formatDateDisplay(toLocalDateString(end))}`;
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
  const [programAssignment, setProgramAssignment] = useState<ClientProgramAssignment | null>(null);
  const [programAssignOpen, setProgramAssignOpen] = useState(false);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignProgramStartDate, setAssignProgramStartDate] = useState("");
  const [assigningProgram, setAssigningProgram] = useState(false);
  const [assignProgramError, setAssignProgramError] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    idsQueried: string[];
    assignmentCountByClientId: Record<string, number>;
    totalAssignments: number;
    suggestion: string | null;
  } | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [completedList, setCompletedList] = useState<Array<{ id: string; clientId: string; formTitle: string; completedAt: string | null; reflectionWeekStart: string | null }> | null>(null);
  const [completedListLoading, setCompletedListLoading] = useState(false);
  const [profileSummary, setProfileSummary] = useState<{
    paymentStatus: string | null;
    mealPlanLinksCount: number;
  } | null>(null);

  const weekOptions = useMemo(() => getWeekOptions(2), []);

  function getNextMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const [clientsRes, checkInsRes, programRes, profileRes] = await Promise.all([
        fetchWithAuth("/api/coach/clients"),
        fetchWithAuth(`/api/coach/clients/${clientId}/check-ins`),
        fetchWithAuth(`/api/coach/clients/${clientId}/program`),
        fetchWithAuth(`/api/coach/clients/${clientId}/profile`),
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
      if (programRes.ok) {
        const prog = await programRes.json();
        if (prog && prog.programId) {
          setProgramAssignment({
            programId: prog.programId,
            programName: prog.programName ?? "",
            startDate: prog.startDate ?? "",
            currentWeek: prog.currentWeek ?? 1,
            status: prog.status ?? "active",
          });
        } else {
          setProgramAssignment(null);
        }
      } else {
        setProgramAssignment(null);
      }
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setProfileSummary({
          paymentStatus: profile.paymentStatus ?? null,
          mealPlanLinksCount: Array.isArray(profile.mealPlanLinks) ? profile.mealPlanLinks.length : 0,
        });
      } else {
        setProfileSummary(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth, clientId]);

  useEffect(() => {
    if (!programAssignOpen) return;
    setAssignProgramError(null);
    setAssignProgramStartDate(getNextMonday());
    setAssignProgramId(programAssignment?.programId ?? "");
    (async () => {
      try {
        const res = await fetchWithAuth("/api/coach/programs");
        if (res.ok) {
          const list = await res.json();
          setPrograms(Array.isArray(list) ? list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) : []);
        }
      } catch {
        setPrograms([]);
      }
    })();
  }, [programAssignOpen, programAssignment?.programId, fetchWithAuth]);

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

  const handleAssignProgram = async () => {
    if (!assignProgramId || !assignProgramStartDate) return;
    setAssigningProgram(true);
    setAssignProgramError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/program`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: assignProgramId, startDate: assignProgramStartDate }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAssignProgramError(data.error ?? "Failed to assign program.");
        return;
      }
      setProgramAssignOpen(false);
      await load();
    } catch {
      setAssignProgramError("Failed to assign program.");
    } finally {
      setAssigningProgram(false);
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}/progress`}>Progress</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}/habits`}>Habits</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}/settings`}>Settings</Link>
          </Button>
          <Button variant="secondary" onClick={() => setProgramAssignOpen(true)}>
            {programAssignment ? "Change program" : "Assign program"}
          </Button>
          <Button onClick={() => setAssignOpen(true)}>Assign check-in</Button>
        </div>
      </div>

      {/* Overview: check-ins, traffic lights, Stripe, meal plans – all loadable when client is set up */}
      {!authError && !loading && (
        <Card className="p-4 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Overview
          </h2>
          <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text)]">Check-ins:</strong> {list.length} total
              {list.filter((r) => r.status === "completed").length > 0 && (
                <span className="text-[var(--color-text-muted)]">
                  {" "}({list.filter((r) => r.status === "completed").length} completed)
                </span>
              )}
            </span>
            <Link href={`/coach/clients/${clientId}/progress`} className="text-[var(--color-primary)] hover:underline">
              <strong>Traffic lights %</strong> → Progress
            </Link>
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text)]">Stripe:</strong>{" "}
              {profileSummary?.paymentStatus ? (
                <span className={profileSummary.paymentStatus === "paid" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                  {profileSummary.paymentStatus === "paid" ? "Paid" : profileSummary.paymentStatus}
                </span>
              ) : (
                <span className="text-[var(--color-text-muted)]">Not linked</span>
              )}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text)]">Meal plans:</strong>{" "}
              {profileSummary && profileSummary.mealPlanLinksCount > 0 ? (
                <span className="text-[var(--color-text)]">{profileSummary.mealPlanLinksCount} link{profileSummary.mealPlanLinksCount !== 1 ? "s" : ""}</span>
              ) : (
                <span className="text-[var(--color-text-muted)]">None</span>
              )}
              {" · "}
              <Link href={`/coach/clients/${clientId}/settings`} className="text-[var(--color-primary)] hover:underline">
                Settings
              </Link>
            </span>
          </div>
        </Card>
      )}

      {programAssignment && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Program</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {programAssignment.programName} · Started {formatDateDisplay(programAssignment.startDate)} · Week {programAssignment.currentWeek}
            {programAssignment.status !== "active" ? ` · ${programAssignment.status}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="text-sm min-h-0 py-1.5">
              <Link href={`/coach/clients/${clientId}/program`}>View program</Link>
            </Button>
            <Button variant="ghost" className="text-sm min-h-0 py-1.5" onClick={() => setProgramAssignOpen(true)}>
              Change program
            </Button>
          </div>
        </Card>
      )}

      {programAssignOpen && (
        <Card className="p-4 max-w-md space-y-4">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Assign program</h2>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Program</label>
            <select
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              value={assignProgramId}
              onChange={(e) => setAssignProgramId(e.target.value)}
            >
              <option value="">Select program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Start date (Week 1 Monday)</label>
            <input
              type="date"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              value={assignProgramStartDate}
              onChange={(e) => setAssignProgramStartDate(e.target.value)}
            />
          </div>
          {assignProgramError && <p className="text-sm text-[var(--color-error)]" role="alert">{assignProgramError}</p>}
          <div className="flex gap-2">
            <Button onClick={handleAssignProgram} disabled={!assignProgramId || !assignProgramStartDate || assigningProgram}>
              {assigningProgram ? "Assigning…" : "Assign"}
            </Button>
            <Button variant="secondary" onClick={() => setProgramAssignOpen(false)} disabled={assigningProgram}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

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
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {pendingCount} pending check-in{pendingCount !== 1 ? "s" : ""}.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                setDiagnosticLoading(true);
                setDiagnosticResult(null);
                try {
                  const res = await fetchWithAuth(`/api/coach/clients/${clientId}/check-ins/diagnostic`);
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    setDiagnosticResult({
                      idsQueried: data.idsQueried ?? [],
                      assignmentCountByClientId: data.assignmentCountByClientId ?? {},
                      totalAssignments: data.totalAssignments ?? 0,
                      suggestion: data.suggestion ?? null,
                    });
                  } else {
                    setDiagnosticResult({ idsQueried: [], assignmentCountByClientId: {}, totalAssignments: 0, suggestion: data.error ?? "Diagnostic failed." });
                  }
                } catch {
                  setDiagnosticResult({ idsQueried: [], assignmentCountByClientId: {}, totalAssignments: 0, suggestion: "Request failed." });
                } finally {
                  setDiagnosticLoading(false);
                }
              }}
              disabled={diagnosticLoading}
            >
              {diagnosticLoading ? "Checking…" : "Troubleshoot check-ins"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleDeletePending}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete pending"}
            </Button>
          </div>
        </Card>
      )}

      {pendingCount === 0 && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Completed check-ins not showing?
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={diagnosticLoading}
            onClick={async () => {
              setDiagnosticLoading(true);
              setDiagnosticResult(null);
              try {
                const res = await fetchWithAuth(`/api/coach/clients/${clientId}/check-ins/diagnostic`);
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  setDiagnosticResult({
                    idsQueried: data.idsQueried ?? [],
                    assignmentCountByClientId: data.assignmentCountByClientId ?? {},
                    totalAssignments: data.totalAssignments ?? 0,
                    suggestion: data.suggestion ?? null,
                  });
                } else {
                  setDiagnosticResult({ idsQueried: [], assignmentCountByClientId: {}, totalAssignments: 0, suggestion: data.error ?? "Diagnostic failed." });
                }
              } catch {
                setDiagnosticResult({ idsQueried: [], assignmentCountByClientId: {}, totalAssignments: 0, suggestion: "Request failed." });
              } finally {
                setDiagnosticLoading(false);
              }
            }}
          >
            {diagnosticLoading ? "Checking…" : "Troubleshoot check-ins"}
          </Button>
        </Card>
      )}

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
      )}

      {diagnosticResult && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Check-ins diagnostic</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            IDs queried: {diagnosticResult.idsQueried.join(", ") || "—"}. Counts:{" "}
            {Object.entries(diagnosticResult.assignmentCountByClientId)
              .map(([id, count]) => `${id.slice(0, 8)}…=${count}`)
              .join(", ") || "0"}
            . Total: {diagnosticResult.totalAssignments}.
          </p>
          {diagnosticResult.suggestion && (
            <p className="text-sm text-[var(--color-text-secondary)]">{diagnosticResult.suggestion}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={completedListLoading}
              onClick={async () => {
                setCompletedListLoading(true);
                setCompletedList(null);
                try {
                  const res = await fetchWithAuth(`/api/coach/clients/${clientId}/check-ins/completed-list`);
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && Array.isArray(data.completed)) {
                    setCompletedList(data.completed);
                  } else {
                    setCompletedList([]);
                  }
                } catch {
                  setCompletedList([]);
                } finally {
                  setCompletedListLoading(false);
                }
              }}
            >
              {completedListLoading ? "Loading…" : "List completed in DB"}
            </Button>
            {diagnosticResult.suggestion?.includes("repair") && (
              <Button
                type="button"
                variant="primary"
                disabled={repairLoading}
                onClick={async () => {
                  setRepairLoading(true);
                  try {
                    const res = await fetchWithAuth(`/api/coach/clients/${clientId}/check-ins/repair`, { method: "POST" });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setDiagnosticResult(null);
                      setCompletedList(null);
                      await load();
                    } else {
                      setDiagnosticResult((prev) => prev ? { ...prev, suggestion: (prev.suggestion ?? "") + " Repair failed: " + (data.error ?? "Unknown") } : null);
                    }
                  } finally {
                    setRepairLoading(false);
                  }
                }}
              >
                {repairLoading ? "Fixing…" : "Fix link (set authUid)"}
              </Button>
            )}
            <Button type="button" variant="ghost" className="text-sm" onClick={() => { setDiagnosticResult(null); setCompletedList(null); }}>
              Dismiss
            </Button>
          </div>
          {completedList && (
            <div className="border border-[var(--color-border)] rounded p-3 bg-[var(--color-bg-elevated)]">
              <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">
                Completed check-ins in Firebase ({completedList.length})
              </h4>
              <ul className="text-sm text-[var(--color-text-secondary)] space-y-1 max-h-60 overflow-y-auto">
                {completedList.map((row) => (
                  <li key={row.id}>
                    {row.formTitle} — week {row.reflectionWeekStart ?? "—"} — completed {row.completedAt ? formatDateDisplay(row.completedAt) : "—"} (clientId: {row.clientId.slice(0, 8)}…)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
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
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  <th className="sticky left-0 z-10 min-w-[120px] bg-[var(--color-bg)] px-4 py-3 font-medium text-[var(--color-text)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">Form</th>
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
                    ? formatDateDisplay(row.completedAt)
                    : row.dueDate
                      ? formatDateDisplay(row.dueDate)
                      : "—";
                  const dateLabel = isCompleted ? "Completed" : "Due";
                  return (
                    <tr key={row.id} className="group border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                      <td className="sticky left-0 z-10 min-w-[120px] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-[var(--color-bg-elevated)]">{row.formTitle}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {row.reflectionWeekStart ? formatDateDisplay(row.reflectionWeekStart) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text)]">
                        {row.status === "skipped" ? "Missed" : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </td>
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
