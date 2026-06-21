"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CyclePhaseRing } from "@/components/client/CyclePhaseRing";
import { phaseBadgeLabel } from "@/lib/cycle-view";
import { formatDateDisplay } from "@/lib/format-date";
import type { CyclePhaseInfo, CycleProfile } from "@/lib/cycle-tracking";

export interface CoachCycleGlanceData {
  shared: boolean;
  phase?: CyclePhaseInfo;
  profile?: {
    lastPeriodStart: string | null;
    lastPeriodEnd: string | null;
    averageCycleLength: number;
    averagePeriodLength: number;
  };
  summary?: {
    avgMood7d: number | null;
    avgEnergy7d: number | null;
    daysLogged: number;
  };
}

function profileForRing(clientId: string, profile: NonNullable<CoachCycleGlanceData["profile"]>): CycleProfile {
  return {
    clientId,
    trackingEnabled: true,
    shareWithCoach: true,
    shareNotesWithCoach: false,
    averageCycleLength: profile.averageCycleLength,
    averagePeriodLength: profile.averagePeriodLength ?? 5,
    lastPeriodStart: profile.lastPeriodStart,
    lastPeriodEnd: profile.lastPeriodEnd ?? null,
    periodHistory: [],
    trackSexualActivity: false,
    cycleRegularity: null,
    onHormonalBirthControl: null,
    computedCycleLengthMin: null,
    computedCycleLengthMax: null,
                cyclePromoDismissedAt: null,
                cycleDashboardBannerDismissedAt: null,
                setupCompleted: true,
  };
}

export function CoachCycleWellbeingGlance({
  clientId,
  data,
}: {
  clientId: string;
  data: CoachCycleGlanceData | null;
}) {
  if (!data?.shared || !data.phase || !data.profile) return null;

  const ringProfile = profileForRing(clientId, data.profile);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <CyclePhaseRing profile={ringProfile} phaseInfo={data.phase} compact viewer="coach" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Cycle wellbeing
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
              {phaseBadgeLabel(data.phase)}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Estimated phase · client shared</p>
            {data.profile.lastPeriodStart && (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Last period: {formatDateDisplay(data.profile.lastPeriodStart)}
                {data.profile.lastPeriodEnd
                  ? ` – ${formatDateDisplay(data.profile.lastPeriodEnd)}`
                  : ""}{" "}
                · ~{data.profile.averageCycleLength}-day cycle
              </p>
            )}
            {data.summary && (
              <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {data.summary.avgMood7d != null && (
                  <li>Avg mood (14d): {data.summary.avgMood7d}/5</li>
                )}
                {data.summary.avgEnergy7d != null && (
                  <li>Avg energy (14d): {data.summary.avgEnergy7d}/5</li>
                )}
                {data.summary.daysLogged > 0 && (
                  <li>{data.summary.daysLogged} day{data.summary.daysLogged !== 1 ? "s" : ""} logged (14d)</li>
                )}
              </ul>
            )}
          </div>
        </div>
        <Link
          href={`/coach/clients/${clientId}/cycle`}
          className="shrink-0 text-center text-sm font-medium text-[var(--color-primary)] hover:underline sm:text-right"
        >
          View full cycle →
        </Link>
      </div>
    </Card>
  );
}
