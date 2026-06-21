"use client";

import { useMemo, useState } from "react";
import { buildCalendarGrid, logsByDate, type CycleCalendarCell } from "@/lib/cycle-view";
import {
  CYCLE_PHASE_META,
  type CycleDailyLog,
  type CyclePhase,
  type CycleProfile,
} from "@/lib/cycle-tracking";
import { todayPerth } from "@/lib/perth-date";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PHASE_ORDER: Exclude<CyclePhase, "unknown">[] = [
  "menstrual",
  "follicular",
  "ovulation",
  "luteal",
];

function cellTooltip(cell: CycleCalendarCell): string | undefined {
  if (!cell.date || cell.cycleDay == null || !cell.phase || cell.phase === "unknown") return undefined;
  const label = CYCLE_PHASE_META[cell.phase as Exclude<CyclePhase, "unknown">].label;
  const parts = [`Cycle day ${cell.cycleDay}`, `${label} phase (estimated)`];
  if (cell.isPeriodDay) parts.push("Period logged");
  else if (cell.isPredictedPeriod) parts.push("Period estimated");
  if (cell.hasLog) parts.push("Symptoms/mood logged");
  return parts.join(" · ");
}

function cellStyles(cell: CycleCalendarCell): React.CSSProperties {
  if (!cell.date) return {};

  if (cell.isPeriodDay) {
    return {
      backgroundColor: "rgba(201, 120, 106, 0.52)",
      borderColor: "#c9786a",
    };
  }

  if (cell.isPredictedPeriod) {
    return {
      backgroundColor: "rgba(201, 120, 106, 0.34)",
      borderColor: "#c9786a",
      borderStyle: "dashed",
    };
  }

  if (cell.phase && cell.phase !== "unknown") {
    return {
      backgroundColor: CYCLE_PHASE_META[cell.phase as Exclude<CyclePhase, "unknown">].calendarBg,
    };
  }

  return {};
}

export function CycleCalendar({
  profile,
  logs,
  onSelectDate,
}: {
  profile: CycleProfile;
  logs: CycleDailyLog[];
  onSelectDate?: (date: string) => void;
}) {
  const today = todayPerth();
  const [year, month] = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    return [y, m];
  }, [today]);

  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);

  const logMap = useMemo(() => logsByDate(logs), [logs]);
  const cells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, profile, logMap, today),
    [viewYear, viewMonth, profile, logMap, today]
  );

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const hasPhaseGuide = Boolean(profile.lastPeriodStart);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-[var(--color-text)]">{monthLabel}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {hasPhaseGuide && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Rough cycle phase guide
          </p>
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {PHASE_ORDER.map((phase) => (
              <div
                key={phase}
                className="flex-1 first:rounded-l-full last:rounded-r-full"
                style={{ backgroundColor: CYCLE_PHASE_META[phase].color }}
                title={CYCLE_PHASE_META[phase].label}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
            {PHASE_ORDER.map((phase) => (
              <span key={phase} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: CYCLE_PHASE_META[phase].color }}
                  aria-hidden
                />
                {CYCLE_PHASE_META[phase].label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
            Coloured day cells are estimates from your last period start — not medical advice.
          </p>
        </div>
      )}

      {!hasPhaseGuide && (
        <p className="mb-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Log when your period started to see phase colours and estimated period days on the calendar.
        </p>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-medium uppercase text-[var(--color-text-muted)]">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.date || cell.dayNum == null) {
            return <div key={`pad-${i}`} className="aspect-square" />;
          }

          const style = cellStyles(cell);
          const tooltip = cellTooltip(cell);

          return (
            <button
              key={cell.date}
              type="button"
              title={tooltip}
              onClick={() => onSelectDate?.(cell.date!)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 text-sm transition-colors ${
                cell.isToday
                  ? "z-[1] font-bold text-[var(--color-text)] ring-2 ring-[var(--color-primary)] ring-offset-1"
                  : cell.isPredictedPeriod || cell.isPeriodDay
                    ? "font-semibold text-[var(--color-text)]"
                    : "border-transparent text-[var(--color-text)] hover:opacity-90"
              } ${!cell.isPeriodDay && !cell.isPredictedPeriod && !cell.phase ? "hover:bg-[var(--color-bg-elevated)]" : ""}`}
              style={{
                ...style,
                borderStyle: cell.isPredictedPeriod && !cell.isPeriodDay ? "dashed" : "solid",
                borderColor:
                  cell.isPeriodDay || cell.isPredictedPeriod
                    ? (style.borderColor as string)
                    : cell.isToday
                      ? "transparent"
                      : "transparent",
              }}
            >
              <span>{cell.dayNum}</span>
              {cell.cycleDay != null && cell.phase && (
                <span className="mt-0.5 text-[8px] font-medium uppercase leading-none text-[var(--color-text-muted)]">
                  {CYCLE_PHASE_META[cell.phase as Exclude<CyclePhase, "unknown">].label.slice(0, 3)}
                </span>
              )}
              <span className="absolute bottom-0.5 flex gap-0.5">
                {cell.hasLog && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] shadow-sm" aria-hidden />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Legend
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
          {PHASE_ORDER.map((phase) => (
            <span key={phase} className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded border border-black/5"
                style={{ backgroundColor: CYCLE_PHASE_META[phase].calendarBg }}
                aria-hidden
              />
              {CYCLE_PHASE_META[phase].label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border-2 border-[#c9786a]"
              style={{ backgroundColor: "rgba(201, 120, 106, 0.52)" }}
            />
            Period logged
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border-2 border-dashed border-[#c9786a]"
              style={{ backgroundColor: "rgba(201, 120, 106, 0.34)" }}
            />
            Period estimated
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            Mood/symptoms logged
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded ring-2 ring-[var(--color-primary)] ring-offset-1" />
            Today
          </span>
        </div>
      </div>
    </div>
  );
}
