"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

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
  const { fetchWithAuth } = useApiClient();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("");

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
  const filtered = filterClient
    ? images.filter((i) => i.clientId === filterClient)
    : images;

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
          Before & after photos
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Progress photos from your clients. View by client or see all.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((img) => (
            <Card key={img.id} className="overflow-hidden p-0">
              <Link href={`/coach/clients/${img.clientId}/progress`} className="block">
                <div className="relative aspect-[3/4] bg-[var(--color-bg-elevated)]">
                  <Image
                    src={img.imageUrl}
                    alt={img.caption || img.imageType || "Progress photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    unoptimized
                  />
                </div>
                <div className="p-3">
                  <p className="font-medium text-[var(--color-text)]">{img.clientName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {img.imageType?.replace(/_/g, " ") ?? "Photo"}
                    {img.uploadedAt && (
                      <> · {new Date(img.uploadedAt).toLocaleDateString()}</>
                    )}
                  </p>
                  {img.caption && (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {img.caption}
                    </p>
                  )}
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
