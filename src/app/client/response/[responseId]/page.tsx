"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";

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
    assignmentId: string | null;
    responses: Array<{ questionId: string; answer: string | number | string[]; notes?: string }>;
    score: number | null;
    band: "red" | "orange" | "green" | null;
    message: string | null;
    submittedAt: string | null;
  } | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [reviewDetails, setReviewDetails] = useState<{
    whereResponded: string[];
    notes: string | null;
    progressRating: number | null;
    reviewedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const WHERE_LABELS: Record<string, string> = {
    whatsapp: "WhatsApp",
    phone_call: "Phone Call",
    email: "Email",
    checkinhub: "CheckinHub",
    other: "Other",
  };

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
          setReviewDetails(data.reviewDetails ?? null);
        }
      } catch {
        if (!cancelled) setError("Could not load response.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchWithAuth, responseId]);

  // Mark as read when the client views this response
  useEffect(() => {
    if (!response || loading) return;
    fetchWithAuth(`/api/client/responses/${responseId}/read`, { method: "POST" }).catch(() => {});
  }, [response, loading, responseId, fetchWithAuth]);

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
        <>
          {response.score != null && (
            <Card className="overflow-hidden border-[var(--color-border)] p-0">
              <div
                className={`p-6 text-center border-b-4 ${
                  response.band === "red"
                    ? "border-red-500"
                    : response.band === "orange"
                      ? "border-amber-500"
                      : "border-green-500"
                }`}
              >
                <h2 className="text-xl font-semibold text-[var(--color-text)]">Your check-in score</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Review your traffic light anytime</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl font-bold tabular-nums text-[var(--color-text)]">{response.score}%</span>
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">Overall score</span>
                </div>
                <div
                  className={`rounded-lg border px-4 py-3 text-center ${
                    response.band === "red"
                      ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                      : response.band === "orange"
                        ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                        : "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                  }`}
                >
                  <span className="font-semibold">
                    {response.band === "green" ? "Excellent" : response.band === "orange" ? "On track" : "Needs attention"}
                  </span>
                  {response.message && <p className="mt-0.5 text-sm opacity-90">{response.message}</p>}
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-6">
            <div className="flex flex-wrap items-baseline gap-4">
              <h2 className="text-lg font-medium text-[var(--color-text)]">{response.formTitle}</h2>
              {response.submittedAt && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  Submitted {formatDateTimeDisplay(response.submittedAt)}
                </span>
              )}
              {response.assignmentId && (
                <Link
                  href={`/client/check-in/${response.assignmentId}/edit`}
                  className="ml-auto text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  Edit check-in
                </Link>
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

          {reviewDetails && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Coach review summary</h3>
              {reviewDetails.reviewedAt && (
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Reviewed {formatDateTimeDisplay(reviewDetails.reviewedAt)}
                </p>
              )}
              {reviewDetails.whereResponded.length > 0 && (
                <p className="text-sm text-[var(--color-text)] mb-1">
                  <span className="text-[var(--color-text-muted)]">Where they responded: </span>
                  {reviewDetails.whereResponded.map((k) => WHERE_LABELS[k] || k).join(", ")}
                </p>
              )}
              {reviewDetails.progressRating != null && (
                <p className="text-sm text-[var(--color-text)] mb-1">
                  <span className="text-[var(--color-text-muted)]">Progress rating: </span>
                  {reviewDetails.progressRating}/10
                </p>
              )}
              {reviewDetails.notes && (
                <p className="text-sm text-[var(--color-text)] mt-2">{reviewDetails.notes}</p>
              )}
            </div>
          )}
          </Card>
        </>
      )}

      {!loading && !response && !error && (
        <p className="text-[var(--color-text-muted)]">Response not found.</p>
      )}
    </div>
  );
}
