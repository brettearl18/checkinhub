"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface Props {
  earnedCount: number;
  totalCount: number;
  recentEmoji?: string | null;
}

export function AchievementsSummary({ earnedCount, totalCount, recentEmoji }: Props) {
  if (totalCount === 0) return null;

  return (
    <Link href="/client/achievements" className="block">
      <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-[var(--color-primary-muted)]">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Your badges</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {earnedCount} of {totalCount} earned
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recentEmoji && (
            <span className="text-2xl" aria-hidden>
              {recentEmoji}
            </span>
          )}
          <span className="text-sm font-medium text-[var(--color-primary)]">View all →</span>
        </div>
      </Card>
    </Link>
  );
}
