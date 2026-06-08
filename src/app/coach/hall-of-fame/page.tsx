"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

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

export default function CoachHallOfFamePage() {
  const { fetchWithAuth } = useApiClient();
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
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
              <Link href={`/coach/clients/${entry.clientId}/progress2`} className="block">
                <div className="relative aspect-[4/5] bg-[var(--color-bg-elevated)]">
                  <Image
                    src={entry.imageUrl}
                    alt={`${entry.clientName} ${entry.pose} highlight`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    unoptimized
                  />
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
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
