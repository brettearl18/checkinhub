import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";

export interface TimelineCheckIn {
  id: string;
  formTitle: string;
  score: number;
  completedAt: string | null;
  responseId: string | null;
}

export interface TimelineMeasurementSnapshot {
  id: string;
  date: string;
  bodyWeight: number | null;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  isBaseline: boolean;
}

export interface TimelineMeasurementDelta {
  bodyWeight: number | null;
  waist: number | null;
  hips: number | null;
  chest: number | null;
}

export interface TimelinePhoto {
  id: string;
  imageUrl: string;
  imageType: string | null;
  uploadedAt: string | null;
}

export interface TimelineHabitSummary {
  met: number;
  logged: number;
  pct: number;
}

export interface TimelineWeek {
  weekStart: string;
  weekLabel: string;
  weekNumber: number;
  checkIn: TimelineCheckIn | null;
  scoreWeekDelta: number | null;
  measurement: TimelineMeasurementSnapshot | null;
  measurementDelta: TimelineMeasurementDelta | null;
  measurementWeekDelta: TimelineMeasurementDelta | null;
  habits: TimelineHabitSummary | null;
  photos: TimelinePhoto[];
}

export interface TimelineCheckInInput {
  id: string;
  formTitle?: string;
  score: number | null;
  completedAt: string | null;
  reflectionWeekStart?: string | null;
  responseId?: string | null;
}

export interface TimelineWeekScoreFallback {
  score: number;
  responseId?: string | null;
}

export interface TimelineMeasurementInput {
  id: string;
  date: string | null;
  bodyWeight?: number | null;
  measurements?: Record<string, number>;
  isBaseline?: boolean;
}

export interface TimelinePhotoInput {
  id: string;
  imageUrl: string;
  imageType?: string | null;
  uploadedAt?: string | null;
}

export interface TimelineHabitsInput {
  habitIds: string[];
  byDate: Record<string, Record<string, "met" | "missed">>;
}

/** Monday (YYYY-MM-DD) for the calendar week containing `dateStr`. */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return toLocalDateString(d);
}

function isoDateFromTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalDateString(d);
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function measurementSnapshot(m: TimelineMeasurementInput): TimelineMeasurementSnapshot | null {
  if (!m.date) return null;
  return {
    id: m.id,
    date: m.date,
    bodyWeight: numeric(m.bodyWeight),
    waist: numeric(m.measurements?.waist),
    hips: numeric(m.measurements?.hips),
    chest: numeric(m.measurements?.chest),
    isBaseline: m.isBaseline === true,
  };
}

function weekLabel(weekStart: string, weekNumber: number): string {
  return `Week of ${formatDateDisplay(weekStart)} · Wk ${weekNumber}`;
}

function compareWeekDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

function deltaSnapshot(
  current: TimelineMeasurementSnapshot,
  prior: TimelineMeasurementSnapshot
): TimelineMeasurementDelta {
  const diff = (c: number | null, p: number | null) =>
    c != null && p != null ? c - p : null;
  return {
    bodyWeight: diff(current.bodyWeight, prior.bodyWeight),
    waist: diff(current.waist, prior.waist),
    hips: diff(current.hips, prior.hips),
    chest: diff(current.chest, prior.chest),
  };
}

function deltaFromBaseline(
  current: TimelineMeasurementSnapshot,
  baseline: TimelineMeasurementSnapshot
): TimelineMeasurementDelta | null {
  const d = deltaSnapshot(current, baseline);
  if (
    d.bodyWeight == null &&
    d.waist == null &&
    d.hips == null &&
    d.chest == null
  ) {
    return null;
  }
  return d;
}

function hasAnyDelta(d: TimelineMeasurementDelta | null): boolean {
  if (!d) return false;
  return (
    (d.bodyWeight != null && d.bodyWeight !== 0) ||
    (d.waist != null && d.waist !== 0) ||
    (d.hips != null && d.hips !== 0) ||
    (d.chest != null && d.chest !== 0)
  );
}

