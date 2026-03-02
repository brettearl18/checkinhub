"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  buildResponses,
  checkInInputClass as inputClass,
  type DraftResponse,
  QuestionBlock,
  type CheckInQuestion as Question,
} from "@/components/client/CheckInFormFields";
import { useApiClient } from "@/lib/api-client";

export default function CheckInFormPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<{
    assignment: { id: string; formTitle: string; status: string; draftResponses?: DraftResponse[] };
    form: { id: string; title: string; questions: string[] };
    questions: Question[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    score: number;
    band: "red" | "orange" | "green";
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/check-in/${assignmentId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = typeof body?.error === "string" ? body.error : null;
          if (res.status === 404) setError(message ?? "Check-in not found.");
          else if (res.status === 403) setError(message ?? "This check-in is not open yet.");
          else setError("Could not load check-in.");
          return;
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Could not load check-in.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId, fetchWithAuth]);

  const hasHydrated = useRef(false);
  const lastAssignmentId = useRef<string | null>(null);
  if (lastAssignmentId.current !== assignmentId) {
    lastAssignmentId.current = assignmentId;
    hasHydrated.current = false;
  }
  // Hydrate from draft once when data loads
  useEffect(() => {
    if (!data?.questions?.length || hasHydrated.current) return;
    hasHydrated.current = true;
    const draft = (data.assignment as { draftResponses?: DraftResponse[] }).draftResponses;
    if (Array.isArray(draft) && draft.length > 0) {
      const byId = Object.fromEntries(draft.map((r) => [r.questionId, r]));
      const nextAnswers: Record<string, string | number | string[]> = {};
      const nextNotes: Record<string, string> = {};
      data.questions.forEach((q) => {
        const r = byId[q.id];
        if (r) {
          nextAnswers[q.id] = r.answer;
          if (r.notes != null) nextNotes[q.id] = r.notes;
        }
      });
      setAnswers(nextAnswers);
      setNotes(nextNotes);
      const firstUnanswered = data.questions.findIndex((q) => {
        const r = byId[q.id];
        return !r || (r.answer === "" && (r.notes ?? "") === "");
      });
      const step = firstUnanswered === -1 ? data.questions.length : firstUnanswered;
      setCurrentStep(step);
    }
  }, [data]);

  const saveDraft = useCallback(async () => {
    if (!data) return false;
    const responses = buildResponses(data.questions, answers, notes);
    setSavingDraft(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/check-in/${assignmentId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Could not save progress.");
        return false;
      }
      return true;
    } catch {
      setError("Could not save progress.");
      return false;
    } finally {
      setSavingDraft(false);
    }
  }, [data, answers, notes, assignmentId, fetchWithAuth]);

  const goNext = async () => {
    if (!data) return;
    const totalSteps = data.questions.length + 1;
    if (currentStep >= data.questions.length) return;
    const ok = await saveDraft();
    if (!ok) return;
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goPrev = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const responses = buildResponses(data.questions, answers, notes);
      const res = await fetchWithAuth("/api/check-in/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, responses }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Submit failed.");
        return;
      }
      const result = await res.json();
      setSubmitResult({
        score: typeof result.score === "number" ? result.score : 0,
        band: result.band === "red" || result.band === "orange" || result.band === "green" ? result.band : "green",
        message: typeof result.message === "string" ? result.message : "Done",
      });
    } catch {
      setError("Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="space-y-6">
        <p className="text-[var(--color-error)]">{error}</p>
        <Button asChild variant="secondary">
          <Link href="/client">Back to dashboard</Link>
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const { assignment, questions } = data;

  if (submitResult) {
    const { score, band, message } = submitResult;
    const bandStyles = {
      red: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200",
      orange: "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200",
      green: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200",
    };
    const bandLabel = band === "green" ? "Excellent" : band === "orange" ? "On track" : "Needs attention";
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-[var(--color-border)] p-0">
          <div className={`p-6 text-center border-b-4 ${band === "red" ? "border-red-500" : band === "orange" ? "border-amber-500" : "border-green-500"}`}>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Check-in submitted</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Here’s your summary</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl font-bold tabular-nums text-[var(--color-text)]">{score}%</span>
              <span className="text-sm font-medium text-[var(--color-text-muted)]">Overall score</span>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-center ${bandStyles[band]}`}>
              <span className="font-semibold">{bandLabel}</span>
              <p className="mt-0.5 text-sm opacity-90">{message}</p>
            </div>
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              Your coach uses this traffic light to see how you’re tracking. Green = excellent, orange = on track, red = needs attention.
            </p>
            <div className="pt-2 flex justify-center">
              <Button asChild variant="primary">
                <Link href="/client">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (assignment.status === "completed") {
    const responseId = (assignment as { responseId?: string }).responseId;
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-[var(--color-text-secondary)]">
            This check-in is already completed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {responseId && (
              <>
                <Button asChild variant="primary">
                  <Link href={`/client/response/${responseId}`}>View response & coach feedback</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/client/check-in/${assignmentId}/edit`}>Edit check-in</Link>
                </Button>
              </>
            )}
            <Button asChild variant="secondary">
              <Link href="/client">Back to dashboard</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalSteps = questions.length + 1;
  const isSubmitStep = currentStep >= questions.length;
  const currentQuestion = !isSubmitStep ? questions[currentStep] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {assignment.formTitle}
        </h1>
        <Button asChild variant="ghost">
          <Link href="/client">Cancel</Link>
        </Button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)]">
          {isSubmitStep ? "Review & submit" : `Question ${currentStep + 1} of ${questions.length}`}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${(100 * (currentStep + 1)) / totalSteps}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          {currentQuestion && (
            <QuestionBlock
              q={currentQuestion}
              answers={answers}
              setAnswers={setAnswers}
              notes={notes}
              setNotes={setNotes}
              inputClass={inputClass}
            />
          )}

          {isSubmitStep && (
            <div className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">
                You’ve answered all questions. Submit when you’re ready.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={goPrev}>
                  Previous
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit check-in"}
                </Button>
              </div>
            </div>
          )}

          {!isSubmitStep && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {currentStep > 0 && (
                <Button type="button" variant="secondary" onClick={goPrev} disabled={savingDraft}>
                  Previous
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                onClick={goNext}
                disabled={savingDraft}
              >
                {savingDraft ? "Saving…" : "Next"}
              </Button>
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}
