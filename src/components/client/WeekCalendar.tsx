"use client";

import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";
import { isWeekOpenPerth } from "@/lib/perth-date";

export interface WeekOption {
  reflectionWeekStart: string; // Monday YYYY-MM-DD
  label: string;
  isThisWeek: boolean;
  isNextWeek?: boolean; // +1 week, not yet open (opens Friday 9am)
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Friday of the week (Monday YYYY-MM-DD) for "Opens Fri X, 9am" */
function getFridayOfWeek(mondayYyyyMmDd: string): string {
  const [y, m, d] = mondayYyyyMmDd.split("-").map(Number);
  const mon = new Date(y, m - 1, d);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return toLocalDateString(fri);
}

function getWeekDays(mondayYyyyMmDd: string): { dayLabel: string; date: string; display: string }[] {
  const [y, m, d] = mondayYyyyMmDd.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const days: { dayLabel: string; date: string; display: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = toLocalDateString(date);
    const dayOfMonth = date.getDate();
    days.push({
      dayLabel: DAY_LABELS[i],
      date: dateStr,
      display: `${DAY_LABELS[i]} ${dayOfMonth}`,
    });
  }
  return days;
}

interface WeekCalendarProps {
  weeks: WeekOption[];
  completedWeekStarts: string[];
  inProgressWeekStarts: string[];
  onSelectWeek: (reflectionWeekStart: string) => void;
  disabled?: boolean;
  resolving?: boolean;
}

/** Today in local YYYY-MM-DD for highlighting the current day. */
function getTodayLocal(): string {
  const d = new Date();
  return toLocalDateString(d);
}

export function WeekCalendar({
  weeks,
  completedWeekStarts,
  inProgressWeekStarts,
  onSelectWeek,
  disabled = false,
  resolving = false,
}: WeekCalendarProps) {
  const todayLocal = getTodayLocal();
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Tap a week to start or resume your check-in
      </p>
      <div className="space-y-2">
        {weeks.map((w) => {
          const done = completedWeekStarts.includes(w.reflectionWeekStart);
          const inProgress = inProgressWeekStarts.includes(w.reflectionWeekStart);
          const thisWeekNotYetOpen = w.isThisWeek === true && !isWeekOpenPerth(w.reflectionWeekStart);
          const pending = w.isNextWeek === true || thisWeekNotYetOpen;
          const isDisabled = done || pending || disabled || resolving;
          const days = getWeekDays(w.reflectionWeekStart);
          const sunday = days[6];
          const weekRangeLabel = `${formatDateDisplay(w.reflectionWeekStart)} – ${formatDateDisplay(sunday.date)}`;
          const fridayDate = pending ? getFridayOfWeek(w.reflectionWeekStart) : null; // Friday of that week for "opens Fri 9am"
          const outstanding = !done && !pending;

          const rowBg =
            done
              ? "bg-green-200 border-green-400 dark:bg-green-800/40 dark:border-green-600"
              : pending
                ? "bg-violet-200 border-violet-400 dark:bg-violet-800/40 dark:border-violet-600"
                : "bg-amber-200 border-amber-400 dark:bg-amber-800/40 dark:border-amber-600";

          return (
            <button
              key={w.reflectionWeekStart}
              type="button"
              onClick={() => !isDisabled && onSelectWeek(w.reflectionWeekStart)}
              disabled={isDisabled}
              className={`w-full rounded-[var(--radius-md)] border text-left transition-colors ${rowBg} ${
                isDisabled
                  ? "cursor-not-allowed opacity-90"
                  : outstanding
                    ? "hover:border-amber-500 hover:bg-amber-300 dark:hover:bg-amber-700/50"
                    : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-inherit px-3 py-2">
                <span className="font-medium text-[var(--color-text)]">
                  {w.isThisWeek ? "This week" : w.isNextWeek ? "Next week" : "Week of " + formatDateDisplay(w.reflectionWeekStart)}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">{weekRangeLabel}</span>
                {done && (
                  <span className="rounded bg-green-400/90 px-1.5 py-0.5 text-xs font-medium text-green-900 dark:bg-green-600 dark:text-green-100">
                    ✓ Done
                  </span>
                )}
                {pending && (
                  <span className="rounded bg-violet-400/90 px-1.5 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-600 dark:text-violet-100">
                    Pending — opens Friday 9am Perth{fridayDate ? ` (${formatDateDisplay(fridayDate)})` : ""}
                  </span>
                )}
                {outstanding && inProgress && (
                  <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-600 dark:text-amber-100">
                    In progress — tap to resume
                  </span>
                )}
                {outstanding && !inProgress && (
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-100">Tap to start check-in</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {days.map((day) => {
                  const isToday = day.date === todayLocal;
                  return (
                    <span
                      key={day.date}
                      className={`inline-flex min-w-[2.25rem] flex-col items-center rounded px-1.5 py-1 text-center ${
                        isToday
                          ? "bg-[var(--color-primary)]/25 ring-2 ring-[var(--color-primary)] dark:bg-[var(--color-primary)]/30"
                          : "bg-black/5 dark:bg-white/10"
                      }`}
                      aria-hidden={!isToday}
                      aria-current={isToday ? "date" : undefined}
                    >
                      <span className={`text-[10px] font-medium ${isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}>
                        {day.dayLabel}
                      </span>
                      <span className={`text-sm font-semibold tabular-nums ${isToday ? "text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>
                        {day.display.split(" ")[1]}
                      </span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
