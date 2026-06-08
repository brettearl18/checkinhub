"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import type { PendingAchievementItem } from "@/lib/achievements";

interface Props {
  clientId: string;
}

export function CoachPendingBadgesPanel({ clientId }: Props) {
  const { fetchWithAuth } = useApiClient();
  const [pending, setPending] = useState<PendingAchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/achievements/pending`);
      if (res.ok) {
        const data = await res.json();
        setPending(Array.isArray(data.pending) ? data.pending : []);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (achievementId: string, action: "approve" | "dismiss") => {
    setActingId(achievementId);
    try {
      const res = await fetchWithAuth(
        `/api/coach/clients/${clientId}/achievements/${achievementId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.achievementId !== achievementId));
      }
    } finally {
      setActingId(null);
    }
  };

  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <Card className="border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)]/20 p-5">
      <h2 className="text-lg font-medium text-[var(--color-text)]">
        Pending badges
        <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
          ({pending.length})
        </span>
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        This client earned these badges. Approve to send them to the client portal, or dismiss to skip.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((badge) => (
          <li
            key={badge.achievementId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl" aria-hidden>
                {badge.emoji}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text)]">{badge.name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{badge.description}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Eligible {formatDateDisplay(badge.eligibleAt.slice(0, 10))}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={actingId === badge.achievementId}
                onClick={() => handleAction(badge.achievementId, "approve")}
              >
                {actingId === badge.achievementId ? "…" : "Approve"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={actingId === badge.achievementId}
                onClick={() => handleAction(badge.achievementId, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
