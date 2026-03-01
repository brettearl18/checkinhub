"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface FormRow {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
  isActive: boolean;
  isStandard: boolean;
}

interface StandardForm {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
}

export default function CoachFormsPage() {
  const { fetchWithAuth } = useApiClient();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [standards, setStandards] = useState<StandardForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showStandards, setShowStandards] = useState(false);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const [formsRes, standardsRes] = await Promise.all([
        fetchWithAuth("/api/coach/forms"),
        fetchWithAuth("/api/coach/forms/standards"),
      ]);
      if (formsRes.status === 401 || standardsRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (formsRes.ok) {
        const data = await formsRes.json();
        setForms(Array.isArray(data) ? data : []);
      }
      if (standardsRes.ok) {
        const data = await standardsRes.json();
        setStandards(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleCopyStandard = async (sourceFormId: string) => {
    setCopying(sourceFormId);
    try {
      const res = await fetchWithAuth("/api/coach/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Copy", isCopyingStandard: true, sourceFormId }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowStandards(false);
        if (data.id) window.location.href = `/coach/forms/${data.id}/edit`;
        else await load();
      }
    } finally {
      setCopying(null);
    }
  };

  const handleDelete = async (formId: string) => {
    if (!confirm("Delete this form? Assignments and responses are not affected.")) return;
    setDeleting(formId);
    try {
      const res = await fetchWithAuth(`/api/coach/forms/${formId}`, { method: "DELETE" });
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
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Forms</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Create and edit check-in forms. Add questions from your library or copy a standard template.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowStandards(true)} disabled={standards.length === 0}>
            Copy from standard
          </Button>
          <Button asChild variant="primary">
            <Link href="/coach/forms/new">Create form</Link>
          </Button>
        </div>
      </div>

      {showStandards && (
        <Card className="p-4">
          <h2 className="font-medium text-[var(--color-text)]">Copy from standard template</h2>
          <ul className="mt-2 space-y-2">
            {standards.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded border border-[var(--color-border)] p-3">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{s.title}</p>
                  {s.description && <p className="text-sm text-[var(--color-text-muted)]">{s.description}</p>}
                  <p className="text-xs text-[var(--color-text-muted)]">{s.questions?.length ?? 0} questions</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => handleCopyStandard(s.id)}
                  disabled={copying !== null}
                >
                  {copying === s.id ? "Copying…" : "Copy"}
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="mt-3" onClick={() => setShowStandards(false)}>
            Cancel
          </Button>
        </Card>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && forms.length === 0 && !showStandards && (
        <Card className="p-6">
          <p className="text-[var(--color-text-muted)]">No forms yet. Create one or copy from a standard template.</p>
        </Card>
      )}
      {!loading && forms.length > 0 && !showStandards && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {forms.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{f.title}</p>
                  {f.description && <p className="text-sm text-[var(--color-text-muted)]">{f.description}</p>}
                  <p className="text-xs text-[var(--color-text-muted)]">{f.questions?.length ?? 0} questions · {f.isActive ? "Active" : "Inactive"}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary">
                    <Link href={`/coach/forms/${f.id}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(f.id)}
                    disabled={deleting !== null}
                  >
                    {deleting === f.id ? "…" : "Delete"}
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
