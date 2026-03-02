"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface WeekLabel {
  key: string;
  label: string;
}

/** Fixed bands for per-question grid per doc §11.2: Good (7–10), Moderate (4–6), Needs attention (0–3). Score is 0–100. */
function getBand(score: number): "green" | "orange" | "red" {
  if (score < 40) return "red";   // 0–3 in 1–10 scale
  if (score < 70) return "orange"; // 4–6
  return "green";                  // 7–10
}

export default function ClientProgressPage() {
  const { fetchWithAuth } = useApiClient();
  const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([]);
  const [weeks, setWeeks] = useState<WeekLabel[]>([]);
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/client/question-progress");
        if (res.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("Could not load progress.");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setQuestions(Array.isArray(data.questions) ? data.questions : []);
          setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
          setGrid(typeof data.grid === "object" && data.grid !== null ? data.grid : {});
        }
      } catch {
        if (!cancelled) setError("Could not load progress.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          Question progress over time
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Track how each question improves week by week.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && (questions.length === 0 || weeks.length === 0) && (
        <Card className="p-6">
          <p className="text-[var(--color-text-muted)]">
            Complete check-ins to see your question progress here.
          </p>
          <Link
            href="/client/check-in/new"
            className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            New check-in →
          </Link>
        </Card>
      )}

      {!loading && questions.length > 0 && weeks.length > 0 && (
        <>
          <Card className="p-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Per-question traffic light (fixed scale 0–10)
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
                <span className="text-[var(--color-text)]">Good (7–10)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
                <span className="text-[var(--color-text)]">Moderate (4–6)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
                <span className="text-[var(--color-text)]">Needs attention (0–3)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[var(--color-border)]" aria-hidden />
                <span className="text-[var(--color-text)]">Not scored</span>
              </span>
            </div>
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                    Question
                  </th>
                  {weeks.map((w) => (
                    <th
                      key={w.key}
                      className="px-2 py-2 text-center font-medium text-[var(--color-text-muted)] whitespace-nowrap"
                    >
                      {w.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/50"
                  >
                    <td className="px-3 py-2 text-[var(--color-text)] max-w-[200px] truncate" title={q.text}>
                      {q.text}
                    </td>
                    {weeks.map((w) => {
                      const score = grid[q.id]?.[w.key];
                      const band = score != null ? getBand(score) : null;
                      return (
                        <td key={w.key} className="px-2 py-2 text-center">
                          <span
                            className={`inline-block h-4 w-4 rounded-full ${
                              band === "green"
                                ? "bg-green-500"
                                : band === "orange"
                                  ? "bg-amber-500"
                                  : band === "red"
                                    ? "bg-red-500"
                                    : "bg-[var(--color-border)]"
                            }`}
                            title={score != null ? `${score}%` : "Not scored"}
                            aria-hidden
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Scroll horizontally on small screens to see all weeks.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
