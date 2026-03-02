"use client";

import { Input } from "@/components/ui/Input";

export interface CheckInQuestion {
  id: string;
  text: string;
  title?: string;
  type: string;
  description?: string | null;
  options?: string[] | Array<{ text: string; weight?: number }>;
}

export const checkInInputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

export function getOptionLabels(options: CheckInQuestion["options"]): string[] {
  if (!options || !Array.isArray(options)) return [];
  return options.map((o) => (typeof o === "string" ? o : o.text ?? ""));
}

export function getScaleRange(options: CheckInQuestion["options"]): { min: number; max: number } {
  const labels = getOptionLabels(options);
  const nums = labels.map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  if (nums.length >= 2) return { min: Math.min(...nums), max: Math.max(...nums) };
  return { min: 1, max: 10 };
}

export type DraftResponse = { questionId: string; answer: string | number | string[]; notes?: string };

export function buildResponses(
  questions: CheckInQuestion[],
  answers: Record<string, string | number | string[]>,
  notes: Record<string, string>
): DraftResponse[] {
  return questions.map((q) => {
    const raw = answers[q.id];
    const answer = raw === undefined || raw === null ? "" : raw;
    return { questionId: q.id, answer, notes: notes[q.id] ?? "" };
  });
}

export function QuestionBlock({
  q,
  answers,
  setAnswers,
  notes,
  setNotes,
  inputClass,
}: {
  q: CheckInQuestion;
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
      <label className="block text-sm font-medium text-[var(--color-text)]">{label}</label>
      {desc && <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>}

      {q.type === "scale" &&
        (() => {
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
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: Number(e.target.value) }))}
                  className="flex-1 h-2 rounded-full appearance-none bg-[var(--color-border)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-primary)]"
                />
                <span className="min-w-[2rem] text-sm font-medium text-[var(--color-text)]">{value}</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {min} – {max}
              </p>
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
              current === "Yes" || current === "yes" || current === true
                ? "Yes"
                : current === "No" || current === "no" || current === false
                  ? "No"
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

      {q.type === "select" &&
        options.length > 0 && (
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

      {q.type === "multiple_choice" &&
        options.length > 0 &&
        (() => {
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

      {!["scale", "text", "textarea", "number", "boolean", "select", "multiple_choice", "date", "time"].includes(
        q.type
      ) && (
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
