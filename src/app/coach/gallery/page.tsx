"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ProgressPhotoEditForm } from "@/components/coach/ProgressPhotoEditForm";
import { useApiClient } from "@/lib/api-client";
import { formatProgressPhotoDate } from "@/lib/progress-photo-dates";
import { formatProgressImageTypeLabel, getLatestProgressPhotoPerPose, sortProgressPhotosByPoseThenDate } from "@/lib/progress-comparison-photos";

interface GalleryImage {
  id: string;
  clientId: string;
  clientName: string;
  imageUrl: string;
  imageType: string | null;
  orientation: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

export default function CoachGalleryPage() {
  const searchParams = useSearchParams();
  const { fetchWithAuth } = useApiClient();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [filterClient, setFilterClient] = useState<string>(
    () => searchParams.get("client") ?? ""
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const client = searchParams.get("client");
    if (client) setFilterClient(client);
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/gallery");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setImages(Array.isArray(data) ? data : []);
      } else {
        setImages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const clientIds = Array.from(new Set(images.map((i) => i.clientId)));
  const filtered = useMemo(() => {
    const list = filterClient ? images.filter((i) => i.clientId === filterClient) : images;
    if (filterClient) {
      return getLatestProgressPhotoPerPose(list);
    }
    return sortProgressPhotosByPoseThenDate(list);
  }, [images, filterClient]);

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
          Progress photos
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {filterClient
            ? "Latest photo per angle — front, back, then side."
            : "Progress photos from your clients. View by client or see all."}
        </p>
      </div>

      {clientIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Filter by client:</span>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="">All clients</option>
            {clientIds.map((id) => {
              const name = images.find((i) => i.clientId === id)?.clientName ?? id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-[var(--color-text-muted)]">
            No before & after photos yet. When clients upload progress photos, they’ll appear here.
          </p>
          <Link
            href="/coach/clients"
            className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View clients
          </Link>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((img) => (
            <Card key={img.id} className="overflow-hidden p-0">
              <div className="relative aspect-[3/4] bg-[var(--color-bg-elevated)]">
                <Link href={`/coach/clients/${img.clientId}/progress`} className="block h-full">
                  <Image
                    src={img.imageUrl}
                    alt={img.caption || img.imageType || "Progress photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    unoptimized
                  />
                </Link>
              </div>
              <div className="p-3">
                <Link
                  href={`/coach/clients/${img.clientId}/progress`}
                  className="block hover:opacity-90"
                >
                  <p className="font-medium text-[var(--color-text)]">{img.clientName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatProgressImageTypeLabel(img.imageType)}
                    {img.uploadedAt && (
                      <> · {formatProgressPhotoDate(img.uploadedAt)}</>
                    )}
                  </p>
                  {img.caption && (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {img.caption}
                    </p>
                  )}
                </Link>
                {editingId === img.id ? (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <ProgressPhotoEditForm
                      patchUrl={`/api/coach/clients/${img.clientId}/progress-images/${img.id}`}
                      initialImageType={img.imageType}
                      initialUploadedAt={img.uploadedAt}
                      initialCaption={img.caption}
                      compact
                      onSaved={() => {
                        setEditingId(null);
                        load();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 min-h-9 w-full py-1.5 text-xs"
                    onClick={() => setEditingId(img.id)}
                  >
                    Edit date & angle
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
