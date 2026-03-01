"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface QuestionRow {
  id: string;
  text: string;
  type: string;
  description: string | null;
  questionWeight: number | null;
  isRequired: boolean;
}

export default function CoachQuestionsPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState("text");
  const [newOptionsStr, setNewOptionsStr] = useState("");
  const [newQuestionWeight, setNewQuestionWeight] = useState("");
  const [newYesNoWeight, setNewYesNoWeight] = useState("");
  const [newYesIsPositive, setNewYesIsPositive] = useState(true);
  const [creating, setCreating] = useState(false);

  const needsOptions = ["select", "multiple_choice", "scale"].includes(newType);
  const isBoolean = newType === "boolean";

  const load = async () => {
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
        setList(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleCreate = async () => {
    if (!newText.trim()) return;
    setCreating(true);
    try {
      const body: {
        text: string;
        type: string;
        options?: string[];
        questionWeight?: number;
        yesNoWeight?: number;
        yesIsPositive?: boolean;
      } = {
        text: newText.trim(),
        type: newType,
      };
      if (needsOptions && newOptionsStr.trim()) {
        body.options = newOptionsStr
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const qw = newQuestionWeight.trim();
      if (qw !== "") {
        const n = Number(qw);
        if (!Number.isNaN(n)) body.questionWeight = n;
      }
      if (isBoolean) {
        body.yesIsPositive = newYesIsPositive;
        const ynw = newYesNoWeight.trim();
        if (ynw !== "") {
          const n = Number(ynw);
          if (!Number.isNaN(n)) body.yesNoWeight = n;
        }
      }
      const res = await fetchWithAuth("/api/coach/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewText("");
        setNewType("text");
        setNewOptionsStr("");
        setNewQuestionWeight("");
        setNewYesNoWeight("");
        setNewYesIsPositive(true);
        setShowNew(false);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question? Remove it from all forms first, or it may break form references.")) return;
    setDeleting(id);
    try {
      const res = await fetchWithAuth(`/api/coach/questions/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setDeleting(null);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Questions library</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Create and edit questions. Use them in your forms.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(!showNew)}>
          {showNew ? "Cancel" : "New question"}
        </Button>
      </div>

      {showNew && (
        <Card className="p-6 space-y-4">
          <h2 className="font-medium text-[var(--color-text)]">New question</h2>
          <Input label="Question text" value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="e.g. How are you feeling this week?" />
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
            >
              <option value="text">Text</option>
              <option value="textarea">Text area</option>
              <option value="number">Number</option>
              <option value="scale">Scale (1–10)</option>
              <option value="boolean">Yes/No</option>
              <option value="select">Single choice</option>
              <option value="multiple_choice">Multiple choice</option>
              <option value="date">Date</option>
              <option value="time">Time</option>
            </select>
          </div>
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Options (one per line or comma-separated)
              </label>
              <textarea
                value={newOptionsStr}
                onChange={(e) => setNewOptionsStr(e.target.value)}
                rows={4}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                placeholder={
                  newType === "scale"
                    ? "1\n2\n3\n4\n5\n... or 1-10"
                    : "Option A\nOption B\nOption C"
                }
              />
            </div>
          )}
          <Input
            label="Weight (optional, for scoring)"
            type="number"
            value={newQuestionWeight}
            onChange={(e) => setNewQuestionWeight(e.target.value)}
            placeholder="e.g. 10"
          />
          {isBoolean && (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newYesIsPositive}
                  onChange={(e) => setNewYesIsPositive(e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                <span className="text-sm text-[var(--color-text)]">Yes is positive (uncheck for reverse: No = good)</span>
              </label>
              <Input
                label="Weight when Yes (optional)"
                type="number"
                value={newYesNoWeight}
                onChange={(e) => setNewYesNoWeight(e.target.value)}
                placeholder="e.g. 10"
              />
            </>
          )}
          <Button onClick={handleCreate} disabled={!newText.trim() || creating}>
            {creating ? "Creating…" : "Create question"}
          </Button>
        </Card>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <Card className="p-6">
          <p className="text-[var(--color-text-muted)]">No questions yet. Create one to use in forms.</p>
        </Card>
      )}
      {!loading && list.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {list.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{q.text}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Type: {q.type}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/coach/questions/${q.id}/edit`}>
                    <Button variant="ghost">Edit</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => handleDelete(q.id)} disabled={deleting !== null}>
                    {deleting === q.id ? "…" : "Delete"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
