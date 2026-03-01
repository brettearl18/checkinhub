"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface FeedbackItem {
  id: string;
  questionId: string | null;
  content: string;
  createdAt: string | null;
}

export default function ClientViewResponsePage() {
  const params = useParams();
  const responseId = params.responseId as string;
  const { fetchWithAuth } = useApiClient();
  const [response, setResponse] = useState<{
    formTitle: string;
    responses: Array<{ questionId: string; answer: string | number | string[]; notes?: string }>;
    submittedAt: string | null;
  } | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/client/responses/${responseId}`);
        if (res.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("Could not load response.");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setResponse(data.response ?? null);
          setQuestions(Array.isArray(data.questions) ? data.questions : []);
          setFeedback(Array.isArray(data.feedback) ? data.feedback : []);
        }
      } catch {
        if (!cancelled) setError("Could not load response.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchWithAuth, responseId]);

  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const feedbackByQuestion = (qId: string | null) =>
    feedback.filter((f) => (qId === null ? f.questionId === null : f.questionId === qId));

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client/history" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Back to history
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Check-in & coach feedback</h1>
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
          </div>

          <dl className="space-y-4">
            {response.responses.map((r) => {
              const q = byId[r.questionId];
              const label = q?.text ?? r.questionId;
              const answer = Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer ?? "—");
              const qFeedback = feedbackByQuestion(r.questionId);
              const note = r.notes?.trim();
              return (
                <div key={r.questionId} className="border-b border-[var(--color-border)] pb-3 last:border-0">
                  <dt className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}</dt>
                  <dd className="text-[var(--color-text)]">{answer}</dd>
                  {note && (
                    <dd className="mt-1 text-sm text-[var(--color-text-muted)] italic">Notes: {note}</dd>
                  )}
                  {qFeedback.length > 0 && (
                    <div className="mt-3 rounded bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 p-3 text-sm">
                      <span className="font-medium text-[var(--color-text-secondary)]">Coach feedback: </span>
                      {qFeedback.map((f) => (
                        <p key={f.id} className="mt-1 text-[var(--color-text)]">{f.content}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </dl>

          {feedbackByQuestion(null).length > 0 && (
            <div className="rounded bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 p-4">
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Overall feedback from coach</h3>
              {feedbackByQuestion(null).map((f) => (
                <p key={f.id} className="text-[var(--color-text)]">{f.content}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      {!loading && !response && !error && (
        <p className="text-[var(--color-text-muted)]">Response not found.</p>
      )}
    </div>
  );
}
