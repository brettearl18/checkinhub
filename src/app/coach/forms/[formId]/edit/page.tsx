"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

export default function CoachEditFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;
  const { fetchWithAuth } = useApiClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [questionOptions, setQuestionOptions] = useState<QuestionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const [formRes, questionsRes] = await Promise.all([
          fetchWithAuth(`/api/coach/forms/${formId}`),
          fetchWithAuth("/api/coach/questions"),
        ]);
        if (formRes.status === 401 || questionsRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (formRes.ok) {
          const form = await formRes.json();
          setTitle(form.title ?? "");
          setDescription(form.description ?? "");
          setCategory(form.category ?? "");
          setQuestionIds(Array.isArray(form.questions) ? form.questions : []);
        }
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          setQuestionOptions(Array.isArray(data) ? data : []);
        }
      } catch {
        setError("Failed to load form.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth, formId]);

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
      const res = await fetchWithAuth(`/api/coach/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          questionIds,
        }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Failed to save.");
        return;
      }
      setError(null);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this form? Existing assignments and responses are not deleted.")) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/coach/forms/${formId}`, { method: "DELETE" });
      if (res.ok) router.push("/coach/forms");
      else setError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  const byId = Object.fromEntries(questionOptions.map((q) => [q.id, q]));

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/coach/forms" className="text-sm text-[var(--color-primary)] hover:underline">← Forms</Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/coach/forms" className="text-sm text-[var(--color-primary)] hover:underline">← Forms</Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Edit form</h1>
        </div>
        <Button variant="ghost" onClick={handleDelete} disabled={deleting}>{deleting ? "…" : "Delete form"}</Button>
      </div>

      <Card className="p-6 space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      </Card>

      <Card className="p-6">
        <h2 className="font-medium text-[var(--color-text)]">Questions</h2>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancel" : "Add from library"}</Button>
        </div>
        {showAdd && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-[var(--color-border)] p-2">
            {questionOptions.filter((q) => !questionIds.includes(q.id)).map((q) => (
              <li key={q.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-[var(--color-text)]">{q.text || q.id}</span>
                <Button variant="ghost" onClick={() => addQuestion(q.id)}>Add</Button>
              </li>
            ))}
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
      </Card>

      {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button asChild variant="secondary">
          <Link href="/coach/forms">Back to forms</Link>
        </Button>
      </div>
    </div>
  );
}
