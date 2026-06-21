import {
  addCalendarDays,
  computeCycleDay,
  computeCyclePhase,
  CYCLE_PHASE_META,
  isValidYyyyMmDd,
  type CycleDailyLog,
  type CyclePhase,
  type CyclePhaseInfo,
  type CycleProfile,
  daysBetween,
} from "@/lib/cycle-tracking";
import { todayPerth } from "@/lib/perth-date";

export interface CycleRingSegment {
  phase: Exclude<CyclePhase, "unknown">;
  startDay: number;
  endDay: number;
  color: string;
  label: string;
}

export interface CyclePeriodPrediction {
  headline: string;
  subline: string | null;
  daysUntilNextPeriod: number | null;
  nextPeriodStart: string | null;
  onPeriod: boolean;
  periodDay: number | null;
}

export interface CycleWeekDay {
  date: string;
  weekdayLabel: string;
  dayNum: number;
  isToday: boolean;
  hasLog: boolean;
  isPeriodDay: boolean;
  isPredictedPeriod: boolean;
  phase: CyclePhase | null;
}

export interface CycleCalendarCell {
  date: string | null;
  dayNum: number | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  isPeriodDay: boolean;
  isPredictedPeriod: boolean;
  isEstimatedMenstrual: boolean;
  hasLog: boolean;
  phase: CyclePhase | null;
  cycleDay: number | null;
}

/** Map a calendar date to cycle day + phase using repeating cycle from last logged period start. */
export function getCycleContextForDate(
  profile: Pick<CycleProfile, "lastPeriodStart" | "averageCycleLength" | "averagePeriodLength">,
  date: string
): { cycleDay: number; phase: Exclude<CyclePhase, "unknown"> } | null {
  if (!profile.lastPeriodStart || !isValidYyyyMmDd(date)) return null;

  const cycleLen = profile.averageCycleLength;
  let periodStart = profile.lastPeriodStart;

  while (addCalendarDays(periodStart, cycleLen) <= date) {
    periodStart = addCalendarDays(periodStart, cycleLen);
  }
  while (periodStart > date) {
    periodStart = addCalendarDays(periodStart, -cycleLen);
  }

  const cycleDay = daysBetween(periodStart, date) + 1;
  if (cycleDay < 1 || cycleDay > cycleLen) return null;

  const phase = computeCyclePhase(cycleDay, cycleLen, profile.averagePeriodLength);
  if (phase === "unknown") return null;
  return { cycleDay, phase };
}

export function logsByDate(logs: CycleDailyLog[]): Map<string, CycleDailyLog> {
  const map = new Map<string, CycleDailyLog>();
  for (const log of logs) map.set(log.date, log);
  return map;
}

/** Proportional ring segments from cycle length and period length. */
export function computeRingSegments(
  cycleLength: number,
  periodLength: number
): CycleRingSegment[] {
  const safeCycle = Math.max(21, Math.min(45, cycleLength));
  const safePeriod = Math.max(2, Math.min(10, periodLength));
  const ovulationDay = Math.max(safePeriod + 2, safeCycle - 14);
  const ovStart = Math.max(safePeriod + 1, ovulationDay - 1);
  const ovEnd = Math.min(safeCycle, ovulationDay + 1);

  const raw: { phase: Exclude<CyclePhase, "unknown">; start: number; end: number }[] = [
    { phase: "menstrual", start: 1, end: safePeriod },
    { phase: "follicular", start: safePeriod + 1, end: ovStart - 1 },
    { phase: "ovulation", start: ovStart, end: ovEnd },
    { phase: "luteal", start: ovEnd + 1, end: safeCycle },
  ];

  return raw
    .filter((s) => s.end >= s.start)
    .map((s) => ({
      phase: s.phase,
      startDay: s.start,
      endDay: s.end,
      color: CYCLE_PHASE_META[s.phase].color,
      label: CYCLE_PHASE_META[s.phase].label,
    }));
}

