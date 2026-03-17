"use client";

/**
 * GitHub-style dot map for one habit: one cell per day, last 12 weeks.
 * Green = goal met, amber = logged but not met, grey = no log.
 */
export interface HabitDotMapProps {
  habitId: string;
  habitLabel: string;
  /** YYYY-MM-DD -> 'met' | 'missed' */
  byDate: Record<string, "met" | "missed">;
  /** Start date (Monday) YYYY-MM-DD */
  start: string;
  /** End date (today) YYYY-MM-DD */
  end: string;
}

function todayString(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function HabitDotMap({ habitId, habitLabel, byDate, start, end }: HabitDotMapProps) {
  const todayStr = todayString();
  const startDate = new Date(start + "T12:00:00Z");
  const endDate = new Date(end + "T12:00:00Z");
  const days: { date: string; dayOfWeek: number }[] = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
    days.push({ date: dateStr, dayOfWeek });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  // Group into weeks (Mon–Sun), each week has 7 cells
  const weeks: { date: string; status: "met" | "missed" | null }[][] = [];
  let week: { date: string; status: "met" | "missed" | null }[] = [];
  const padMonday = (startDate.getUTCDay() + 6) % 7; // 0 = Mon
  for (let i = 0; i < padMonday; i++) {
    week.push({ date: "", status: null });
  }
  days.forEach(({ date }) => {
    const status = byDate[date] ?? null;
    week.push({ date, status });
    if (week.length >= 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push({ date: "", status: null });
    weeks.push(week);
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
      <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{habitLabel}</p>
      <div
        className="inline-grid gap-0.5"
        style={{ gridTemplateColumns: "repeat(7, 12px)" }}
      >
        {weeks.flatMap((w, wi) =>
          w.map((cell, di) => {
            const isToday = cell.date === todayStr;
            return (
              <div
                key={`${wi}-${di}`}
                title={cell.date ? `${cell.date}${isToday ? " (today)" : ""}: ${cell.status === "met" ? "Goal met" : cell.status === "missed" ? "Logged, goal not met" : "No log"}` : ""}
                className={`h-3 w-3 rounded-sm border border-[var(--color-border)] ${isToday ? "ring-2 ring-[var(--color-primary)] ring-offset-1 ring-offset-[var(--color-bg-elevated)]" : ""}`}
                style={{
                  backgroundColor:
                    cell.status === "met"
                      ? "var(--color-success, #22c55e)"
                      : cell.status === "missed"
                        ? "var(--color-warning, #eab308)"
                        : "var(--color-bg)",
                  ...(isToday && { boxShadow: "0 0 8px 2px var(--color-primary)" }),
                }}
              />
            );
          })
        )}
      </div>
      <p className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-success,#22c55e)]" />
          Goal met
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-warning,#eab308)]" />
          Logged, not met
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)]" />
          No log
        </span>
      </p>
    </div>
  );
}
