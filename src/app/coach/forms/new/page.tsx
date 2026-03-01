"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface QuestionOption {
  id: string;
  text: string;
  type: string;
}

export default function CoachNewFormPage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [questionOptions, setQuestionOptions] = useState<QuestionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const res = await fetchWithAuth("/api/coach/questions");
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setQuestionOptions(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  const addQuestion = (id: string) => {
    if (!questionIds.includes(id)) setQuestionIds((prev) => [...prev, id]);
    setShowAdd(false);
  };

  const removeQuestion = (index: number) => {
    setQuestionIds((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setQuestionIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= questionIds.length - 1) return;
    setQuestionIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/coach/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          questionIds,
          isActive: true,
        }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Failed to create form.");
        return;
      }
      const data = await res.json();
      if (data.id) router.push(`/coach/forms/${data.id}/edit`);
      else router.push("/coach/forms");
    } catch {
      setError("Failed to create form.");
    } finally {
      setSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  const byId = Object.fromEntries(questionOptions.map((q) => [q.id, q]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/forms" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Forms
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">New form</h1>
      </div>

      <Card className="p-6 space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly check-in" />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Wellness" />
      </Card>

      <Card className="p-6">
        <h2 className="font-medium text-[var(--color-text)]">Questions</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Add questions in order. Use the Questions library or create new ones first.</p>
        {loading && <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading library…</p>}
        {!loading && (
          <>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => setShowAdd(!showAdd)}>
                {showAdd ? "Cancel" : "Add from library"}
              </Button>
            </div>
            {showAdd && questionOptions.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-[var(--color-border)] p-2">
                {questionOptions.filter((q) => !questionIds.includes(q.id)).map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-[var(--color-text)]">{q.text || q.id}</span>
                    <Button variant="ghost" onClick={() => addQuestion(q.id)}>Add</Button>
                  </li>
                ))}
                {questionOptions.filter((q) => !questionIds.includes(q.id)).length === 0 && (
                  <li className="py-2 text-sm text-[var(--color-text-muted)]">All questions already added.</li>
                )}
              </ul>
            )}
            <ul className="mt-4 space-y-2">
              {questionIds.map((id, index) => (
                <li key={id} className="flex items-center gap-2 rounded border border-[var(--color-border)] px-3 py-2">
                  <span className="text-sm text-[var(--color-text-muted)] w-6">{index + 1}.</span>
                  <span className="flex-1 text-sm text-[var(--color-text)]">{byId[id]?.text ?? id}</span>
                  <Button variant="ghost" onClick={() => moveUp(index)} disabled={index === 0}>↑</Button>
                  <Button variant="ghost" onClick={() => moveDown(index)} disabled={index === questionIds.length - 1}>↓</Button>
                  <Button variant="ghost" onClick={() => removeQuestion(index)}>Remove</Button>
                </li>
              ))}
            </ul>
            {questionIds.length === 0 && !showAdd && <p className="mt-2 text-sm text-[var(--color-text-muted)]">No questions yet. Add from library above.</p>}
          </>
        )}
      </Card>

      {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create form"}</Button>
        <Button asChild variant="secondary">
          <Link href="/coach/forms">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
