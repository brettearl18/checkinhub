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
  earned,
  earnedAt,
}: {
  badge: AchievementDefinition;
  earned: boolean;
  earnedAt: string | null;
}) {
  const dateHint = earned && earnedAt ? ` · ${formatDateDisplay(earnedAt.slice(0, 10))}` : "";

  return (
    <div
      className={`group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl transition sm:h-14 sm:w-14 sm:text-2xl ${
        earned
          ? "border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] shadow-sm"
          : "border border-dashed border-stone-200 bg-stone-100/80"
      }`}
      title={`${badge.name}${earned ? " — earned" : " — not yet earned"}${dateHint}`}
    >
      <span
        className={earned ? "" : "opacity-30 grayscale"}
        aria-hidden
      >
        {badge.emoji}
      </span>
      <span className="sr-only">
        {badge.name}
        {earned ? ", earned" : ", locked"}
      </span>
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

  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="vana-section-label">Your badges</h2>
          <p className="mt-1 text-xs text-stone-500">
            {earnedCount} of {achievements.length} earned — keep going to fill the board
          </p>
        </div>
        <Link
          href="/client/achievements"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          View all →
        </Link>
      </div>
      <Card className="vana-card p-4">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-2.5">
          {BADGES_BY_DIFFICULTY.map((def) => {
            const item = byId.get(def.id);
            return (
              <BadgeTile
                key={def.id}
                badge={def}
                earned={item?.earned ?? false}
                earnedAt={item?.earnedAt ?? null}
              />
            );
          })}
        </div>
      </Card>
    </section>
  );
}
