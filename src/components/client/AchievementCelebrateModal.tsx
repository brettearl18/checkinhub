"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { NewlyEarnedAchievement } from "@/lib/achievements";

interface Props {
  achievements: NewlyEarnedAchievement[];
  onClose: () => void;
}

export function AchievementCelebrateModal({ achievements, onClose }: Props) {
  if (achievements.length === 0) return null;

  const first = achievements[0]!;
  const more = achievements.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-celebrate-title"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-5xl" aria-hidden>
          {first.emoji}
        </p>
        <h2 id="badge-celebrate-title" className="mt-3 text-xl font-semibold text-[var(--color-text)]">
          Badge earned!
        </h2>
        <p className="mt-1 text-lg font-medium text-[var(--color-primary)]">{first.name}</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{first.description}</p>
        {more > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            +{more} more badge{more === 1 ? "" : "s"} earned
          </p>
        )}
        <Button className="mt-5 w-full" onClick={onClose}>
          Nice!
        </Button>
      </Card>
    </div>
  );
}
