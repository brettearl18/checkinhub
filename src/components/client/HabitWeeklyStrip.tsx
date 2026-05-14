"use client";

/**
 * Habit strip: 7 days, 1 month, or all time. One row per habit, day labels.
 * Green = goal met, amber = logged but not met, grey = no log.
 */
export type HabitStripRange = "7d" | "30d" | "all";

export interface HabitWeeklyStripProps {
  habits: { id: string; label: string }[];
  /** YYYY-MM-DD -> habitId -> 'met' | 'missed' */
  byDate: Record<string, Record<string, "met" | "missed">>;
  range: HabitStripRange;
  /** Required when range === 'all' */
  historyStart?: string;
  historyEnd?: string;
  /** When set, today and past cells are clickable (future dates stay inert). */
  onCellClick?: (habitId: string, date: string) => void;
}

function todayString(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function toDateStr(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function buildDays(range: HabitStripRange, todayStr: string, historyStart?: string, historyEnd?: string): { date: string; label: string; showLabel: boolean }[] {
  const out: { date: string; label: string; showLabel: boolean }[] = [];
  let start: Date;
  let end: Date;

  if (range === "7d") {
    // This week: Sunday–Saturday (Sunday = first day of week)
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = toDateStr(d);
      const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
      out.push({ date: dateStr, label, showLabel: true });
    }
    return out;
  }

  if (range === "30d") {
    const endD = new Date();
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = toDateStr(d);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const showLabel = i === 0 || i === 14 || i === 29 || (i > 0 && i % 7 === 0);
      out.push({ date: dateStr, label, showLabel });
    }
    return out;
  }

  // all: historyStart .. historyEnd
  if (!historyStart || !historyEnd) return out;
  start = new Date(historyStart + "T12:00:00Z");
  end = new Date(historyEnd + "T12:00:00Z");
  const d = new Date(start);
  while (d <= end) {
    const dateStr = d.toISOString().slice(0, 10);
    const isSunday = d.getUTCDay() === 0;
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    out.push({ date: dateStr, label, showLabel: isSunday });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const rangeTitles: Record<HabitStripRange, string> = {
  "7d": "This week",
  "30d": "1 month",
  all: "All time",
};

export function HabitWeeklyStrip({
  habits,
  byDate,
  range,
  historyStart,
  historyEnd,
  onCellClick,
}: HabitWeeklyStripProps) {
  const todayStr = todayString();
  const days = buildDays(range, todayStr, historyStart, historyEnd);

  const isLongStrip = range === "30d" || range === "all";
  const cellSize = isLongStrip ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{rangeTitles[range]}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: isLongStrip ? undefined : "320px" }}>
          <thead>
            <tr>
              <th className="w-24 border-b border-[var(--color-border)] pb-2 pr-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
                Habit
              </th>
              {days.map(({ date, label, showLabel }) => (
                <th
                  key={date}
                  className="border-b border-[var(--color-border)] pb-2 px-0.5 text-center text-xs font-medium text-[var(--color-text-muted)]"
                  title={date}
                >
                  {showLabel ? label : "\u200b"}
                  {date === todayStr && (
                    <span className="ml-0.5 text-[var(--color-primary)]" title="Today">
                      •
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => (
              <tr key={habit.id}>
                <td className="border-b border-[var(--color-border)] py-2 pr-2 text-[var(--color-text)]">
                  {habit.label}
                </td>
                {days.map(({ date }) => {
                  const status = byDate[date]?.[habit.id] ?? null;
                  const isToday = date === todayStr;
                  const canLog = Boolean(onCellClick) && date <= todayStr;
                  const title = `${date}${isToday ? " (today)" : ""}: ${status === "met" ? "Goal met" : status === "missed" ? "Logged, not met" : "No log"}`;
                  const cellStyle = {
                    backgroundColor:
                      status === "met"
                        ? "var(--color-success, #22c55e)"
                        : status === "missed"
                          ? "var(--color-warning, #eab308)"
                          : "var(--color-bg)",
                    ...(isToday && { boxShadow: "0 0 8px 2px var(--color-primary)" }),
                  } as const;
                  const ringClass = isToday
                    ? "ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-bg-elevated)]"
                    : "";
                  const baseClass = `mx-auto rounded border border-[var(--color-border)] ${cellSize} ${ringClass}`;

                  return (
                    <td key={date} className="border-b border-[var(--color-border)] py-2 px-0.5 text-center">
                      {canLog ? (
                        <button
                          type="button"
                          title={title}
                          aria-label={`${habit.label}, ${title}. Log or change.`}
                          className={`${baseClass} cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2`}
                          style={cellStyle}
                          onClick={() => onCellClick!(habit.id, date)}
                        />
                      ) : (
                        <div title={title} className={baseClass} style={cellStyle} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded-md bg-[var(--color-success,#22c55e)]" />
          Goal met
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded-md bg-[var(--color-warning,#eab308)]" />
          Logged, not met
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]" />
          No log
        </span>
      </p>
    </div>
  );
}
