"use client";

import { formatDateDdMmYyyy, toLocalDateString } from "@/lib/format-date";
import { isWeekOpenPerth, thisMondayPerth } from "@/lib/perth-date";

export interface WeekOption {
  reflectionWeekStart: string; // Monday YYYY-MM-DD
  label: string;
  isThisWeek: boolean;
  isNextWeek?: boolean; // +1 week, not yet open (opens Friday 9am)
  /** Not open yet — shown grey, not tappable */
  isUpcomingPreview?: boolean;
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
  const monday = new Date(mondayYyyyMmDd + "T12:00:00Z");
  const days: { dayLabel: string; date: string; display: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const y = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${mo}-${day}`;
    days.push({
      dayLabel: DAY_LABELS[i],
      date: dateStr,
      display: `${DAY_LABELS[i]} ${date.getUTCDate()}`,
    });
  }
  return days;
}

interface WeekCalendarProps {
  weeks: WeekOption[];
  completedWeekStarts: string[];
  inProgressWeekStarts: string[];
  onSelectWeek: (reflectionWeekStart: string) => void;
  /** Past weeks only — mark that week's assignment as missed */
  onMarkMissed?: (reflectionWeekStart: string) => void;
  markingMissedWeek?: string | null;
  disabled?: boolean;
  resolving?: boolean;
}

/** Today in local YYYY-MM-DD for highlighting the current day. */
function getTodayLocal(): string {
  const d = new Date();
  return toLocalDateString(d);
}

/**
 * The reflection week a client should be filling now:
 * this calendar week once it has opened (Fri 9am), otherwise the previous week.
 */
function currentCheckInWeekStart(thisMonday: string): string {
  if (isWeekOpenPerth(thisMonday)) return thisMonday;
  const [y, m, d] = thisMonday.split("-").map(Number);
  const prev = new Date(y!, m! - 1, d!);
  prev.setDate(prev.getDate() - 7);
  return toLocalDateString(prev);
}

export function WeekCalendar({
  weeks,
  completedWeekStarts,
  inProgressWeekStarts,
  onSelectWeek,
  onMarkMissed,
  markingMissedWeek = null,
  disabled = false,
  resolving = false,
}: WeekCalendarProps) {
  const todayLocal = getTodayLocal();
  const thisMonday = thisMondayPerth();
  const activeCheckInWeek = currentCheckInWeekStart(thisMonday);
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Tap a week to start or resume your check-in
      </p>
      <div className="space-y-2">
        {weeks.map((w) => {
          const done = completedWeekStarts.includes(w.reflectionWeekStart);
          const inProgress = inProgressWeekStarts.includes(w.reflectionWeekStart);
          const upcoming =
            w.isUpcomingPreview === true ||
            ((w.isThisWeek || w.isNextWeek) && !isWeekOpenPerth(w.reflectionWeekStart));
          const isPast = w.reflectionWeekStart < thisMonday;
          const isDisabled = done || upcoming || disabled || resolving;
          const days = getWeekDays(w.reflectionWeekStart);
          const sunday = days[6];
          const weekRangeLabel = `${formatDateDdMmYyyy(w.reflectionWeekStart)} – ${formatDateDdMmYyyy(sunday.date)}`;
          const fridayDate = upcoming ? getFridayOfWeek(w.reflectionWeekStart) : null;
          const outstanding = !done && !upcoming;
          const showMarkMissed =
            Boolean(onMarkMissed) && outstanding && isPast && !disabled && !resolving;
          const isActiveCheckInWeek = w.reflectionWeekStart === activeCheckInWeek;

          // Active check-in week (the one to fill now) = pastel green; other past = amber; upcoming = grey; done = stronger green
          const rowBg = done
            ? "bg-green-200 border-green-400 dark:bg-green-800/40 dark:border-green-600"
            : isActiveCheckInWeek && outstanding
              ? "bg-[#e8f3ec] border-[#b7d7c2] dark:bg-emerald-900/30 dark:border-emerald-700/50"
              : upcoming
                ? "bg-stone-100 border-stone-300 dark:bg-stone-800/50 dark:border-stone-600"
                : "bg-amber-200 border-amber-400 dark:bg-amber-800/40 dark:border-amber-600";

          return (
            <div
              key={w.reflectionWeekStart}
              className={`w-full rounded-xl border text-left transition-colors ${rowBg} ${
                upcoming ? "opacity-80" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => !isDisabled && onSelectWeek(w.reflectionWeekStart)}
                disabled={isDisabled}
                className={`w-full text-left ${
                  isDisabled
                    ? "cursor-not-allowed"
                    : outstanding
                      ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-inherit px-3 py-2">
                  <span
                    className={`font-medium ${upcoming ? "text-stone-500 dark:text-stone-400" : "text-[var(--color-text)]"}`}
                  >
                    {w.isThisWeek
                      ? "This week"
                      : w.isNextWeek
                        ? "Next week"
                        : "Week of " + formatDateDdMmYyyy(w.reflectionWeekStart)}
                  </span>
                  <span className="text-sm text-[var(--color-text-muted)]">{weekRangeLabel}</span>
                  {done && (
                    <span className="rounded bg-green-400/90 px-1.5 py-0.5 text-xs font-medium text-green-900 dark:bg-green-600 dark:text-green-100">
                      ✓ Done
                    </span>
                  )}
                  {upcoming && (
                    <span className="rounded bg-stone-300/90 px-1.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-600 dark:text-stone-100">
                      Opens Friday 9am Perth
                      {fridayDate ? ` (${formatDateDdMmYyyy(fridayDate)})` : ""}
                    </span>
                  )}
                  {outstanding && inProgress && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        isActiveCheckInWeek
                          ? "bg-[#cfe6d6] text-[#2f5d42] dark:bg-emerald-800/60 dark:text-emerald-100"
                          : "bg-amber-400/90 text-amber-900 dark:bg-amber-600 dark:text-amber-100"
                      }`}
                    >
                      {isActiveCheckInWeek
                        ? "This check-in — tap to resume"
                        : "In progress — tap to resume"}
                    </span>
                  )}
                  {outstanding && !inProgress && (
                    <span
                      className={`text-xs font-medium ${
                        isActiveCheckInWeek
                          ? "text-[#2f5d42] dark:text-emerald-200"
                          : "text-amber-900 dark:text-amber-100"
                      }`}
                    >
                      {isActiveCheckInWeek ? "This check-in — tap to start" : "Tap to start check-in"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 px-3 py-2">
                  {days.map((day) => {
                    const isToday = day.date === todayLocal;
                    return (
                      <span
                        key={day.date}
                        className={`inline-flex min-w-[2.25rem] flex-col items-center rounded px-1.5 py-1 text-center ${
                          isToday && !upcoming
                            ? "bg-[var(--color-primary)]/25 ring-2 ring-[var(--color-primary)] dark:bg-[var(--color-primary)]/30"
                            : upcoming
                              ? "bg-stone-200/60 dark:bg-white/5"
                              : "bg-black/5 dark:bg-white/10"
                        }`}
                        aria-hidden={!isToday}
                        aria-current={isToday ? "date" : undefined}
                      >
                        <span
                          className={`text-[10px] font-medium ${
                            isToday && !upcoming
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {day.dayLabel}
                        </span>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            upcoming ? "text-stone-500" : "text-[var(--color-text)]"
                          }`}
                        >
                          {day.display.split(" ")[1]}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </button>
              {showMarkMissed ? (
                <div className="flex justify-end border-t border-inherit px-3 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkMissed?.(w.reflectionWeekStart);
                    }}
                    disabled={markingMissedWeek === w.reflectionWeekStart}
                    className="min-h-[40px] rounded-lg px-3 text-sm font-medium text-stone-600 underline-offset-2 hover:bg-black/5 hover:underline disabled:opacity-60 dark:text-stone-300 dark:hover:bg-white/5"
                  >
                    {markingMissedWeek === w.reflectionWeekStart
                      ? "Marking…"
                      : "Mark as missed"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
