"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import {
  computeTimelineSummary,
  filterTimelineByMonths,
  getScoreBand,
  type TimelineMeasurementDelta,
  type TimelineWeek,
} from "@/lib/progress-timeline";
import { CLIENT_TIMELINE_LINKS, type TimelineLinks } from "@/lib/timeline-links";
import {
  formatProgressImageTypeLabel,
  progressPhotoPoseLabel,
} from "@/lib/progress-comparison-photos";
import { formatDateDisplay } from "@/lib/format-date";

const BAND_STYLES = {
  red: {
    dot: "bg-red-500",
    pill: "bg-red-500/15 text-red-700 dark:text-red-400",
    ring: "#ef4444",
    border: "border-l-red-500",
    label: "Needs attention",
  },
  orange: {
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    ring: "#f59e0b",
    border: "border-l-amber-500",
    label: "Moderate",
  },
  green: {
    dot: "bg-green-500",
    pill: "bg-green-500/15 text-green-700 dark:text-green-400",
    ring: "#22c55e",
    border: "border-l-green-500",
    label: "Good",
  },
} as const;

type RangeKey = "3m" | "6m" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; months: number | null }[] = [
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "all", label: "All time", months: null },
];

function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? "+" : "";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${sign}${formatted} ${unit}`;
}

function shortPhotoLabel(imageType: string | null): string {
  const pose = progressPhotoPoseLabel(imageType);
  if (pose) return pose;
  const label = formatProgressImageTypeLabel(imageType);
  if (label.length > 12) return label.slice(0, 10) + "…";
  return label;
}

function DeltaText({
  value,
  unit,
  className = "",
}: {
  value: number;
  unit: string;
  className?: string;
}) {
  const positiveGood = unit === "kg" || unit === "cm";
  const good = positiveGood ? value < 0 : value > 0;
  return (
    <span className={good ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
      <span className={className}>{formatDelta(value, unit)}</span>
    </span>
  );
}

interface Props {
  weeks: TimelineWeek[];
  trafficLightRedMax: number;
  trafficLightOrangeMax: number;
  links?: TimelineLinks;
  audience?: "client" | "coach";
}

export function ProgressTimeline({
  weeks,
  trafficLightRedMax,
  trafficLightOrangeMax,
  links = CLIENT_TIMELINE_LINKS,
  audience = "client",
}: Props) {
  const [range, setRange] = useState<RangeKey>("6m");

  const filtered = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === range);
    if (!opt?.months) return weeks;
    return filterTimelineByMonths(weeks, opt.months);
  }, [weeks, range]);

  const summary = useMemo(() => computeTimelineSummary(filtered), [filtered]);

  if (weeks.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[var(--color-text-muted)]">
          {audience === "coach"
            ? "No timeline data for this client yet."
            : "No timeline data yet. Complete a check-in, log measurements, or upload progress photos to see your journey here."}
        </p>
        {audience === "client" && (
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
            <Link href={links.emptyCheckInHref} className="font-medium text-[var(--color-primary)] hover:underline">
              New check-in →
            </Link>
            <Link href={links.emptyMeasurementsHref} className="font-medium text-[var(--color-primary)] hover:underline">
              Log measurements →
            </Link>
            <Link href={links.emptyPhotosHref} className="font-medium text-[var(--color-primary)] hover:underline">
              Upload photos →
            </Link>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TimelineSummaryStrip summary={summary} redMax={trafficLightRedMax} orangeMax={trafficLightOrangeMax} />

      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRange(opt.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              range === opt.key
                ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                : "bg-[var(--color-bg-elevated)] text-[var(--color-text)] ring-1 ring-[var(--color-border)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No entries in this time range.</p>
      ) : (
        <ol className="relative space-y-0 border-l-2 border-[var(--color-border)] pl-5">
          {filtered.map((week, index) => (
            <TimelineWeekCard
              key={week.weekStart}
              week={week}
              isLatest={index === 0}
              trafficLightRedMax={trafficLightRedMax}
              trafficLightOrangeMax={trafficLightOrangeMax}
              links={links}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineSummaryStrip({
  summary,
  redMax,
  orangeMax,
}: {
  summary: ReturnType<typeof computeTimelineSummary>;
  redMax: number;
  orangeMax: number;
}) {
  const band =
    summary.latestScore != null ? getScoreBand(summary.latestScore, redMax, orangeMax) : null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Card className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Weeks</p>
        <p className="mt-0.5 text-xl font-semibold text-[var(--color-text)]">{summary.weekCount}</p>
      </Card>
      <Card className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Latest score</p>
        {summary.latestScore != null ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold text-[var(--color-text)]">
            {band && (
              <span className={`h-2 w-2 rounded-full ${BAND_STYLES[band].dot}`} aria-hidden />
            )}
            {summary.latestScore}%
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">—</p>
        )}
        {summary.avgScore != null && (
          <p className="text-[10px] text-[var(--color-text-muted)]">{summary.avgScore}% avg</p>
        )}
      </Card>
      <Card className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Weight</p>
        {summary.latestWeight != null ? (
          <>
            <p className="mt-0.5 text-xl font-semibold text-[var(--color-text)]">{summary.latestWeight} kg</p>
            {summary.weightChangeBaseline != null && summary.weightChangeBaseline !== 0 && (
              <p className="text-[10px]">
                <DeltaText value={summary.weightChangeBaseline} unit="kg" />
                <span className="text-[var(--color-text-muted)]"> overall</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">—</p>
        )}
      </Card>
      <Card className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Photo weeks</p>
        <p className="mt-0.5 text-xl font-semibold text-[var(--color-text)]">{summary.photoWeeks}</p>
        <p className="text-[10px] text-[var(--color-text-muted)]">with uploads</p>
      </Card>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="28" textAnchor="middle" className="fill-[var(--color-text)] text-[11px] font-bold">
        {score}%
      </text>
    </svg>
  );
}

function TimelineClickPanel({
  href,
  label,
  children,
  emptyMessage,
}: {
  href: string;
  label: string;
  children?: React.ReactNode;
  emptyMessage?: string;
}) {
  return (
    <Link
      href={href}
      className="group -m-2 block rounded-xl p-2 transition-colors hover:bg-[var(--color-primary-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="mt-2">
        {emptyMessage ? (
          <p className="text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
      <p className="mt-2 text-xs font-medium text-[var(--color-primary)] opacity-70 transition-opacity group-hover:opacity-100">
        View →
      </p>
    </Link>
  );
}

function MeasurementBlock({
  measurement,
  baselineDelta,
  weekDelta,
}: {
  measurement: NonNullable<TimelineWeek["measurement"]>;
  baselineDelta: TimelineMeasurementDelta | null;
  weekDelta: TimelineMeasurementDelta | null;
}) {
  const rows: Array<{ label: string; value: number; unit: string; baseline: number | null; wow: number | null }> = [];
  if (measurement.bodyWeight != null) {
    rows.push({
      label: "Weight",
      value: measurement.bodyWeight,
      unit: "kg",
      baseline: baselineDelta?.bodyWeight ?? null,
      wow: weekDelta?.bodyWeight ?? null,
    });
  }
  if (measurement.waist != null) {
    rows.push({
      label: "Waist",
      value: measurement.waist,
      unit: "cm",
      baseline: baselineDelta?.waist ?? null,
      wow: weekDelta?.waist ?? null,
    });
  }
  if (measurement.hips != null) {
    rows.push({
      label: "Hips",
      value: measurement.hips,
      unit: "cm",
      baseline: baselineDelta?.hips ?? null,
      wow: weekDelta?.hips ?? null,
    });
  }
  if (measurement.chest != null) {
    rows.push({
      label: "Chest",
      value: measurement.chest,
      unit: "cm",
      baseline: baselineDelta?.chest ?? null,
      wow: weekDelta?.chest ?? null,
    });
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="text-sm">
          <span className="text-[var(--color-text-muted)]">{row.label} </span>
          <span className="font-semibold text-[var(--color-text)]">
            {row.value} {row.unit}
          </span>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">
            {row.baseline != null && row.baseline !== 0 && (
              <span>
                <span className="text-[var(--color-text-muted)]">vs start </span>
                <DeltaText value={row.baseline} unit={row.unit} />
              </span>
            )}
            {row.wow != null && row.wow !== 0 && (
              <span>
                <span className="text-[var(--color-text-muted)]">vs last wk </span>
                <DeltaText value={row.wow} unit={row.unit} />
              </span>
            )}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-[var(--color-text-muted)]">
        Logged {formatDateDisplay(measurement.date)}
      </p>
    </div>
  );
}

function TimelineWeekCard({
  week,
  isLatest,
  trafficLightRedMax,
  trafficLightOrangeMax,
  links,
}: {
  week: TimelineWeek;
  isLatest: boolean;
  trafficLightRedMax: number;
  trafficLightOrangeMax: number;
  links: TimelineLinks;
}) {
  const band = week.checkIn
    ? getScoreBand(week.checkIn.score, trafficLightRedMax, trafficLightOrangeMax)
    : null;
  const styles = band ? BAND_STYLES[band] : null;

  const hasCheckIn = Boolean(week.checkIn);
  const hasMeasurement = Boolean(week.measurement);
  const hasPhotos = week.photos.length > 0;
  const hasHabits = Boolean(week.habits);
  const primaryHref = links.weekPrimaryHref(week);

  const headerInner = (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-[var(--color-text)]">{week.weekLabel}</h3>
          {isLatest && (
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              Latest
            </span>
          )}
        </div>
        {week.checkIn?.completedAt && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Check-in {formatDateDisplay(week.checkIn.completedAt.slice(0, 10))}
          </p>
        )}
      </div>
    </>
  );

  return (
    <li className="relative pb-6 last:pb-0">
      <span
        className={`absolute -left-[1.35rem] top-4 h-3 w-3 rounded-full border-2 border-[var(--color-bg)] ${
          isLatest ? "bg-[var(--color-primary)]" : styles ? styles.dot : "bg-[var(--color-border)]"
        }`}
        aria-hidden
      />
      <Card
        className={`overflow-hidden border-l-4 p-0 ${styles ? styles.border : "border-l-[var(--color-border)]"}`}
      >
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {primaryHref ? (
              <Link
                href={primaryHref}
                className="min-w-0 flex-1 rounded-lg transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                {headerInner}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{headerInner}</div>
            )}
            {week.checkIn && styles && (
              <Link
                href={links.checkInHref(week.checkIn)}
                className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <ScoreRing score={week.checkIn.score} color={styles.ring} />
                <div className="hidden sm:block">
                  <p className={`text-xs font-medium ${styles.pill} rounded-full px-2 py-0.5`}>
                    {styles.label}
                  </p>
                  {week.scoreWeekDelta != null && week.scoreWeekDelta !== 0 && (
                    <p
                      className={`mt-1 text-[10px] font-medium ${
                        week.scoreWeekDelta > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {week.scoreWeekDelta > 0 ? "+" : ""}
                      {week.scoreWeekDelta}% vs last week
                    </p>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-2 p-4 sm:grid-cols-3">
          {hasCheckIn && week.checkIn ? (
            <TimelineClickPanel href={links.checkInHref(week.checkIn)} label="Check-in">
              <p className="text-2xl font-semibold text-[var(--color-text)]">{week.checkIn.score}%</p>
              <p className="text-xs text-[var(--color-text-muted)]">{week.checkIn.formTitle}</p>
              {week.scoreWeekDelta != null && week.scoreWeekDelta !== 0 && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    week.scoreWeekDelta > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {week.scoreWeekDelta > 0 ? "+" : ""}
                  {week.scoreWeekDelta}% vs last week
                </p>
              )}
            </TimelineClickPanel>
          ) : (
            <TimelineClickPanel href={links.emptyCheckInHref} label="Check-in" emptyMessage="No check-in this week" />
          )}

          {hasMeasurement && week.measurement ? (
            <TimelineClickPanel href={links.measurementHref(week.measurement)} label="Body">
              <MeasurementBlock
                measurement={week.measurement}
                baselineDelta={week.measurementDelta}
                weekDelta={week.measurementWeekDelta}
              />
            </TimelineClickPanel>
          ) : (
            <TimelineClickPanel href={links.emptyMeasurementsHref} label="Body" emptyMessage="No measurements" />
          )}

          {hasPhotos ? (
            <TimelineClickPanel href={links.photosHref} label="Photos">
              <div className="flex flex-wrap gap-2">
                {week.photos.map((photo) => (
                  <div key={photo.id} className="w-14 shrink-0">
                    <div className="relative h-16 w-14 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
                      <Image
                        src={photo.imageUrl}
                        alt={shortPhotoLabel(photo.imageType)}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    </div>
                    <p className="mt-0.5 truncate text-center text-[9px] text-[var(--color-text-muted)]">
                      {shortPhotoLabel(photo.imageType)}
                    </p>
                  </div>
                ))}
              </div>
            </TimelineClickPanel>
          ) : (
            <TimelineClickPanel href={links.emptyPhotosHref} label="Photos" emptyMessage="No photos" />
          )}
        </div>

        {hasHabits && week.habits && (
          <Link
            href={links.habitsHref}
            className="group block border-t border-[var(--color-border)] px-4 py-3 transition-colors hover:bg-[var(--color-primary-subtle)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Habits this week
              </p>
              <p className="text-xs font-medium text-[var(--color-text)]">{week.habits.pct}% goals met</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${week.habits.pct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              {week.habits.met} of {week.habits.logged} logged days on target
            </p>
            <p className="mt-2 text-xs font-medium text-[var(--color-primary)] opacity-70 group-hover:opacity-100">
              View habits →
            </p>
          </Link>
        )}

        {!hasCheckIn && !hasMeasurement && hasPhotos && (
          <div className="border-t border-[var(--color-border)] px-4 py-2">
            <p className="text-xs text-[var(--color-text-muted)]">Photo upload only — no check-in or measurements logged this week.</p>
          </div>
        )}
      </Card>
    </li>
  );
}