export function computeWeekHabitCompliance(
  weekStart: string,
  habits: TimelineHabitsInput
): TimelineHabitSummary | null {
  if (habits.habitIds.length === 0) return null;
  const start = new Date(`${weekStart}T12:00:00`);
  let met = 0;
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = toLocalDateString(d);
    const day = habits.byDate[key];
    if (!day) continue;
    for (const habitId of habits.habitIds) {
      const status = day[habitId];
      if (status === "met") {
        met++;
        logged++;
      } else if (status === "missed") {
        logged++;
      }
    }
  }
  if (logged === 0) return null;
  return { met, logged, pct: Math.round((met / logged) * 100) };
}

/**
 * Merge check-ins, measurements, photos, and habits into week buckets (newest first).
 */
export function buildProgressTimeline(
  checkIns: TimelineCheckInInput[],
  measurements: TimelineMeasurementInput[],
  photos: TimelinePhotoInput[],
  habits?: TimelineHabitsInput,
  weekScoreFallback?: Record<string, TimelineWeekScoreFallback>
): TimelineWeek[] {
  const weeks = new Map<
    string,
    {
      checkIn: TimelineCheckIn | null;
      measurement: TimelineMeasurementSnapshot | null;
      photos: TimelinePhoto[];
    }
  >();

  function ensureWeek(weekStart: string) {
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { checkIn: null, measurement: null, photos: [] });
    }
    return weeks.get(weekStart)!;
  }

  for (const row of checkIns) {
    const weekStart =
      row.reflectionWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(row.reflectionWeekStart)
        ? row.reflectionWeekStart
        : isoDateFromTimestamp(row.completedAt)
          ? getMondayOfWeek(isoDateFromTimestamp(row.completedAt)!)
          : null;
    if (!weekStart) continue;
    const bucket = ensureWeek(weekStart);
    if (row.score == null) continue;
    const candidate: TimelineCheckIn = {
      id: row.id,
      formTitle: row.formTitle ?? "Check-in",
      score: Math.round(row.score),
      completedAt: row.completedAt,
      responseId: row.responseId ?? null,
    };
    if (!bucket.checkIn) {
      bucket.checkIn = candidate;
    } else {
      const prev = bucket.checkIn.completedAt ?? "";
      const next = candidate.completedAt ?? "";
      if (next.localeCompare(prev) > 0) bucket.checkIn = candidate;
    }
  }

  if (weekScoreFallback) {
    for (const [weekStart, fallback] of Object.entries(weekScoreFallback)) {
      const bucket = ensureWeek(weekStart);
      if (!bucket.checkIn) {
        bucket.checkIn = {
          id: `week-${weekStart}`,
          formTitle: "Check-in",
          score: Math.round(fallback.score),
          completedAt: null,
          responseId: fallback.responseId ?? null,
        };
      }
    }
  }

  for (const m of measurements) {
    const snap = measurementSnapshot(m);
    if (!snap) continue;
    const weekStart = getMondayOfWeek(snap.date);
    const bucket = ensureWeek(weekStart);
    if (!bucket.measurement || snap.date.localeCompare(bucket.measurement.date) >= 0) {
      bucket.measurement = snap;
    }
  }

  for (const p of photos) {
    const date = isoDateFromTimestamp(p.uploadedAt ?? null);
    if (!date) continue;
    const weekStart = getMondayOfWeek(date);
    const bucket = ensureWeek(weekStart);
    bucket.photos.push({
      id: p.id,
      imageUrl: p.imageUrl,
      imageType: p.imageType ?? null,
      uploadedAt: p.uploadedAt ?? null,
    });
  }

  for (const bucket of weeks.values()) {
    bucket.photos.sort((a, b) => (a.uploadedAt ?? "").localeCompare(b.uploadedAt ?? ""));
  }

  const baseline =
    measurements
      .map(measurementSnapshot)
      .filter((m): m is TimelineMeasurementSnapshot => m != null && m.isBaseline)[0] ??
    measurements
      .map(measurementSnapshot)
      .filter((m): m is TimelineMeasurementSnapshot => m != null)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ??
    null;

  const sortedAsc = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b));
  const weekNumberByStart = new Map<string, number>();
  sortedAsc.forEach(([weekStart], i) => weekNumberByStart.set(weekStart, i + 1));

  let prevMeasurement: TimelineMeasurementSnapshot | null = null;
  let prevScore: number | null = null;
  const enrichedAsc: TimelineWeek[] = [];

  for (const [weekStart, bucket] of sortedAsc) {
    let measurementDelta: TimelineMeasurementDelta | null = null;
    let measurementWeekDelta: TimelineMeasurementDelta | null = null;

    if (bucket.measurement) {
      if (baseline) measurementDelta = deltaFromBaseline(bucket.measurement, baseline);
      if (prevMeasurement) {
        measurementWeekDelta = deltaSnapshot(bucket.measurement, prevMeasurement);
        if (!hasAnyDelta(measurementWeekDelta)) measurementWeekDelta = null;
      }
      prevMeasurement = bucket.measurement;
    }

    let scoreWeekDelta: number | null = null;
    if (bucket.checkIn) {
      if (prevScore != null) scoreWeekDelta = bucket.checkIn.score - prevScore;
      prevScore = bucket.checkIn.score;
    }

    enrichedAsc.push({
      weekStart,
      weekLabel: weekLabel(weekStart, weekNumberByStart.get(weekStart) ?? 0),
      weekNumber: weekNumberByStart.get(weekStart) ?? 0,
      checkIn: bucket.checkIn,
      scoreWeekDelta,
      measurement: bucket.measurement,
      measurementDelta,
      measurementWeekDelta,
      habits: habits ? computeWeekHabitCompliance(weekStart, habits) : null,
      photos: bucket.photos,
    });
  }

  return enrichedAsc.sort((a, b) => compareWeekDesc(a.weekStart, b.weekStart));
}

