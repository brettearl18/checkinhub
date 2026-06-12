"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { BADGES_BY_DIFFICULTY, CATEGORY_LABELS, type AchievementListItem } from "@/lib/achievements";
import { formatDateDisplay } from "@/lib/format-date";

export default function ClientAchievementsPage() {
  const { fetchWithAuth } = useApiClient();
  const [achievements, setAchievements] = useState<AchievementListItem[]>([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/client/achievements");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
        setEarnedCount(typeof data.earnedCount === "number" ? data.earnedCount : 0);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  if (authError) return <AuthErrorRetry onRetry={load} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="vana-page-title mt-2">Your badges</h1>
        <p className="mt-2 text-sm text-stone-600">
          {earnedCount} of {achievements.length} earned. Locked badges show what you can work toward next.
        </p>
      </div>

      {loading && <p className="text-sm text-stone-500">Loading…</p>}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {BADGES_BY_DIFFICULTY.map((def) => {
            const item = achievements.find((a) => a.id === def.id);
            const earned = item?.earned ?? false;
            return (
              <Card
                key={def.id}
                className={`vana-card flex gap-4 p-4 ${
                  earned ? "" : "opacity-90"
                }`}
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl ${
                    earned
                      ? "border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)]"
                      : "border border-dashed border-stone-200 bg-stone-100"
                  }`}
                >
                  <span className={earned ? "" : "opacity-30 grayscale"} aria-hidden>
                    {def.emoji}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                    {CATEGORY_LABELS[def.category]}
                  </p>
                  <p className={`font-medium ${earned ? "text-stone-800" : "text-stone-500"}`}>
                    {def.name}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">{def.description}</p>
                  {earned && item?.earnedAt && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Earned {formatDateDisplay(item.earnedAt.slice(0, 10))}
                    </p>
                  )}
                  {!earned && (
                    <p className="mt-1 text-xs text-stone-400">Not earned yet</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
