"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useApiClient } from "@/lib/api-client";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
}

export default function CheckInFormPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<{
    assignment: { id: string; formTitle: string; status: string };
    form: { id: string; title: string; questions: string[] };
    questions: Question[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const responses = data.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? "",
      }));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {assignment.formTitle}
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

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                {q.text}
              </label>
              {q.type === "scale" && (
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={String(answers[q.id] ?? 5)}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              )}
              {q.type === "text" && (
                <textarea
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[var(--color-text)]"
                  rows={3}
                />
              )}
              {q.type !== "scale" && q.type !== "text" && (
                <Input
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit check-in"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