export function computePeriodPrediction(
  profile: Pick<CycleProfile, "lastPeriodStart" | "averageCycleLength" | "averagePeriodLength">,
  today: string = todayPerth()
): CyclePeriodPrediction {
  const cycleDay = computeCycleDay(profile.lastPeriodStart, today);
  if (!profile.lastPeriodStart || cycleDay == null) {
    return {
      headline: "Log your period start",
      subline: "We will estimate your next cycle from there.",
      daysUntilNextPeriod: null,
      nextPeriodStart: null,
      onPeriod: false,
      periodDay: null,
    };
  }

  const nextPeriodStart = addCalendarDays(profile.lastPeriodStart, profile.averageCycleLength);
  const daysUntil = daysBetween(today, nextPeriodStart);
  const onPeriod = cycleDay <= profile.averagePeriodLength;

  if (onPeriod) {
    return {
      headline: `Period · day ${cycleDay}`,
      subline: null,
      daysUntilNextPeriod: Math.max(0, daysUntil),
      nextPeriodStart,
      onPeriod: true,
      periodDay: cycleDay,
    };
  }

  if (daysUntil > 1) {
    return {
      headline: `Next period might start in ${daysUntil} days`,
      subline: `Estimated ${nextPeriodStart}`,
      daysUntilNextPeriod: daysUntil,
      nextPeriodStart,
      onPeriod: false,
      periodDay: null,
    };
  }

  if (daysUntil === 1) {
    return {
      headline: "Next period might start tomorrow",
      subline: `Estimated ${nextPeriodStart}`,
      daysUntilNextPeriod: 1,
      nextPeriodStart,
      onPeriod: false,
      periodDay: null,
    };
  }

  return {
    headline: "Period may start soon",
    subline: "Your cycle estimate suggests your period is due.",
    daysUntilNextPeriod: 0,
    nextPeriodStart,
    onPeriod: false,
    periodDay: null,
  };
}

export function getWeekContaining(date: string): string[] {
  const d = new Date(date + "T12:00:00");
  const weekday = d.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addCalendarDays(date, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(monday, i));
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function buildWeekStrip(
  profile: CycleProfile,
  logs: Map<string, CycleDailyLog>,
  today: string = todayPerth()
): CycleWeekDay[] {
  const dates = getWeekContaining(today);
  const predictedStart = profile.lastPeriodStart
    ? addCalendarDays(profile.lastPeriodStart, profile.averageCycleLength)
    : null;
  const predictedEnd =
    predictedStart != null
      ? addCalendarDays(predictedStart, profile.averagePeriodLength - 1)
      : null;

  return dates.map((date, index) => {
    const log = logs.get(date);
    const cycleDay = profile.lastPeriodStart ? computeCycleDay(profile.lastPeriodStart, date) : null;
    const phase =
      cycleDay != null
        ? computeCyclePhase(cycleDay, profile.averageCycleLength, profile.averagePeriodLength)
        : null;
    const isPredictedPeriod =
      predictedStart != null &&
      predictedEnd != null &&
      date >= predictedStart &&
      date <= predictedEnd &&
      !log?.isPeriodDay;

    return {
      date,
      weekdayLabel: WEEKDAY_SHORT[index],
      dayNum: Number(date.slice(8, 10)),
      isToday: date === today,
      hasLog: Boolean(log && (log.mood != null || log.energy != null || (log.symptoms?.length ?? 0) > 0)),
      isPeriodDay: Boolean(log?.isPeriodDay),
      isPredictedPeriod,
      phase: phase === "unknown" ? null : phase,
    };
  });
}

export function buildCalendarGrid(
  year: number,
  month: number,
  profile: CycleProfile,
  logs: Map<string, CycleDailyLog>,
  today: string = todayPerth()
): CycleCalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const daysInMonth = last.getDate();
  const startPad = (first.getDay() + 6) % 7;

  const predictedStart = profile.lastPeriodStart
    ? addCalendarDays(profile.lastPeriodStart, profile.averageCycleLength)
    : null;
  const predictedEnd =
    predictedStart != null
      ? addCalendarDays(predictedStart, profile.averagePeriodLength - 1)
      : null;

  const cells: CycleCalendarCell[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({
      date: null,
      dayNum: null,
      isToday: false,
      isCurrentMonth: false,
      isPeriodDay: false,
      isPredictedPeriod: false,
      isEstimatedMenstrual: false,
      hasLog: false,
      phase: null,
      cycleDay: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const log = logs.get(date);
    const ctx = getCycleContextForDate(profile, date);
    const isLoggedPeriod = Boolean(log?.isPeriodDay);
    const isEstimatedMenstrual =
      !isLoggedPeriod && ctx?.phase === "menstrual" && date >= today;
    const isPredictedPeriod =
      isEstimatedMenstrual ||
      (predictedStart != null &&
        predictedEnd != null &&
        date >= predictedStart &&
        date <= predictedEnd &&
        !isLoggedPeriod);

    cells.push({
      date,
      dayNum: day,
      isToday: date === today,
      isCurrentMonth: true,
      isPeriodDay: isLoggedPeriod,
      isPredictedPeriod,
      isEstimatedMenstrual,
      hasLog: Boolean(log && (log.mood != null || log.energy != null || (log.symptoms?.length ?? 0) > 0)),
      phase: ctx?.phase ?? null,
      cycleDay: ctx?.cycleDay ?? null,
    });
  }

  return cells;
}

export function formatTodayHeading(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function phaseBadgeLabel(phaseInfo: CyclePhaseInfo): string {
  if (phaseInfo.phase === "unknown") return "Set up your cycle";
  return `${phaseInfo.label} phase`;
}
