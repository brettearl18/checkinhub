"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useApiClient } from "@/lib/api-client";

interface Question {
  id: string;
  text: string;
  title?: string;
  type: string;
  description?: string | null;
  options?: string[] | Array<{ text: string; weight?: number }>;
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

function getOptionLabels(options: Question["options"]): string[] {
  if (!options || !Array.isArray(options)) return [];
  return options.map((o) => (typeof o === "string" ? o : o.text ?? ""));
}

function getScaleRange(options: Question["options"]): { min: number; max: number } {
  const labels = getOptionLabels(options);
  const nums = labels.map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  if (nums.length >= 2) return { min: Math.min(...nums), max: Math.max(...nums) };
  return { min: 1, max: 10 };
}

type DraftResponse = { questionId: string; answer: string | number | string[]; notes?: string };

function buildResponses(
  questions: Question[],
  answers: Record<string, string | number | string[]>,
  notes: Record<string, string>
): DraftResponse[] {
  return questions.map((q) => {
    const raw = answers[q.id];
    const answer = raw === undefined || raw === null ? "" : raw;
    return { questionId: q.id, answer, notes: notes[q.id] ?? "" };
  });
}

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/check-in/${assignmentId}`);
        if (!res.ok) {
          if (res.status === 404) setError("Check-in not found.");
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
        const r = byId[q.questionId];
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
      router.push("/client");
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
              <Button asChild variant="primary">
                <Link href={`/client/response/${responseId}`}>View response & coach feedback</Link>
              </Button>
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

function QuestionBlock({
  q,
  answers,
  setAnswers,
  notes,
  setNotes,
  inputClass,
}: {
  q: Question;
  answers: Record<string, string | number | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string | number | string[]>>>;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inputClass: string;
}) {
  const label = q.text || (q.title as string) || "Question";
  const desc = q.description;
  const options = getOptionLabels(q.options);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
      {desc && (
        <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
      )}

      {q.type === "scale" && (() => {
        const { min, max } = getScaleRange(q.options);
        const val = Number(answers[q.id]);
        const value = Number.isNaN(val) ? Math.round((min + max) / 2) : Math.max(min, Math.min(max, val));
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: Number(e.target.value) }))
                }
                className="flex-1 h-2 rounded-full appearance-none bg-[var(--color-border)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-primary)]"
              />
              <span className="min-w-[2rem] text-sm font-medium text-[var(--color-text)]">
                {value}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{min} – {max}</p>
          </div>
        );
      })()}

      {q.type === "text" && (
        <input
          type="text"
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
          className={inputClass}
          placeholder="Your answer"
        />
      )}

      {q.type === "textarea" && (
        <textarea
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
          className={inputClass}
          rows={4}
          placeholder="Your answer"
        />
      )}

      {q.type === "number" && (
        <input
          type="number"
          step="any"
          value={answers[q.id] !== undefined && answers[q.id] !== "" ? String(answers[q.id]) : ""}
          onChange={(e) => {
            const v = e.target.value;
            setAnswers((prev) => ({ ...prev, [q.id]: v === "" ? "" : Number(v) }));
          }}
          className={inputClass}
          placeholder="Number"
        />
      )}

      {q.type === "boolean" && (
        <div className="flex gap-3">
          {["Yes", "No"].map((opt) => {
            const current = answers[q.id];
            const selected =
              current === "Yes" || current === "yes" || current === true ? "Yes"
              : current === "No" || current === "no" || current === false ? "No"
              : null;
            const isSelected = selected === opt;
            return (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-[var(--color-primary-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={isSelected}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  className="sr-only"
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {q.type === "select" && options.length > 0 && (
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm transition-colors ${
                answers[q.id] === opt
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:border-[var(--color-primary-muted)]"
              }`}
            >
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === opt}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                className="h-4 w-4 border-[var(--color-border)] text-[var(--color-primary)]"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.type === "multiple_choice" && options.length > 0 && (() => {
        const current = answers[q.id];
        const selected = Array.isArray(current) ? current : typeof current === "string" ? [current] : [];
        const toggle = (opt: string) => {
          const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
          setAnswers((prev) => ({ ...prev, [q.id]: next }));
        };
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] hover:border-[var(--color-primary-muted)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                />
                {opt}
              </label>
            ))}
          </div>
        );
      })()}

      {q.type === "date" && (
        <input
          type="date"
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
          className={inputClass}
        />
      )}

      {q.type === "time" && (
        <input
          type="time"
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
          className={inputClass}
        />
      )}

      {!["scale", "text", "textarea", "number", "boolean", "select", "multiple_choice", "date", "time"].includes(q.type) && (
        <Input
          value={String(answers[q.id] ?? "")}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
          placeholder="Your answer"
        />
      )}

      <div className="pt-2">
        <label htmlFor={`notes-${q.id}`} className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
          Notes (optional)
        </label>
        <textarea
          id={`notes-${q.id}`}
          value={notes[q.id] ?? ""}
          onChange={(e) => setNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
          placeholder="Add context or details to back up your answer"
          rows={2}
          className={inputClass}
        />
      </div>
    </div>
  );
}