export function filterTimelineByMonths(weeks: TimelineWeek[], months: number): TimelineWeek[] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  const startKey = toLocalDateString(start);
  return weeks.filter((w) => w.weekStart >= startKey);
}

export function timelineCheckInHref(checkIn: TimelineCheckIn): string {
  if (checkIn.responseId) return `/client/response/${checkIn.responseId}`;
  if (!checkIn.id.startsWith("week-")) return `/client/check-in/${checkIn.id}`;
  return "/client/history";
}

export function timelineMeasurementHref(measurement: TimelineMeasurementSnapshot): string {
  return `/client/measurements#measurement-${measurement.id}`;
}

export function getScoreBand(
  score: number,
  redMax: number,
  orangeMax: number
): "red" | "orange" | "green" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

export interface TimelineSummaryStats {
  weekCount: number;
  latestScore: number | null;
  latestWeight: number | null;
  weightChangeBaseline: number | null;
  avgScore: number | null;
  photoWeeks: number;
}

export function computeTimelineSummary(weeks: TimelineWeek[]): TimelineSummaryStats {
  const weekCount = weeks.length;
  const photoWeeks = weeks.filter((w) => w.photos.length > 0).length;
  const latest = weeks[0];
  const oldest = weeks[weeks.length - 1];

  const scores = weeks.map((w) => w.checkIn?.score).filter((s): s is number => s != null);
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  let weightChangeBaseline: number | null = null;
  if (latest?.measurement?.bodyWeight != null && oldest?.measurement?.bodyWeight != null) {
    weightChangeBaseline = latest.measurement.bodyWeight - oldest.measurement.bodyWeight;
  }

  return {
    weekCount,
    latestScore: latest?.checkIn?.score ?? null,
    latestWeight: latest?.measurement?.bodyWeight ?? null,
    weightChangeBaseline,
    avgScore,
    photoWeeks,
  };
}
