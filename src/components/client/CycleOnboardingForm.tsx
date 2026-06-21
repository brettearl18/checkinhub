"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CYCLE_HISTORY_6_MONTHS_DAYS,
  CYCLE_PHASE_META,
  computeStatsFromPeriodHistory,
  historyWindowLabel,
  normalizePeriodHistory,
  periodLengthFromRange,
  type CyclePeriodRecord,
  type CycleRegularity,
  type CycleSetupInput,
} from "@/lib/cycle-tracking";
import { todayPerth } from "@/lib/perth-date";
import { formatMonthYearDisplay } from "@/lib/format-date";

const emptyPastPeriod = (): CyclePeriodRecord => ({ start: "", end: "" });

function pastPeriodRowLabel(
  start: string,
  displayIndex: number,
  duplicateIndex: number,
  totalWithSameMonth: number
): string {
  const monthYear = formatMonthYearDisplay(start);
  if (!monthYear) {
    return displayIndex === 0 ? "Previous period" : "Earlier period";
  }
  if (totalWithSameMonth > 1) return `${monthYear} (${duplicateIndex + 1})`;
  return monthYear;
}

export type CycleOnboardingInitialValues = {
  lastPeriodStart?: string;
  lastPeriodEnd?: string;
  pastPeriods?: CyclePeriodRecord[];
  averageCycleLength?: number;
  trackSexualActivity?: boolean;
  cycleRegularity?: CycleRegularity | null;
  onHormonalBirthControl?: boolean | null;
};

function birthControlFromProfile(value: boolean | null | undefined): "" | "yes" | "no" | "skip" {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "skip";
}

