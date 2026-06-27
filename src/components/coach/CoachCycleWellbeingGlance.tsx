"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CyclePhaseRing } from "@/components/client/CyclePhaseRing";
import { phaseBadgeLabel } from "@/lib/cycle-view";
import { formatDateDisplay } from "@/lib/format-date";
import type { CyclePhaseInfo, CycleProfile } from "@/lib/cycle-tracking";

export type CoachCycleGlanceReason =
  | "not_started"
  | "setup_incomplete"
  | "not_sharing"
  | "not_opted_in";

export interface CoachCycleGlanceData {
  shared: boolean;
  reason?: CoachCycleGlanceReason;
  trackingEnabled?: boolean;
  setupCompleted?: boolean;
  shareWithCoach?: boolean;
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

function inactiveCopy(data: CoachCycleGlanceData | null): { title: string; detail: string } {
  const reason = data?.reason;
  if (reason === "setup_incomplete") {
    return {
      title: "Setup not finished",
      detail: "This client started cycle tracking but hasn't completed setup yet.",
    };
  }
  if (reason === "not_sharing") {
    return {
      title: "Not shared with you",
      detail: "This client is tracking their cycle but hasn't opted in to share it with you yet.",
    };
  }
  if (reason === "not_opted_in" || reason === "not_started" || !data) {
    return {
      title: "Not set up yet",
      detail: "This client hasn't set up cycle tracking in CheckinHUB yet.",
    };
  }
  return {
    title: "Not available",
    detail: "Cycle wellbeing data isn't available for this client right now.",
  };
}

function CyclePlaceholderRing() {
  return (
    <div
      className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-stone-100/80"
      aria-hidden
    >
      <svg
        className="h-9 w-9 text-stone-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function CoachCycleWellbeingGlance({
  clientId,
  data,
}: {
  clientId: string;
  data: CoachCycleGlanceData | null;
}) {
  const isActive = Boolean(data?.shared && data.phase && data.profile);

  if (isActive && data?.phase && data.profile) {
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
                    <li>
                      {data.summary.daysLogged} day{data.summary.daysLogged !== 1 ? "s" : ""} logged (14d)
                    </li>
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

  const { title, detail } = inactiveCopy(data);

  return (
    <Card className="border border-dashed border-stone-200 bg-stone-50/90 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <CyclePlaceholderRing />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Cycle wellbeing</p>
            <p className="mt-1 text-lg font-semibold text-stone-400">{title}</p>
            <p className="mt-1 text-sm text-stone-400">{detail}</p>
          </div>
        </div>
        <span className="shrink-0 text-center text-sm text-stone-400 sm:text-right">Not shared</span>
      </div>
    </Card>
  );
}
