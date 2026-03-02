"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  buildResponses,
  checkInInputClass,
  QuestionBlock,
  type CheckInQuestion,
} from "@/components/client/CheckInFormFields";
import { useApiClient } from "@/lib/api-client";

export default function EditCheckInPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const { fetchWithAuth } = useApiClient();
  const [assignment, setAssignment] = useState<{
    id: string;
    formTitle: string;
    status: string;
    responseId?: string;
  } | null>(null);
  const [questions, setQuestions] = useState<CheckInQuestion[]>([]);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
          if (!cancelled) setError(res.status === 404 ? "Check-in not found." : "Could not load check-in.");
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        const ass = json.assignment;
        if (ass?.status !== "completed" || !ass?.responseId) {
          setError("This check-in cannot be edited.");
          setLoading(false);
          return;
        }
        setAssignment(ass);
        setQuestions(Array.isArray(json.questions) ? json.questions : []);
        setResponseId(ass.responseId);

        const resRes = await fetchWithAuth(`/api/client/responses/${ass.responseId}`);
        if (!resRes.ok || cancelled) {
          if (!cancelled) setError("Could not load your response.");
          setLoading(false);
          return;
        }
        const resData = await resRes.json();
        const resp = resData.response;
        if (resp?.responses && Array.isArray(resp.responses)) {
          const byId: Record<string, string | number | string[]> = {};
          const notesById: Record<string, string> = {};
          for (const r of resp.responses) {
            byId[r.questionId] = r.answer ?? "";
            if (r.notes != null) notesById[r.questionId] = r.notes;
          }
          setAnswers(byId);
          setNotes(notesById);
        }
      } catch {
        if (!cancelled) setError("Could not load check-in.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseId || !assignment || !questions.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const responses = buildResponses(questions, answers, notes);
      const res = await fetchWithAuth(`/api/client/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Update failed.");
        return;
      }
      const result = await res.json();
      setSubmitResult({
        score: typeof result.score === "number" ? result.score : 0,
        band: result.band === "red" || result.band === "orange" || result.band === "green" ? result.band : "green",
        message: typeof result.message === "string" ? result.message : "Done",
      });
    } catch {
      setError("Update failed.");
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
  if (error && !assignment) {
    return (
      <div className="space-y-6">
        <p className="text-[var(--color-error)]">{error}</p>
        <Button asChild variant="secondary">
          <Link href="/client">Back to dashboard</Link>
        </Button>
      </div>
    );
  }
  if (!assignment || !responseId) return null;

  if (submitResult) {
    const { score, band, message } = submitResult;
    const bandStyles = {
      red: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200",
      orange:
        "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200",
      green: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200",
    };
    const bandLabel = band === "green" ? "Excellent" : band === "orange" ? "On track" : "Needs attention";
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-[var(--color-border)] p-0">
          <div
            className={`p-6 text-center border-b-4 ${band === "red" ? "border-red-500" : band === "orange" ? "border-amber-500" : "border-green-500"}`}
          >
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Check-in updated</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Here’s your updated summary</p>
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
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Button asChild variant="primary">
                <Link href={`/client/response/${responseId}`}>View response & coach feedback</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/client">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const totalSteps = questions.length + 1;
  const isSubmitStep = currentStep >= questions.length;
  const currentQuestion = !isSubmitStep ? questions[currentStep] : null;

  const goPrev = () => setCurrentStep((s) => Math.max(0, s - 1));
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Edit check-in — {assignment.formTitle}</h1>
        <Button asChild variant="ghost">
          <Link href={`/client/response/${responseId}`}>Cancel</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)]">
          {isSubmitStep ? "Review & save" : `Question ${currentStep + 1} of ${questions.length}`}
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
              inputClass={checkInInputClass}
            />
          )}

          {isSubmitStep && (
            <div className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">Save your changes when you’re ready.</p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={goPrev}>
                  Previous
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          )}

          {!isSubmitStep && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {currentStep > 0 && (
                <Button type="button" variant="secondary" onClick={goPrev}>
                  Previous
                </Button>
              )}
              <Button type="button" variant="primary" onClick={goNext}>
                Next
              </Button>
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}