export function CycleOnboardingForm({
  saving,
  error,
  onSubmit,
  initialValues,
  onCancel,
  variant = "setup",
  historyMaxDays = CYCLE_HISTORY_6_MONTHS_DAYS,
  seedPastPeriodRows = false,
}: {
  saving: boolean;
  error: string | null;
  onSubmit: (data: CycleSetupInput) => void;
  initialValues?: CycleOnboardingInitialValues;
  onCancel?: () => void;
  variant?: "setup" | "redo";
  historyMaxDays?: number;
  seedPastPeriodRows?: boolean;
}) {
  const today = todayPerth();
  const historyLabel = historyWindowLabel(historyMaxDays);
  const historyMin = useMemo(() => {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - historyMaxDays);
    return d.toISOString().slice(0, 10);
  }, [today, historyMaxDays]);

  const [lastPeriodStart, setLastPeriodStart] = useState(initialValues?.lastPeriodStart ?? "");
  const [lastPeriodEnd, setLastPeriodEnd] = useState(initialValues?.lastPeriodEnd ?? "");
  const [pastPeriods, setPastPeriods] = useState<CyclePeriodRecord[]>(() => {
    if (initialValues?.pastPeriods?.length) return initialValues.pastPeriods;
    if (seedPastPeriodRows) return [emptyPastPeriod(), emptyPastPeriod()];
    return [];
  });
  const [showPastPeriods, setShowPastPeriods] = useState(
    (initialValues?.pastPeriods?.length ?? 0) > 0 || seedPastPeriodRows
  );
  const [averageCycleLength, setAverageCycleLength] = useState(
    String(initialValues?.averageCycleLength ?? 28)
  );
  const [trackSexualActivity, setTrackSexualActivity] = useState(
    Boolean(initialValues?.trackSexualActivity)
  );
  const [cycleRegularity, setCycleRegularity] = useState<CycleRegularity | "">(
    initialValues?.cycleRegularity ?? ""
  );
  const [birthControl, setBirthControl] = useState<"" | "yes" | "no" | "skip">(
    birthControlFromProfile(initialValues?.onHormonalBirthControl)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const latestPeriodDays = useMemo(() => {
    if (!lastPeriodStart || !lastPeriodEnd || lastPeriodEnd < lastPeriodStart) return null;
    return periodLengthFromRange(lastPeriodStart, lastPeriodEnd);
  }, [lastPeriodStart, lastPeriodEnd]);

  const computedHistory = useMemo(() => {
    if (!lastPeriodStart || !lastPeriodEnd) return null;
    const filledPast = pastPeriods.filter((p) => p.start && p.end);
    const history = normalizePeriodHistory([
      { start: lastPeriodStart, end: lastPeriodEnd },
      ...filledPast,
    ]);
    if (history.length < 2) return null;
    return computeStatsFromPeriodHistory(history);
  }, [lastPeriodStart, lastPeriodEnd, pastPeriods]);

  const pastPeriodsForDisplay = useMemo(() => {
    const monthCounts = new Map<string, number>();
    for (const period of pastPeriods) {
      const key = formatMonthYearDisplay(period.start);
      if (key) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }

    const monthSeen = new Map<string, number>();

    return pastPeriods
      .map((period, index) => ({ period, index }))
      .sort((a, b) => {
        if (!a.period.start && !b.period.start) return a.index - b.index;
        if (!a.period.start) return 1;
        if (!b.period.start) return -1;
        return b.period.start.localeCompare(a.period.start);
      })
      .map(({ period, index }, displayIndex) => {
        const monthYear = formatMonthYearDisplay(period.start);
        const duplicateIndex = monthYear ? monthSeen.get(monthYear) ?? 0 : 0;
        if (monthYear) monthSeen.set(monthYear, duplicateIndex + 1);
        const totalWithSameMonth = monthYear ? monthCounts.get(monthYear) ?? 1 : 1;
        return {
          period,
          index,
          label: pastPeriodRowLabel(period.start, displayIndex, duplicateIndex, totalWithSameMonth),
        };
      });
  }, [pastPeriods]);

  const needsManualCycleLength = !computedHistory;

  const updatePastPeriod = (index: number, field: "start" | "end", value: string) => {
    setPastPeriods((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "start" && next.end && value > next.end) next.end = value;
        return next;
      })
    );
  };

  const addPastPeriod = () => {
    setShowPastPeriods(true);
    setPastPeriods((rows) => [...rows, emptyPastPeriod()]);
  };

  const removePastPeriod = (index: number) => {
    setPastPeriods((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!lastPeriodStart || !lastPeriodEnd) {
      setLocalError("Please enter both the first and last day of your last period.");
      return;
    }
    if (needsManualCycleLength) {
      const cycleLen = Number(averageCycleLength);
      if (!Number.isFinite(cycleLen) || cycleLen < 21 || cycleLen > 45) {
        setLocalError("Average cycle length must be between 21 and 45 days.");
        return;
      }
    }

    const filledPast = pastPeriods.filter((p) => p.start || p.end);
    for (const period of filledPast) {
      if (!period.start || !period.end) {
        setLocalError("Each earlier period needs both a start and end date, or remove the row.");
        return;
      }
    }

    onSubmit({
      lastPeriodStart,
      lastPeriodEnd,
      pastPeriods: filledPast.filter(
        (p) => !(p.start === lastPeriodStart && p.end === lastPeriodEnd)
      ),
      averageCycleLength: needsManualCycleLength ? Math.round(Number(averageCycleLength)) : undefined,
      trackSexualActivity,
      cycleRegularity: cycleRegularity || null,
      onHormonalBirthControl:
        birthControl === "yes" ? true : birthControl === "no" ? false : null,
    });
  };

  return (
    <Card className="border-[var(--color-primary-muted)] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            {variant === "redo" ? "Update cycle setup" : "Set up your cycle"}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {variant === "redo"
              ? "Change your period dates or preferences. Your daily logs are kept."
              : "Tell us about your recent periods so we can estimate phases and guides. Wellbeing tracking only — not medical advice."}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Most recent period</h3>
          <Input
            label="First day"
            type="date"
            required
            min={historyMin}
            max={today}
            value={lastPeriodStart}
            onChange={(e) => {
              setLastPeriodStart(e.target.value);
              if (lastPeriodEnd && e.target.value > lastPeriodEnd) {
                setLastPeriodEnd(e.target.value);
              }
            }}
          />
          <Input
            label="Last day"
            type="date"
            required
            min={lastPeriodStart || historyMin}
            max={today}
            value={lastPeriodEnd}
            onChange={(e) => setLastPeriodEnd(e.target.value)}
          />
          {latestPeriodDays != null && (
            <p className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              That period was <strong className="text-[var(--color-text)]">{latestPeriodDays} days</strong>.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-[var(--color-border)] pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Earlier periods (optional)</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Add past periods from the last {historyLabel} if you remember them — start and end dates only.
                Skip this section if you don&apos;t have earlier dates.
              </p>
            </div>
            {!showPastPeriods && (
              <Button type="button" variant="secondary" onClick={addPastPeriod}>
                Add
              </Button>
            )}
          </div>

          {showPastPeriods && (
            <div className="space-y-4">
              {pastPeriodsForDisplay.map(({ period, index, label }) => (
                <div
                  key={index}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--color-text)]">{label}</p>
                    <button
                      type="button"
                      onClick={() => removePastPeriod(index)}
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="First day"
                      type="date"
                      min={historyMin}
                      max={today}
                      value={period.start}
                      onChange={(e) => updatePastPeriod(index, "start", e.target.value)}
                    />
                    <Input
                      label="Last day"
                      type="date"
                      min={period.start || historyMin}
                      max={today}
                      value={period.end}
                      onChange={(e) => updatePastPeriod(index, "end", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              {pastPeriods.length < 7 && (
                <Button type="button" variant="secondary" onClick={addPastPeriod}>
                  Add another period
                </Button>
              )}
            </div>
          )}
        </div>

        {computedHistory && (
          <div className="rounded-xl border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <p className="font-medium text-[var(--color-text)]">Calculated from your history</p>
            <ul className="mt-2 space-y-1">
              <li>
                Average cycle · <strong className="text-[var(--color-text)]">{computedHistory.averageCycleLength} days</strong>
                {computedHistory.minCycleLength !== computedHistory.maxCycleLength && (
                  <span>
                    {" "}
                    (range {computedHistory.minCycleLength}–{computedHistory.maxCycleLength})
                  </span>
                )}
              </li>
              <li>
                Average period ·{" "}
                <strong className="text-[var(--color-text)]">{computedHistory.averagePeriodLength} days</strong>
              </li>
            </ul>
          </div>
        )}

        {needsManualCycleLength && (
          <div>
            <Input
              label="On average, how long is your cycle? (days)"
              type="number"
              min={21}
              max={45}
              required
              value={averageCycleLength}
              onChange={(e) => setAverageCycleLength(e.target.value)}
              placeholder="e.g. 28"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Add earlier periods above to skip this — we&apos;ll calculate it for you. Count from day 1 of one
              period to the day before the next starts.
            </p>
          </div>
        )}

        <div className="space-y-4 border-t border-[var(--color-border)] pt-5">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">A few optional preferences</h3>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Are your cycles fairly regular?</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "regular", label: "Regular" },
                  { id: "somewhat", label: "Somewhat" },
                  { id: "irregular", label: "Irregular" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCycleRegularity(cycleRegularity === opt.id ? "" : opt.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    cycleRegularity === opt.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Hormonal birth control?</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "yes", label: "Yes" },
                  { id: "no", label: "No" },
                  { id: "skip", label: "Prefer not to say" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBirthControl(birthControl === opt.id ? "" : opt.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    birthControl === opt.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={trackSexualActivity}
              onChange={(e) => setTrackSexualActivity(e.target.checked)}
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text)]">Log sexual activity in my daily tracker</span>
              <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                Only if you&apos;re trying to fall pregnant. Never shared with your coach.
              </span>
            </span>
          </label>
        </div>

        {(localError || error) && (
          <p className="text-sm text-[var(--color-error)]">{localError || error}</p>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving…" : variant === "redo" ? "Save setup" : "Start tracking"}
        </Button>
      </form>

      <div className="mt-8 border-t border-[var(--color-border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">What you&apos;ll see after setup</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          General wellbeing guides by phase — estimates only, not medical advice.
        </p>
        <ul className="mt-4 space-y-3">
          {(Object.keys(CYCLE_PHASE_META) as Array<keyof typeof CYCLE_PHASE_META>).map((key) => {
            const meta = CYCLE_PHASE_META[key];
            return (
              <li key={key} className="rounded-lg bg-[var(--color-bg)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--color-text)]">{meta.label}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{meta.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
