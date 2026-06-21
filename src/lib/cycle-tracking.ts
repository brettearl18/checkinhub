import { todayPerth } from "@/lib/perth-date";

export const CYCLE_PROFILES_COLLECTION = "cycleProfiles";
export const CYCLE_DAILY_LOGS_COLLECTION = "cycleDailyLogs";

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal" | "unknown";

export type PeriodFlow = "none" | "light" | "medium" | "heavy";

export type CycleRegularity = "regular" | "somewhat" | "irregular";

export interface CyclePeriodRecord {
  start: string;
  end: string;
}

export interface CycleProfile {
  clientId: string;
  trackingEnabled: boolean;
  shareWithCoach: boolean;
  shareNotesWithCoach: boolean;
  averageCycleLength: number;
  averagePeriodLength: number;
  lastPeriodStart: string | null;
  lastPeriodEnd: string | null;
  periodHistory: CyclePeriodRecord[];
  trackSexualActivity: boolean;
  cycleRegularity: CycleRegularity | null;
  onHormonalBirthControl: boolean | null;
  computedCycleLengthMin: number | null;
  computedCycleLengthMax: number | null;
  setupCompleted: boolean;
  optedInAt?: string | null;
  setupCompletedAt?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CycleDailyLog {
  clientId: string;
  date: string;
  mood?: number | null;
  energy?: number | null;
  symptoms?: string[];
  feelings?: string[];
  note?: string | null;
  isPeriodDay?: boolean;
  periodFlow?: PeriodFlow | null;
  sexualActivity?: boolean | null;
  sexualActivityProtected?: boolean | null;
  updatedAt?: Date;
}

export interface CyclePhaseInfo {
  phase: CyclePhase;
  cycleDay: number | null;
  label: string;
  description: string;
  confidence: "low" | "medium" | "high";
  estimated: boolean;
}

export const CYCLE_SYMPTOM_OPTIONS = [
  { id: "cramps", label: "Cramps" },
  { id: "bloating", label: "Bloating" },
  { id: "headache", label: "Headache" },
  { id: "breast_tenderness", label: "Breast tenderness" },
  { id: "back_pain", label: "Back pain" },
  { id: "fatigue", label: "Fatigue" },
  { id: "nausea", label: "Nausea" },
  { id: "acne", label: "Acne" },
] as const;

export const CYCLE_FEELING_OPTIONS = [
  { id: "calm", label: "Calm" },
  { id: "anxious", label: "Anxious" },
  { id: "irritable", label: "Irritable" },
  { id: "motivated", label: "Motivated" },
  { id: "low_mood", label: "Low mood" },
  { id: "energised", label: "Energised" },
  { id: "brain_fog", label: "Brain fog" },
  { id: "social", label: "Social" },
] as const;

export const CYCLE_PHASE_META: Record<
  Exclude<CyclePhase, "unknown">,
  { label: string; description: string; color: string; calendarBg: string }
> = {
  menstrual: {
    label: "Menstrual",
    description: "Bleeding phase — rest and recovery may feel important.",
    color: "#c9786a",
    calendarBg: "rgba(201, 120, 106, 0.28)",
  },
  follicular: {
    label: "Follicular",
    description: "Energy often rises after your period.",
    color: "#d9a820",
    calendarBg: "rgba(255, 210, 80, 0.38)",
  },
  ovulation: {
    label: "Ovulation",
    description: "Mid-cycle — some people feel their strongest here.",
    color: "#7eb8a4",
    calendarBg: "rgba(126, 184, 164, 0.22)",
  },
  luteal: {
    label: "Luteal",
    description: "Pre-period phase — mood and energy can shift.",
    color: "#8f7ec8",
    calendarBg: "rgba(143, 126, 200, 0.3)",
  },
};

export function isValidYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T12:00:00");
  const b = new Date(end + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function defaultCycleProfile(clientId: string): CycleProfile {
  return {
    clientId,
    trackingEnabled: false,
    shareWithCoach: false,
    shareNotesWithCoach: false,
    averageCycleLength: 28,
    averagePeriodLength: 5,
    lastPeriodStart: null,
    lastPeriodEnd: null,
    periodHistory: [],
    trackSexualActivity: false,
    cycleRegularity: null,
    onHormonalBirthControl: null,
    computedCycleLengthMin: null,
    computedCycleLengthMax: null,
    setupCompleted: false,
  };
}

export function needsCycleSetup(profile: Pick<CycleProfile, "trackingEnabled" | "setupCompleted">): boolean {
  return profile.trackingEnabled && !profile.setupCompleted;
}

export function periodLengthFromRange(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

export function eachDateInclusive(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

export function periodsOverlap(a: CyclePeriodRecord, b: CyclePeriodRecord): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function parsePeriodRecords(value: unknown): CyclePeriodRecord[] {
  if (!Array.isArray(value)) return [];
  const records: CyclePeriodRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const start = typeof (item as CyclePeriodRecord).start === "string" ? (item as CyclePeriodRecord).start.trim() : "";
    const end = typeof (item as CyclePeriodRecord).end === "string" ? (item as CyclePeriodRecord).end.trim() : "";
    if (!start || !end) continue;
    records.push({ start, end });
  }
  return records;
}

export function normalizePeriodHistory(periods: CyclePeriodRecord[]): CyclePeriodRecord[] {
  const unique = new Map<string, CyclePeriodRecord>();
  for (const period of periods) {
    unique.set(`${period.start}|${period.end}`, period);
  }
  return [...unique.values()].sort((a, b) => b.start.localeCompare(a.start));
}

export function computeStatsFromPeriodHistory(periods: CyclePeriodRecord[]): {
  averageCycleLength: number;
  averagePeriodLength: number;
  minCycleLength: number;
  maxCycleLength: number;
} | null {
  if (periods.length === 0) return null;

  const periodLengths = periods.map((p) => periodLengthFromRange(p.start, p.end));
  const averagePeriodLength = Math.round(
    periodLengths.reduce((sum, n) => sum + n, 0) / periodLengths.length
  );

  const sortedByStart = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const cycleLengths: number[] = [];
  for (let i = 1; i < sortedByStart.length; i++) {
    const gap = daysBetween(sortedByStart[i - 1].start, sortedByStart[i].start);
    if (gap >= 21 && gap <= 45) cycleLengths.push(gap);
  }

  if (cycleLengths.length === 0) {
    return {
      averageCycleLength: 28,
      averagePeriodLength,
      minCycleLength: 21,
      maxCycleLength: 45,
    };
  }

  const averageCycleLength = Math.round(
    cycleLengths.reduce((sum, n) => sum + n, 0) / cycleLengths.length
  );
  return {
    averageCycleLength,
    averagePeriodLength,
    minCycleLength: Math.min(...cycleLengths),
    maxCycleLength: Math.max(...cycleLengths),
  };
}

export function parseCycleRegularity(value: unknown): CycleRegularity | null {
  if (value === "regular" || value === "somewhat" || value === "irregular") return value;
  return null;
}

export interface CycleSetupInput {
  lastPeriodStart: string;
  lastPeriodEnd: string;
  pastPeriods?: CyclePeriodRecord[];
  averageCycleLength?: number;
  trackSexualActivity?: boolean;
  cycleRegularity?: CycleRegularity | null;
  onHormonalBirthControl?: boolean | null;
}

export function validateCycleSetup(
  input: CycleSetupInput,
  today: string = todayPerth(),
  historyMaxDays = 183
): {
  ok: true;
  periodHistory: CyclePeriodRecord[];
  averageCycleLength: number;
  averagePeriodLength: number;
  computedCycleLengthMin: number | null;
  computedCycleLengthMax: number | null;
} | { ok: false; error: string } {
  const { lastPeriodStart, lastPeriodEnd } = input;
  if (!isValidYyyyMmDd(lastPeriodStart) || !isValidYyyyMmDd(lastPeriodEnd)) {
    return { ok: false, error: "Dates must be valid YYYY-MM-DD values" };
  }
  if (lastPeriodStart > today || lastPeriodEnd > today) {
    return { ok: false, error: "Period dates cannot be in the future" };
  }
  if (lastPeriodEnd < lastPeriodStart) {
    return { ok: false, error: "Last day of period must be on or after the first day" };
  }

  const historyCutoff = addCalendarDays(today, -historyMaxDays);
  if (lastPeriodStart < historyCutoff) {
    return { ok: false, error: "Most recent period must be within the last 6 months" };
  }

  const latestPeriodLength = periodLengthFromRange(lastPeriodStart, lastPeriodEnd);
  if (latestPeriodLength < 2 || latestPeriodLength > 14) {
    return { ok: false, error: "Period length must be 2–14 days" };
  }

  const pastPeriods = parsePeriodRecords(input.pastPeriods);
  for (const period of pastPeriods) {
    if (!isValidYyyyMmDd(period.start) || !isValidYyyyMmDd(period.end)) {
      return { ok: false, error: "Past period dates must be valid" };
    }
    if (period.start > today || period.end > today) {
      return { ok: false, error: "Past period dates cannot be in the future" };
    }
    if (period.end < period.start) {
      return { ok: false, error: "Each past period needs a valid start and end date" };
    }
    if (period.start < historyCutoff) {
      return { ok: false, error: "Past periods must be within the last 6 months" };
    }
    const len = periodLengthFromRange(period.start, period.end);
    if (len < 2 || len > 14) {
      return { ok: false, error: "Each period must be 2–14 days long" };
    }
  }

  const periodHistory = normalizePeriodHistory([
    { start: lastPeriodStart, end: lastPeriodEnd },
    ...pastPeriods.filter((p) => !(p.start === lastPeriodStart && p.end === lastPeriodEnd)),
  ]);

  if (periodHistory.length > 8) {
    return { ok: false, error: "You can add up to 8 periods within 6 months" };
  }

  for (let i = 0; i < periodHistory.length; i++) {
    for (let j = i + 1; j < periodHistory.length; j++) {
      if (periodsOverlap(periodHistory[i], periodHistory[j])) {
        return { ok: false, error: "Period dates cannot overlap" };
      }
    }
  }

  const stats = computeStatsFromPeriodHistory(periodHistory);
  const cycleCount = periodHistory.length;
  let averageCycleLength: number;
  let computedCycleLengthMin: number | null = null;
  let computedCycleLengthMax: number | null = null;

  const sortedByStart = [...periodHistory].sort((a, b) => a.start.localeCompare(b.start));
  const measuredCycleLengths: number[] = [];
  for (let i = 1; i < sortedByStart.length; i++) {
    const gap = daysBetween(sortedByStart[i - 1].start, sortedByStart[i].start);
    if (gap >= 21 && gap <= 45) measuredCycleLengths.push(gap);
  }

  if (cycleCount >= 2) {
    if (measuredCycleLengths.length === 0) {
      const manual = Number(input.averageCycleLength ?? NaN);
      if (!Number.isFinite(manual) || manual < 21 || manual > 45) {
        return {
          ok: false,
          error:
            "Your period dates are too far apart to calculate a cycle length — check your dates or enter an average manually",
        };
      }
      averageCycleLength = Math.round(manual);
    } else {
      averageCycleLength = stats!.averageCycleLength;
      computedCycleLengthMin = stats!.minCycleLength;
      computedCycleLengthMax = stats!.maxCycleLength;
    }
  } else {
    const manual = Number(input.averageCycleLength ?? 28);
    if (!Number.isFinite(manual) || manual < 21 || manual > 45) {
      return { ok: false, error: "Average cycle length must be 21–45 days" };
    }
    averageCycleLength = Math.round(manual);
  }

  const averagePeriodLength = stats?.averagePeriodLength ?? latestPeriodLength;

  return {
    ok: true,
    periodHistory,
    averageCycleLength,
    averagePeriodLength,
    computedCycleLengthMin,
    computedCycleLengthMax,
  };
}

/** @deprecated use validateCycleSetup */
export function validateCycleSetupInput(
  lastPeriodStart: string,
  lastPeriodEnd: string,
  averageCycleLength: number,
  today: string = todayPerth()
): { ok: true; averagePeriodLength: number } | { ok: false; error: string } {
  const result = validateCycleSetup({ lastPeriodStart, lastPeriodEnd, averageCycleLength }, today);
  if (!result.ok) return result;
  return { ok: true, averagePeriodLength: result.averagePeriodLength };
}

export function stripCoachVisibleCycleLog(log: CycleDailyLog): Omit<CycleDailyLog, "sexualActivity" | "sexualActivityProtected"> {
  const { sexualActivity: _a, sexualActivityProtected: _b, ...rest } = log;
  return rest;
}

export function computeCycleDay(lastPeriodStart: string | null, today: string): number | null {
  if (!lastPeriodStart || !isValidYyyyMmDd(lastPeriodStart)) return null;
  const diff = daysBetween(lastPeriodStart, today);
  if (diff < 0) return null;
  return diff + 1;
}

export function computeCyclePhase(
  cycleDay: number | null,
  cycleLength: number,
  periodLength: number
): CyclePhase {
  if (cycleDay == null || cycleDay < 1) return "unknown";
  const safeCycle = Math.max(21, Math.min(45, cycleLength));
  const safePeriod = Math.max(2, Math.min(14, periodLength));
  if (cycleDay <= safePeriod) return "menstrual";
  const ovulationDay = Math.max(safePeriod + 2, safeCycle - 14);
  if (cycleDay < ovulationDay - 1) return "follicular";
  if (cycleDay <= ovulationDay + 1) return "ovulation";
  return "luteal";
}

export function computePhaseInfo(
  profile: Pick<
    CycleProfile,
    | "lastPeriodStart"
    | "averageCycleLength"
    | "averagePeriodLength"
    | "setupCompleted"
    | "periodHistory"
    | "cycleRegularity"
    | "onHormonalBirthControl"
  >,
  today: string = todayPerth()
): CyclePhaseInfo {
  const cycleDay = computeCycleDay(profile.lastPeriodStart, today);
  const phase = computeCyclePhase(cycleDay, profile.averageCycleLength, profile.averagePeriodLength);
  const historyCount = profile.periodHistory?.length ?? 0;
  let confidence: CyclePhaseInfo["confidence"] = "low";
  if (profile.setupCompleted) {
    if (historyCount >= 3 && profile.cycleRegularity !== "irregular") confidence = "high";
    else confidence = "medium";
  } else if (profile.lastPeriodStart) {
    confidence = "medium";
  }

  if (phase === "unknown" || cycleDay == null) {
    return {
      phase: "unknown",
      cycleDay: null,
      label: "Log your period",
      description: "Log when your period started to see an estimated cycle phase.",
      confidence: "low",
      estimated: true,
    };
  }

  const meta = CYCLE_PHASE_META[phase];
  const overdue =
    profile.lastPeriodStart &&
    cycleDay > profile.averageCycleLength + 2;

  let description = overdue
    ? "Your period may be due soon — this is an estimate only."
    : meta.description;
  if (profile.onHormonalBirthControl === true) {
    description = `${description} Hormonal birth control can change typical cycle patterns.`;
  } else if (profile.cycleRegularity === "irregular") {
    description = `${description} Your cycles vary — treat this as a rough guide only.`;
  }

  return {
    phase,
    cycleDay,
    label: meta.label,
    description,
    confidence,
    estimated: true,
  };
}

export function clampRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 5) return null;
  return n;
}

export function sanitizeStringList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return [...new Set(value.filter((v): v is string => typeof v === "string" && set.has(v)))];
}

export function sanitizePeriodFlow(value: unknown): PeriodFlow | null {
  if (value === "none" || value === "light" || value === "medium" || value === "heavy") return value;
  return null;
}
