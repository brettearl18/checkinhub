"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";

interface QuestionRow {
  id: string;
  text: string;
  type?: string;
}

interface ResponseRow {
  questionId: string;
  answer: string | number | string[];
  notes?: string;
  score?: number;
}

interface ResponseData {
  id: string;
  formTitle: string;
  responses: ResponseRow[];
  score: number;
  band?: "red" | "orange" | "green";
  message?: string;
  submittedAt: string | null;
  coachResponded?: boolean;
  reviewedByCoach?: boolean;
  readByClient?: boolean;
  readByClientAt?: string | null;
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
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<{
    whereResponded: string[];
    notes: string;
    progressRating: number;
  }>({ whereResponded: [], notes: "", progressRating: 5 });

  const loadResponse = useCallback(async () => {
    const res = await fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}`);
    if (res.ok) {
      const data = await res.json();
      setResponse(data.response ?? null);
    }
  }, [fetchWithAuth, clientId, responseId]);

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
        await Promise.all([loadFeedback(), loadResponse()]);
      }
    } finally {
      setSubmitting(null);
    }
  };

  const openReviewModal = () => setShowReviewModal(true);
  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewError(null);
    setReviewForm({ whereResponded: [], notes: "", progressRating: 5 });
  };

  const toggleWhereResponded = (value: string) => {
    setReviewForm((prev) => ({
      ...prev,
      whereResponded: prev.whereResponded.includes(value)
        ? prev.whereResponded.filter((v) => v !== value)
        : [...prev.whereResponded, value],
    }));
  };

  const handleMarkReviewedSubmit = async () => {
    setReviewError(null);
    setMarkingReviewed(true);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/responses/${responseId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whereResponded: reviewForm.whereResponded,
          notes: reviewForm.notes.trim() || undefined,
          progressRating: reviewForm.progressRating,
        }),
      });
      if (res.ok) {
        closeReviewModal();
        await loadResponse();
      } else {
        const data = await res.json().catch(() => ({}));
        setReviewError((data as { error?: string; details?: string }).details ?? (data as { error?: string }).error ?? "Failed to save review. Please try again.");
      }
    } catch {
      setReviewError("Failed to save review. Please try again.");
    } finally {
      setMarkingReviewed(false);
    }
  };

  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const feedbackByQuestion = (qId: string | null) =>
    feedback.filter((f) => (qId === null ? f.questionId === null : f.questionId === qId));

  const totalSlots = response ? response.responses.length + 1 : 0;
  const reviewedCount = response
    ? response.responses.filter((r) => feedbackByQuestion(r.questionId).length > 0).length +
      (feedbackByQuestion(null).length > 0 ? 1 : 0)
    : 0;

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <Link
          href={`/coach/clients/${clientId}/progress`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary-muted)]"
        >
          View progress
          <span className="ml-1.5 text-[var(--color-text-muted)]" aria-hidden>↗</span>
        </Link>
      </div>

      {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && response && (
        <Card className="p-6 space-y-6">
          {!response.coachResponded && !response.reviewedByCoach && (
            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4">
              <p className="font-medium text-[var(--color-text)]">
                Your client is waiting for your feedback…
              </p>
            </div>
          )}
          {(response.coachResponded || response.reviewedByCoach) && (
            <p className="text-sm text-[var(--color-text-muted)]" role="status">
              {response.readByClient && response.readByClientAt ? (
                <>Client read this feedback on {formatDateTimeDisplay(response.readByClientAt)}.</>
              ) : (
                <>Client has not yet acknowledged reading this feedback.</>
              )}
            </p>
          )}
          {totalSlots > 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {reviewedCount} of {totalSlots} questions reviewed
            </p>
          )}
          {/* Scorecard at top: score %, band, message */}
          <div
            className={`rounded-lg border-2 p-4 ${
              response.band === "green"
                ? "border-green-500/50 bg-green-500/10"
                : response.band === "orange"
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-red-500/50 bg-red-500/10"
            }`}
          >
            <div className="flex flex-wrap items-center gap-4">
              {typeof response.score === "number" && (
                <span className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
                  {response.score}%
                </span>
              )}
              {response.band && (
                <span
                  className={`inline-flex h-8 w-8 flex-shrink-0 rounded-full ${
                    response.band === "green"
                      ? "bg-green-500"
                      : response.band === "orange"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  aria-hidden
                />
              )}
              {response.message && (
                <span className="text-lg font-medium text-[var(--color-text)]">
                  {response.message}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-4">
            <h2 className="text-lg font-medium text-[var(--color-text)]">{response.formTitle}</h2>
            {response.submittedAt && (
              <span className="text-sm text-[var(--color-text-muted)]">
                Submitted {formatDateTimeDisplay(response.submittedAt)}
              </span>
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
                  {r.notes?.trim() && (
                    <dd className="mt-1 text-sm text-[var(--color-text-muted)] italic">Client notes: {r.notes.trim()}</dd>
                  )}
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

          <div className="border-t border-[var(--color-border)] pt-4">
            {response.reviewedByCoach ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                This response has been marked as reviewed.
              </p>
            ) : (
              <Button
                variant="primary"
                onClick={openReviewModal}
                disabled={markingReviewed}
              >
                Mark as Reviewed
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Mark as Reviewed modal */}
      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <Card className="w-full max-w-md p-6 shadow-lg">
            <h2 id="review-modal-title" className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Mark as Reviewed
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Where did you respond to your client?
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                { id: "whatsapp", label: "WhatsApp" },
                { id: "phone_call", label: "Phone Call" },
                { id: "email", label: "Email" },
                { id: "checkinhub", label: "CheckinHub" },
                { id: "other", label: "Other" },
              ].map(({ id, label }) => (
                <label key={id} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewForm.whereResponded.includes(id)}
                    onChange={() => toggleWhereResponded(id)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <span className="text-sm text-[var(--color-text)]">{label}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Notes (optional)
              </label>
              <textarea
                value={reviewForm.notes}
                onChange={(e) => setReviewForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                rows={3}
                placeholder="Any notes about this review…"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                How happy are you with their progress this week? (1–10)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={reviewForm.progressRating}
                  onChange={(e) => setReviewForm((p) => ({ ...p, progressRating: Number(e.target.value) }))}
                  className="flex-1 h-2 rounded-lg appearance-none bg-[var(--color-border)]"
                />
                <span className="text-lg font-semibold tabular-nums text-[var(--color-text)] w-8">
                  {reviewForm.progressRating}
                </span>
              </div>
            </div>
            {reviewError && (
              <p className="text-sm text-[var(--color-error)] mb-4" role="alert">
                {reviewError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={closeReviewModal} disabled={markingReviewed}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleMarkReviewedSubmit} disabled={markingReviewed}>
                {markingReviewed ? "…" : "Mark as Reviewed"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {!loading && !response && !error && (
        <p className="text-[var(--color-text-muted)]">Response not found.</p>
      )}
    </div>
  );
}
