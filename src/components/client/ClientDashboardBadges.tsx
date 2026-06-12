"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";
import {
  BADGES_BY_DIFFICULTY,
  type AchievementDefinition,
  type AchievementListItem,
} from "@/lib/achievements";
import { formatDateDisplay } from "@/lib/format-date";

function BadgeTile({
  badge,
  earnedAt,
}: {
  badge: AchievementDefinition;
  earnedAt: string | null;
}) {
  const dateHint = earnedAt ? ` · ${formatDateDisplay(earnedAt.slice(0, 10))}` : "";

  return (
    <div
      className="group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] text-sm transition sm:h-8 sm:w-8"
      title={`${badge.name} — earned${dateHint}`}
    >
      <span aria-hidden>{badge.emoji}</span>
      <span className="sr-only">{badge.name}, earned</span>
    </div>
  );
}

export function ClientDashboardBadges({ className = "" }: { className?: string }) {
  const { fetchWithAuth } = useApiClient();
  const [achievements, setAchievements] = useState<AchievementListItem[] | null>(null);
  const [earnedCount, setEarnedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/client/achievements");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.achievements)) {
        setAchievements(data.achievements);
        setEarnedCount(typeof data.earnedCount === "number" ? data.earnedCount : 0);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className={className}>
        <Card className="vana-card p-4">
          <p className="text-xs text-stone-500">Loading badges…</p>
        </Card>
      </section>
    );
  }

  if (!achievements?.length) return null;

  const byId = new Map(achievements.map((a) => [a.id, a]));
  const earnedBadges = BADGES_BY_DIFFICULTY.filter((def) => byId.get(def.id)?.earned);

  if (earnedBadges.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="vana-section-label">Your badges</h2>
          <p className="mt-1 text-xs text-stone-500">
            {earnedCount} earned
            {achievements.length > earnedCount
              ? ` · ${achievements.length - earnedCount} more to unlock`
              : ""}
          </p>
        </div>
        <Link
          href="/client/achievements"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          View all →
        </Link>
      </div>
      <Card className="vana-card p-2.5 sm:p-3">
        <div className="flex flex-wrap gap-1.5">
          {earnedBadges.map((def) => {
            const item = byId.get(def.id);
            return (
              <BadgeTile
                key={def.id}
                badge={def}
                earnedAt={item?.earnedAt ?? null}
              />
            );
          })}
        </div>
      </Card>
    </section>
  );
}
