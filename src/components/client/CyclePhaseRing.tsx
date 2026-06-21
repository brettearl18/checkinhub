"use client";

import {
  computePeriodPrediction,
  computeRingSegments,
  type CyclePeriodPrediction,
} from "@/lib/cycle-view";
import { CYCLE_PHASE_META, type CyclePhaseInfo, type CycleProfile } from "@/lib/cycle-tracking";

export function CyclePhaseRing({
  profile,
  phaseInfo,
}: {
  profile: CycleProfile;
  phaseInfo: CyclePhaseInfo;
}) {
  const prediction = computePeriodPrediction(profile);
  const cycleLength = profile.averageCycleLength;
  const cycleDay = phaseInfo.cycleDay;
  const segments = computeRingSegments(cycleLength, profile.averagePeriodLength);

  const size = 240;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const activePhase = phaseInfo.phase === "unknown" ? null : phaseInfo.phase;

  let markerX = cx;
  let markerY = cy - radius;
  if (cycleDay != null && cycleLength > 0) {
    const angle = ((cycleDay - 0.5) / cycleLength) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    markerX = cx + radius * Math.cos(rad);
    markerY = cy + radius * Math.sin(rad);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
            opacity={0.35}
          />
          {segments.map((seg) => {
            const days = seg.endDay - seg.startDay + 1;
            const dash = (days / cycleLength) * circumference;
            const gap = circumference - dash;
            const isActive = activePhase === seg.phase;
            const el = (
              <circle
                key={seg.phase}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                opacity={isActive ? 1 : activePhase ? 0.28 : 0.55}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>

        {cycleDay != null && (
          <div
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--color-primary)] shadow-md"
            style={{ left: markerX, top: markerY }}
            aria-hidden
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {cycleDay != null ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Cycle day {cycleDay}
              </p>
              <p className="mt-2 text-lg font-semibold leading-snug text-[var(--color-text)]">
                {prediction.headline}
              </p>
              {prediction.subline && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{prediction.subline}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-[var(--color-text)]">{prediction.headline}</p>
              {prediction.subline && (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{prediction.subline}</p>
              )}
            </>
          )}
        </div>
      </div>

      {activePhase && (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          You&apos;re in the{" "}
          <span className="font-medium text-[var(--color-text)]">
            {CYCLE_PHASE_META[activePhase].label.toLowerCase()} phase
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {segments.map((seg) => {
          const isActive = activePhase === seg.phase;
          return (
            <span
              key={seg.phase}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                isActive
                  ? "bg-[var(--color-primary-subtle)] font-medium text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden />
              {seg.label}
            </span>
          );
        })}
      </div>

      <p className="mt-3 max-w-xs text-center text-xs text-[var(--color-text-muted)]">
        Estimated only — not medical advice. Individual cycles vary.
      </p>
    </div>
  );
}

export type { CyclePeriodPrediction };
