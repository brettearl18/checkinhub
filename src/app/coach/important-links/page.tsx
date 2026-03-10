"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface ImportantLink {
  name: string;
  url: string;
}

export default function CoachImportantLinksPage() {
  const { fetchWithAuth } = useApiClient();
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/coach/important-links");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data.links) ? data.links : []);
      }
    } catch {
      setError("Failed to load links.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const url = newUrl.trim();
    if (!url) return;
    setSaving(true);
    setError(null);
    const next = [...links, { name: name || "Link", url }];
    try {
      const res = await fetchWithAuth("/api/coach/important-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: next }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) || "Failed to save.");
        return;
      }
      setLinks(next);
      setNewName("");
      setNewUrl("");
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (index: number) => {
    const next = links.filter((_, i) => i !== index);
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/coach/important-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: next }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) || "Failed to save.");
        return;
      }
      setLinks(next);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Important Links</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Save links you use often (e.g. payment options, bank details, forms). Name them and add the URL.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
          {error}
        </div>
      )}

      <Card className="p-4 md:p-6">
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-4">Add a link</h2>
        <form onSubmit={addLink} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label htmlFor="link-name" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Name
            </label>
            <input
              id="link-name"
              type="text"
              placeholder="e.g. Stripe Dashboard"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            />
          </div>
          <div className="min-w-[200px] flex-[2]">
            <label htmlFor="link-url" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              URL
            </label>
            <input
              id="link-url"
              type="url"
              placeholder="https://..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              required
            />
          </div>
          <Button type="submit" variant="primary" disabled={saving || !newUrl.trim()}>
            {saving ? "Saving…" : "Add link"}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="px-4 py-3 text-lg font-medium text-[var(--color-text)] border-b border-[var(--color-border)]">
          Your links
        </h2>
        {loading && (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</p>
        )}
        {!loading && links.length === 0 && (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">
            No links yet. Add one above (e.g. payment portal, bank link).
          </p>
        )}
        {!loading && links.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {links.map((link, index) => (
              <li
                key={`${link.url}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-bg-elevated)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--color-text)]">{link.name}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-primary)] hover:underline truncate block"
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="secondary">
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeLink(index)}
                    disabled={saving}
                    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
