"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import { downloadProgressPhotoFile } from "@/lib/progress-photo-social-export";

interface HallOfFameEntry {
  id: string;
  clientId: string;
  clientName: string;
  pose: string;
  imageUrl: string;
  beforeDate: string | null;
  afterDate: string | null;
  createdAt: string | null;
}

interface EditForm {
  pose: string;
  beforeDate: string;
  afterDate: string;
  file: File | null;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export default function CoachHallOfFamePage() {
  const { fetchWithAuth } = useApiClient();
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HallOfFameEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ pose: "", beforeDate: "", afterDate: "", file: null });
  const [deleteTarget, setDeleteTarget] = useState<HallOfFameEntry | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/coach/hall-of-fame");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      } else {
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const openEdit = (entry: HallOfFameEntry) => {
    setEditing(entry);
    setEditForm({
      pose: entry.pose,
      beforeDate: toDateInput(entry.beforeDate),
      afterDate: toDateInput(entry.afterDate),
      file: null,
    });
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("pose", editForm.pose.trim());
      if (editForm.beforeDate) formData.append("beforeDate", editForm.beforeDate);
      if (editForm.afterDate) formData.append("afterDate", editForm.afterDate);
      if (editForm.file) formData.append("file", editForm.file);

      const res = await fetchWithAuth(`/api/coach/hall-of-fame/${editing.id}`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update");
      }
      const updated = (await res.json()) as HallOfFameEntry;
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (entry: HallOfFameEntry) => {
    setDownloadingId(entry.id);
    setError(null);
    try {
      const filename = [
        sanitizeFilenamePart(entry.clientName),
        sanitizeFilenamePart(entry.pose),
        "before-after",
      ].join("-");
      await downloadProgressPhotoFile(entry.imageUrl, filename, fetchWithAuth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/hall-of-fame/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to delete");
      }
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Hall of Fame</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Your saved before & after highlights — 4:5 shares you&apos;ve published from client
          progress.
        </p>
      </div>

      {error && !editing && !deleteTarget && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && entries.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            No highlights saved yet. Create a 4:5 share from a client&apos;s progress photos and
            check &quot;Save to Hall of Fame&quot; when you download.
          </p>
          <Link
            href="/coach/clients"
            className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View clients
          </Link>
        </Card>
      )}

      {!loading && entries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="overflow-hidden p-0">
              <div className="relative aspect-[4/5] bg-[var(--color-bg-elevated)]">
                <Link href={`/coach/clients/${entry.clientId}/progress`} className="block h-full">
                  <Image
                    src={entry.imageUrl}
                    alt={`${entry.clientName} ${entry.pose} highlight`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    unoptimized
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDownload(entry)}
                  disabled={busyId === entry.id || downloadingId === entry.id}
                  title="Download highlight"
                  aria-label={`Download ${entry.clientName} highlight`}
                  className="absolute bottom-1.5 left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white/85 backdrop-blur-sm transition hover:bg-black/50 hover:text-white disabled:opacity-50"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                </button>
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    disabled={busyId === entry.id || downloadingId === entry.id}
                    className="rounded-full border border-white/30 bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-60"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(entry);
                      setError(null);
                    }}
                    disabled={busyId === entry.id || downloadingId === entry.id}
                    className="rounded-full border border-white/30 bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="font-medium text-[var(--color-text)]">{entry.clientName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {entry.pose}
                  {entry.beforeDate && entry.afterDate && (
                    <>
                      {" "}
                      · {formatDateDisplay(entry.beforeDate.slice(0, 10))} →{" "}
                      {formatDateDisplay(entry.afterDate.slice(0, 10))}
                    </>
                  )}
                </p>
                {entry.createdAt && (
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                    Saved {formatDateDisplay(entry.createdAt.slice(0, 10))}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditing(null)}
        >
          <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Edit highlight</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Update labels and dates, or replace the image file.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-text)]">Pose / label</span>
                <input
                  type="text"
                  value={editForm.pose}
                  onChange={(e) => setEditForm((f) => ({ ...f, pose: e.target.value }))}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--color-text)]">Before date</span>
                  <input
                    type="date"
                    value={editForm.beforeDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, beforeDate: e.target.value }))}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--color-text)]">After date</span>
                  <input
                    type="date"
                    value={editForm.afterDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, afterDate: e.target.value }))}
                    className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-text)]">
                  Replace image (optional)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))
                  }
                  className="w-full text-sm text-[var(--color-text-muted)]"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busyId !== null}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={busyId !== null}>
                {busyId ? "Saving…" : "Save"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteTarget(null)}
        >
          <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Delete highlight?</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Remove {deleteTarget.clientName}&apos;s {deleteTarget.pose} highlight from your Hall of
              Fame. This cannot be undone.
            </p>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busyId !== null}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={busyId !== null}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {busyId ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
