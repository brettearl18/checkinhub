"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

const IMAGE_TYPES = [
  { value: "before_front", label: "Before (front)" },
  { value: "before_side", label: "Before (side)" },
  { value: "before_back", label: "Before (back)" },
  { value: "after_front", label: "After (front)" },
  { value: "after_side", label: "After (side)" },
  { value: "after_back", label: "After (back)" },
  { value: "other", label: "Other" },
] as const;

export default function ProgressPhotosPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageType, setImageType] = useState("before_front");
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/progress-images");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load photos.");
        return;
      }
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load photos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    const file = input.files[0];
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("imageType", imageType);
      if (caption.trim()) formData.append("caption", caption.trim());

      const res = await fetchWithAuth("/api/client/progress-images", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body && body.error) || "Upload failed.");
        return;
      }
      setCaption("");
      input.value = "";
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Before & after photos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Upload progress photos to track your journey. Choose before/after and orientation.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-[var(--color-text)]">Add photo</h2>
        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Photo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-[var(--color-text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--color-primary-subtle)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Type</label>
            <select
              value={imageType}
              onChange={(e) => setImageType(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
            >
              {IMAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Week 4"
          />
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
        </form>
      </Card>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Your photos</h2>
        {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
        {!loading && list.length === 0 && (
          <EmptyState
            title="No photos yet"
            description="Upload a before or after photo using the form above."
          />
        )}
        {!loading && list.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((img) => (
              <Card key={img.id} className="overflow-hidden p-0">
                <div className="relative aspect-[3/4] bg-[var(--color-bg-elevated)]">
                  <Image
                    src={img.imageUrl}
                    alt={img.caption || img.imageType || "Progress photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">
                    {IMAGE_TYPES.find((t) => t.value === img.imageType)?.label ?? img.imageType ?? "Photo"}
                  </p>
                  {img.caption && (
                    <p className="mt-1 text-sm text-[var(--color-text)]">{img.caption}</p>
                  )}
                  {img.uploadedAt && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {formatDateDisplay(img.uploadedAt)}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
