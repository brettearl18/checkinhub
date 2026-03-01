"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface QuestionRow {
  id: string;
  text: string;
  type?: string;
}

interface ResponseRow {
  questionId: string;
  answer: string | number | string[];
  score?: number;
}

interface ResponseData {
  id: string;
  formTitle: string;
  responses: ResponseRow[];
  score: number;
  submittedAt: string | null;
}

interface FeedbackItem {
  id: string;
  questionId: string | null;
  feedbackType: string;
  content: string;
  createdAt: string | null;
}

export default function CoachViewResponsePage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const responseId = params.responseId as string;
  const { fetchWithAuth } = useApiClient();
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFeedback, setNewFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    const res = await fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}/feedback`);
    if (res.ok) {
      const list = await res.json();
      setFeedback(Array.isArray(list) ? list : []);
    }
  }, [fetchWithAuth, clientId, responseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dataRes, feedbackRes] = await Promise.all([
          fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}`),
          fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}/feedback`),
        ]);
        if (dataRes.status === 401 || feedbackRes.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (!dataRes.ok) {
          if (!cancelled) setError("Could not load response.");
          return;
        }
        const data = await dataRes.json();
        if (!cancelled) {
          setResponse(data.response ?? null);
          setQuestions(Array.isArray(data.questions) ? data.questions : []);
        }
        if (feedbackRes.ok) {
          const list = await feedbackRes.json();
          if (!cancelled) setFeedback(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) setError("Could not load response.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchWithAuth, clientId, responseId]);

  const handleAddFeedback = async (questionId: string | null) => {
    const key = questionId ?? "__overall__";
    const content = newFeedback[key]?.trim();
    if (!content) return;
    setSubmitting(key);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, feedbackType: "text", content }),
      });
      if (res.ok) {
        setNewFeedback((prev) => ({ ...prev, [key]: "" }));
        await loadFeedback();
      }
    } finally {
      setSubmitting(null);
    }
  };

  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const feedbackByQuestion = (qId: string | null) =>
    feedback.filter((f) => (qId === null ? f.questionId === null : f.questionId === qId));

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/coach/clients/${clientId}`}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← Back to check-ins
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          Past check-in response
        </h1>
      </div>

      {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && response && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-wrap items-baseline gap-4">
            <h2 className="text-lg font-medium text-[var(--color-text)]">{response.formTitle}</h2>
            {response.submittedAt && (
              <span className="text-sm text-[var(--color-text-muted)]">
                Submitted {new Date(response.submittedAt).toLocaleString()}
              </span>
            )}
            {typeof response.score === "number" && (
              <span className="text-sm text-[var(--color-text)]">Score: {response.score}</span>
            )}
          </div>

          <dl className="space-y-4">
            {response.responses.map((r) => {
              const q = byId[r.questionId];
              const label = q?.text ?? r.questionId;
              const answer = Array.isArray(r.answer)
                ? r.answer.join(", ")
                : String(r.answer ?? "—");
              const qFeedback = feedbackByQuestion(r.questionId);
              const feedbackKey = r.questionId;
              return (
                <div key={r.questionId} className="border-b border-[var(--color-border)] pb-4 last:border-0">
                  <dt className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}</dt>
                  <dd className="text-[var(--color-text)]">{answer}</dd>
                  {typeof r.score === "number" && (
                    <dd className="text-xs text-[var(--color-text-muted)] mt-1">Score: {r.score}</dd>
                  )}
                  {qFeedback.length > 0 && (
                    <div className="mt-3 rounded bg-[var(--color-bg-elevated)] p-3 text-sm">
                      <span className="font-medium text-[var(--color-text-secondary)]">Your feedback: </span>
                      {qFeedback.map((f) => (
                        <p key={f.id} className="mt-1 text-[var(--color-text)]">{f.content}</p>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <textarea
                      placeholder="Add feedback for client…"
                      value={newFeedback[feedbackKey] ?? ""}
                      onChange={(e) => setNewFeedback((prev) => ({ ...prev, [feedbackKey]: e.target.value }))}
                      className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                      rows={2}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleAddFeedback(r.questionId)}
                      disabled={!newFeedback[feedbackKey]?.trim() || submitting === feedbackKey}
                    >
                      {submitting === feedbackKey ? "…" : "Add"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Overall feedback</h3>
            {feedbackByQuestion(null).length > 0 && (
              <div className="mb-3 rounded bg-[var(--color-bg-elevated)] p-3 text-sm">
                {feedbackByQuestion(null).map((f) => (
                  <p key={f.id} className="text-[var(--color-text)]">{f.content}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                placeholder="Add overall feedback for this check-in…"
                value={newFeedback["__overall__"] ?? ""}
                onChange={(e) => setNewFeedback((prev) => ({ ...prev, __overall__: e.target.value }))}
                className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                rows={2}
              />
              <Button
                variant="secondary"
                onClick={() => handleAddFeedback(null)}
                disabled={!newFeedback["__overall__"]?.trim() || submitting === "__overall__"}
              >
                {submitting === "__overall__" ? "…" : "Add"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && !response && !error && (
        <p className="text-[var(--color-text-muted)]">Response not found.</p>
      )}
    </div>
  );
}
