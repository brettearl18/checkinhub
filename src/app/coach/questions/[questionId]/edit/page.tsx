"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

const QUESTION_TYPES = [
  "text",
  "textarea",
  "number",
  "scale",
  "boolean",
  "select",
  "multiple_choice",
  "date",
  "time",
];

export default function EditQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const questionId = params?.questionId as string;
  const { fetchWithAuth } = useApiClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState("text");
  const [description, setDescription] = useState("");
  const [questionWeight, setQuestionWeight] = useState("");
  const [yesNoWeight, setYesNoWeight] = useState("");
  const [yesIsPositive, setYesIsPositive] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [optionsStr, setOptionsStr] = useState("");

  useEffect(() => {
    if (!questionId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const res = await fetchWithAuth(`/api/coach/questions/${questionId}`);
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.ok) {
          const q = await res.json();
          setText(q.text ?? "");
          setType(q.type ?? "text");
          setDescription(q.description ?? "");
          setQuestionWeight(q.questionWeight != null ? String(q.questionWeight) : "");
          setYesNoWeight(q.yesNoWeight != null ? String(q.yesNoWeight) : "");
          setYesIsPositive(q.yesIsPositive !== false);
          setIsRequired(!!q.isRequired);
          const opts = q.options;
          if (Array.isArray(opts)) {
            setOptionsStr(
              opts.map((o: { text?: string; weight?: number } | string) =>
                typeof o === "string" ? o : (o.text ?? "")
              ).join("\n")
            );
          } else {
            setOptionsStr("");
          }
        } else {
          setAuthError(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId, fetchWithAuth]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const options = optionsStr
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        text: text.trim(),
        type,
        description: description.trim() || null,
        isRequired,
      };
      if (questionWeight !== "") {
        const w = Number(questionWeight);
        if (!Number.isNaN(w)) body.questionWeight = w;
      }
      if (type === "boolean") {
        body.yesIsPositive = yesIsPositive;
        body.yesNoWeight = yesNoWeight.trim() === "" ? null : (() => {
          const w = Number(yesNoWeight);
          return Number.isNaN(w) ? null : w;
        })();
      }
      if (["select", "multiple_choice", "scale"].includes(type) && options.length) {
        body.options = options;
      }
      const res = await fetchWithAuth(`/api/coach/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.push("/coach/questions");
    } finally {
      setSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/coach/questions" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Questions library
        </Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/coach/questions" className="text-sm text-[var(--color-primary)] hover:underline">
        ← Questions library
      </Link>
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Edit question</h1>

      <Card className="p-6 space-y-4">
        <Input
          label="Question text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. How are you feeling this week?"
        />
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Helper text for the client"
        />
        <Input
          label="Weight (optional, for scoring)"
          type="number"
          value={questionWeight}
          onChange={(e) => setQuestionWeight(e.target.value)}
          placeholder="e.g. 10"
        />
        {type === "boolean" && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={yesIsPositive}
                onChange={(e) => setYesIsPositive(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span className="text-sm text-[var(--color-text)]">Yes is positive (uncheck for reverse: No = good)</span>
            </label>
            <Input
              label="Weight when Yes (optional)"
              type="number"
              value={yesNoWeight}
              onChange={(e) => setYesNoWeight(e.target.value)}
              placeholder="e.g. 10"
            />
          </>
        )}
        {["select", "multiple_choice", "scale"].includes(type) && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Options (one per line or comma-separated)
            </label>
            <textarea
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.target.value)}
              rows={4}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
              placeholder="Option 1\nOption 2\n..."
            />
          </div>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="rounded border-[var(--color-border)]"
          />
          <span className="text-sm text-[var(--color-text)]">Required</span>
        </label>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave} disabled={!text.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/coach/questions")}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
