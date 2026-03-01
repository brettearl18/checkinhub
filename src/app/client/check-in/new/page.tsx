"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";

const WEEK_RANGE = { past: 2, future: 0 };

// Week is always Monday (inclusive) to Sunday (inclusive). reflectionWeekStart = Monday YYYY-MM-DD.
function getWeekOptions(): { label: string; reflectionWeekStart: string }[] {
  const options: { label: string; reflectionWeekStart: string }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = -WEEK_RANGE.past; i <= WEEK_RANGE.future; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i * 7);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    const monday = d.toISOString().slice(0, 10);
    const sunday = new Date(d);
    sunday.setDate(sunday.getDate() + 6);
    const label =
      i === 0
        ? `This week (${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("en-AU", { day: "numeric", month: "short" })})`
        : `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
    options.push({ label, reflectionWeekStart: monday });
  }
  return options;
}

interface FormItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
}

export default function NewCheckInPage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [step, setStep] = useState<"form" | "week">("form");
  const [forms, setForms] = useState<FormItem[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null);
  const [completedWeeks, setCompletedWeeks] = useState<string[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekOptions = getWeekOptions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingForms(true);
      try {
        const res = await fetchWithAuth("/api/forms");
        if (!res.ok) {
          if (!cancelled) setError("Could not load forms.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setForms(Array.isArray(data) ? data : []);
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
          const list = await res.json();
          if (!cancelled) setCompletedWeeks(Array.isArray(list) ? list : []);
        }
      } finally {
        if (!cancelled) setLoadingWeeks(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, selectedForm, fetchWithAuth]);

  const handleSelectWeek = async (reflectionWeekStart: string) => {
    if (!selectedForm) return;
    if (completedWeeks.includes(reflectionWeekStart)) return;
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
              No forms available.
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
              Choose week
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Last 2 weeks and this week. Completed weeks are marked.
            </p>
            {loadingWeeks && (
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                Loading…
              </p>
            )}
            {!loadingWeeks && (
              <ul className="mt-4 space-y-2">
                {weekOptions.map((w) => {
                  const done = completedWeeks.includes(w.reflectionWeekStart);
                  return (
                    <li key={w.reflectionWeekStart}>
                      <button
                        type="button"
                        onClick={() => handleSelectWeek(w.reflectionWeekStart)}
                        disabled={done || resolving}
                        className={`w-full rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm ${done ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]" : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)]"}`}
                      >
                        {w.label}
                        {done && " ✓ Done"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {resolving && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Starting check-in…
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
