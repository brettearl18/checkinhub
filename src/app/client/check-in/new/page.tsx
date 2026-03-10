"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WeekCalendar, type WeekOption } from "@/components/client/WeekCalendar";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";

const WEEK_RANGE = { past: 2, future: 1 }; // include next week as pending (opens Friday 9am)

// Week is always Monday (inclusive) to Sunday (inclusive). reflectionWeekStart = Monday YYYY-MM-DD.
function getWeekOptions(): WeekOption[] {
  const options: WeekOption[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = -WEEK_RANGE.past; i <= WEEK_RANGE.future; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 7);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    const monday = toLocalDateString(d);
    const sunday = new Date(d);
    sunday.setDate(sunday.getDate() + 6);
    const sundayStr = toLocalDateString(sunday);
    const label =
      i === 0
        ? `This week (${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)})`
        : i === 1
          ? `Next week (${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)})`
          : `${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)}`;
    options.push({
      label,
      reflectionWeekStart: monday,
      isThisWeek: i === 0,
      isNextWeek: i === 1,
    });
  }
  return options;
}

interface FormItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
}

interface AssignmentItem {
  id: string;
  formId: string;
  formTitle: string;
  reflectionWeekStart: string;
  status: string;
}

export default function NewCheckInPage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [step, setStep] = useState<"form" | "week">("form");
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null);
  const [completedWeeks, setCompletedWeeks] = useState<string[]>([]);
  const [inProgressWeeks, setInProgressWeeks] = useState<string[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [markingMissed, setMarkingMissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptMissed, setPromptMissed] = useState<{ week: string; assignmentId: string; previousCount: number } | null>(null);

  const weekOptions = getWeekOptions();
  const thisMonday = thisMondayPerth();
  const nextMonday = (() => {
    const d = new Date(thisMonday + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const weeksWithAssignments = useMemo(() => {
    const openStarts = new Set<string>();
    assignments.forEach((a) => {
      if (a.reflectionWeekStart < thisMonday || isWeekOpenPerth(a.reflectionWeekStart)) {
        openStarts.add(a.reflectionWeekStart);
      }
    });
    if (openStarts.size === 0) {
      const weekSet = new Set(assignments.map((a) => a.reflectionWeekStart));
      return weekOptions.filter((w) => weekSet.has(w.reflectionWeekStart));
    }
    const sorted = Array.from(openStarts).sort().reverse();
    return sorted.map((monday) => {
      const [y, m, d] = monday.split("-").map(Number);
      const mon = new Date(y, m - 1, d);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const sundayStr = toLocalDateString(sun);
      const isThisWeek = monday === thisMonday;
      const isNextWeek = monday === nextMonday;
      const label = isThisWeek
        ? `This week (${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)})`
        : isNextWeek
          ? `Next week (${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)})`
          : `${formatDateDisplay(monday)} – ${formatDateDisplay(sundayStr)}`;
      return {
        label,
        reflectionWeekStart: monday,
        isThisWeek,
        isNextWeek,
      };
    });
  }, [assignments, weekOptions, thisMonday, nextMonday]);

  const openWeeks = weekOptions.filter(
    (w) => w.reflectionWeekStart < thisMondayPerth() || isWeekOpenPerth(w.reflectionWeekStart)
  );
  const allOpenWeeksDone =
    openWeeks.length > 0 && openWeeks.every((w) => completedWeeks.includes(w.reflectionWeekStart));

  // Load assignments; derive forms; if single form, go straight to week step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingForms(true);
      try {
        const res = await fetchWithAuth("/api/check-in/assignments");
        if (!res.ok) {
          if (!cancelled) setError("Could not load check-ins.");
          return;
        }
        const data = await res.json();
        const list: AssignmentItem[] = Array.isArray(data) ? data : [];
        if (!cancelled) setAssignments(list);
        const byFormId = new Map<string, FormItem>();
        list.forEach((a: AssignmentItem) => {
          if (a.formId && !byFormId.has(a.formId)) {
            byFormId.set(a.formId, {
              id: a.formId,
              title: a.formTitle ?? "Check-in",
              description: undefined,
              category: undefined,
            });
          }
        });
        const formList = Array.from(byFormId.values());
        if (!cancelled) {
          setForms(formList);
          if (formList.length === 1) {
            setSelectedForm(formList[0]!);
            setStep("week");
          }
        }
      } finally {
        if (!cancelled) setLoadingForms(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchWithAuth]);

  useEffect(() => {
    if (step !== "week" || !selectedForm) return;
    let cancelled = false;
    setLoadingWeeks(true);
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/api/check-in/completed-weeks?formId=${encodeURIComponent(selectedForm.id)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setCompletedWeeks(Array.isArray(data?.completed) ? data.completed : []);
            setInProgressWeeks(Array.isArray(data?.inProgress) ? data.inProgress : []);
          }
        }
      } finally {
        if (!cancelled) setLoadingWeeks(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, selectedForm, fetchWithAuth]);

  const getAssignmentIdForWeek = (reflectionWeekStart: string): string | null => {
    const a = assignments.find(
      (x) =>
        x.reflectionWeekStart === reflectionWeekStart &&
        (!selectedForm || x.formId === selectedForm.id)
    );
    return a?.id ?? null;
  };

  const previousPendingCount = (selectedWeek: string) =>
    assignments.filter((a) => a.reflectionWeekStart < selectedWeek).length;

  const handleSelectWeek = async (reflectionWeekStart: string) => {
    if (completedWeeks.includes(reflectionWeekStart)) return;
    const assignmentId = getAssignmentIdForWeek(reflectionWeekStart);
    if (assignmentId) {
      const previousCount = previousPendingCount(reflectionWeekStart);
      if (previousCount > 0) {
        setPromptMissed({ week: reflectionWeekStart, assignmentId, previousCount });
        return;
      }
      router.push(`/client/check-in/${assignmentId}`);
      return;
    }
    if (!selectedForm) return;
    setResolving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/check-in/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: selectedForm.id,
          reflectionWeekStart,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Could not start check-in.");
        return;
      }
      const data = await res.json();
      if (data.assignmentId) {
        router.push(`/client/check-in/${data.assignmentId}`);
      } else {
        setError("No assignment ID returned.");
      }
    } catch {
      setError("Could not start check-in.");
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmMarkMissed = async () => {
    if (!promptMissed) return;
    const { week, assignmentId } = promptMissed;
    setMarkingMissed(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/check-in/mark-weeks-missed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeReflectionWeekStart: week }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : "Could not mark weeks as missed.");
        return;
      }
      setPromptMissed(null);
      router.push(`/client/check-in/${assignmentId}`);
    } catch {
      setError("Could not mark weeks as missed.");
    } finally {
      setMarkingMissed(false);
    }
  };

  const handleSkipMarkMissed = () => {
    if (!promptMissed) return;
    router.push(`/client/check-in/${promptMissed.assignmentId}`);
    setPromptMissed(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          New check-in
        </h1>
        <Button asChild variant="ghost">
          <Link href="/client">Cancel</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}

      {step === "form" && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">
            Choose check-in type
          </h2>
          {loadingForms && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Loading…
            </p>
          )}
          {!loadingForms && forms.length === 0 && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              No check-ins assigned yet. Your coach will assign check-ins for you—check back later or ask them to add one in Client settings.
            </p>
          )}
          {!loadingForms && forms.length > 0 && (
            <ul className="mt-4 space-y-2">
              {forms.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedForm(f);
                      setStep("week");
                    }}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-left text-sm hover:bg-[var(--color-primary-subtle)]"
                  >
                    <span className="font-medium">{f.title}</span>
                    {f.description && (
                      <span className="mt-1 block text-[var(--color-text-muted)]">
                        {f.description}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === "week" && selectedForm && (
        <>
          <Card className="p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Selected: <span className="font-medium text-[var(--color-text)]">{selectedForm.title}</span>
            </p>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => setStep("form")}
            >
              Change type
            </Button>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              Which week are you filling in?
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Select the week you&apos;re checking in for. Past weeks are always available; this week and next week open Friday 9am Perth so you review the week that&apos;s just passed.
            </p>
            {loadingWeeks && (
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                Loading…
              </p>
            )}
            {!loadingWeeks && allOpenWeeksDone && (
              <p className="mt-4 rounded-lg bg-green-100 dark:bg-green-900/30 px-4 py-3 text-sm font-medium text-green-800 dark:text-green-200" role="status">
                You are up to date — well done!
              </p>
            )}
            {!loadingWeeks && (
              <div className="mt-4">
                <WeekCalendar
                  weeks={weeksWithAssignments.length > 0 ? weeksWithAssignments : weekOptions}
                  completedWeekStarts={completedWeeks}
                  inProgressWeekStarts={inProgressWeeks}
                  onSelectWeek={handleSelectWeek}
                  resolving={resolving || markingMissed}
                />
              </div>
            )}
            {resolving && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Starting check-in…
              </p>
            )}
          </Card>
        </>
      )}

      {promptMissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="mark-missed-title">
          <Card className="w-full max-w-md p-6">
            <h2 id="mark-missed-title" className="text-lg font-semibold text-[var(--color-text)]">
              Previous weeks not completed
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              You have {promptMissed.previousCount} previous week{promptMissed.previousCount !== 1 ? "s" : ""} that aren&apos;t completed. Do you want to mark {promptMissed.previousCount === 1 ? "it" : "them"} as missed? They&apos;ll be removed from your to-do list.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmMarkMissed}
                disabled={markingMissed}
              >
                {markingMissed ? "Marking…" : `Mark ${promptMissed.previousCount} as missed`}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSkipMarkMissed}
                disabled={markingMissed}
              >
                No, just this week
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
