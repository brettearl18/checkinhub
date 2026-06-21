"use client";

import type { CycleWeekDay } from "@/lib/cycle-view";
import { CYCLE_PHASE_META, type CyclePhase } from "@/lib/cycle-tracking";

function dotColor(day: CycleWeekDay): string | null {
  if (day.isPeriodDay) return "#c9786a";
  if (day.isPredictedPeriod) return "#c9786a88";
  if (day.hasLog) return "var(--color-primary)";
  if (day.phase && day.phase !== "unknown") return CYCLE_PHASE_META[day.phase as Exclude<CyclePhase, "unknown">].color;
  return null;
}

export function CycleWeekStrip({
  days,
  onSelectDate,
}: {
  days: CycleWeekDay[];
  onSelectDate?: (date: string) => void;
}) {
  return (
    <div className="flex justify-between gap-1">
      {days.map((day) => {
        const color = dotColor(day);
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate?.(day.date)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl py-2 transition-colors ${
              day.isToday
                ? "bg-[var(--color-primary-subtle)] ring-1 ring-[var(--color-primary-muted)]"
                : "hover:bg-[var(--color-bg-elevated)]"
            }`}
          >
            <span
              className={`text-[10px] font-medium uppercase ${
                day.isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
              }`}
            >
              {day.weekdayLabel}
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                day.isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
              }`}
            >
              {day.dayNum}
            </span>
            <span className="flex h-2 items-center justify-center gap-0.5">
              {color ? (
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-transparent" aria-hidden />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
