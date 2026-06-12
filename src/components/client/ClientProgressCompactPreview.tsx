"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { CheckInScoreTrendChartLazy } from "@/components/ui/CheckInScoreTrendChartLazy";
import { MeasurementSlotTrendChartLazy } from "@/components/ui/MeasurementSlotTrendChartLazy";
import { MeasurementPairedSlotTrendChartLazy } from "@/components/ui/MeasurementPairedSlotTrendChartLazy";
import { MEASUREMENT_SLOT_COUNT, type SlotChartRow } from "@/components/ui/MeasurementSlotTrendChart";
import type { PairedSlotChartRow } from "@/components/ui/MeasurementPairedSlotTrendChart";
import {
  buildLegacyPoseAssignment,
  getProgressPhotoForMilestone,
  PROGRESS_PHOTO_POSES,
  progressPhotoPoseTabLabel,
} from "@/lib/progress-comparison-photos";

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  uploadedAt: string | null;
}

interface ScorePoint {
  date: string;
  score: number;
  label?: string;
}

const BODY_KEYS = ["waist", "hips", "chest", "leftThigh", "rightThigh", "leftArm", "rightArm"] as const;
const BODY_LABELS: Record<(typeof BODY_KEYS)[number], string> = {
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  leftThigh: "L thigh",
  rightThigh: "R thigh",
  leftArm: "L arm",
  rightArm: "R arm",
};

const CHART_LABELS: Record<string, string> = {
  bodyWeight: "Weight",
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  thighs: "Thighs",
  arms: "Arms",
};

const SERIES_LABELS: Record<string, string> = {
  bodyWeight: "Weight",
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  thighs: "Thigh",
  arms: "Arm",
};

const COMPACT_CHART_HEIGHT = 96;
const COMPACT_RANGE_DAYS = 90;

function measurementNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNum(delta)}`;
}

function getAllTrendPoints(
  measurements: Measurement[],
  key: "bodyWeight" | string
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (const m of measurements) {
    const value =
      key === "bodyWeight"
        ? measurementNumericValue(m.bodyWeight)
        : measurementNumericValue(m.measurements?.[key]);
    if (value != null && m.date) points.push({ date: m.date, value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function filterPointsByRange(points: { date: string; value: number }[], days: number) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return points.filter((p) => {
    const t = new Date(`${p.date}T12:00:00`).getTime();
    return t >= startMs && t <= endMs;
  });
}

function buildSlotRows(points: { date: string; value: number }[]): SlotChartRow[] {
  const take = points.length > MEASUREMENT_SLOT_COUNT ? points.slice(-MEASUREMENT_SLOT_COUNT) : points;
  const rows: SlotChartRow[] = [];
  for (let i = 0; i < MEASUREMENT_SLOT_COUNT; i++) {
    if (i < take.length) {
      rows.push({ slot: i, value: take[i].value, date: take[i].date });
    } else {
      rows.push({ slot: i, value: null, date: null });
    }
  }
  return rows;
}

function mergePairedTrendPoints(
  left: { date: string; value: number }[],
  right: { date: string; value: number }[]
) {
  const dates = new Set<string>();
  for (const p of left) dates.add(p.date);
  for (const p of right) dates.add(p.date);
  const lm = new Map(left.map((p) => [p.date, p.value]));
  const rm = new Map(right.map((p) => [p.date, p.value]));
  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => ({
      date,
      left: lm.get(date) ?? null,
      right: rm.get(date) ?? null,
    }));
}

function buildPairedSlotRows(merged: { date: string; left: number | null; right: number | null }[]): PairedSlotChartRow[] {
  const take = merged.length > MEASUREMENT_SLOT_COUNT ? merged.slice(-MEASUREMENT_SLOT_COUNT) : merged;
  const rows: PairedSlotChartRow[] = [];
  for (let i = 0; i < MEASUREMENT_SLOT_COUNT; i++) {
    if (i < take.length) {
      const r = take[i];
      rows.push({ slot: i, date: r.date, left: r.left, right: r.right });
    } else {
      rows.push({ slot: i, date: null, left: null, right: null });
    }
  }
  return rows;
}

function getLatestBodyMeasurements(measurements: Measurement[], baseline: Measurement | undefined) {
  const result: Array<{ key: string; label: string; value: number; change: number | null }> = [];
  for (const key of BODY_KEYS) {
    let value: number | null = null;
    for (const m of measurements) {
      const latest = measurementNumericValue(m.measurements?.[key]);
      if (latest != null) {
        value = latest;
        break;
      }
    }
    if (value == null) continue;
    const baselineValue = baseline ? measurementNumericValue(baseline.measurements?.[key]) : null;
    result.push({
      key,
      label: BODY_LABELS[key],
      value,
      change: baselineValue != null ? value - baselineValue : null,
    });
  }
  return result;
}

type TrendCard =
  | {
      key: string;
      kind: "single";
      slotRows: SlotChartRow[];
      hasInRange: boolean;
      unit: string;
    }
  | {
      key: string;
      kind: "paired";
      slotRows: PairedSlotChartRow[];
      hasInRange: boolean;
      unit: string;
      leftLabel: string;
      rightLabel: string;
    };

function CompactLatestPhotos({ images }: { images: ProgressImage[] }) {
  const legacy = useMemo(() => buildLegacyPoseAssignment(images), [images]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {PROGRESS_PHOTO_POSES.map((pose) => {
        const photo = getProgressPhotoForMilestone(images, pose, "latest", legacy);
        return (
          <Link
            key={pose}
            href="/client/progress-photos"
            className="group overflow-hidden rounded-lg border border-stone-200/80 bg-stone-50 transition hover:border-[var(--color-primary-muted)]"
          >
            <div className="relative aspect-[3/4] w-full">
              {photo ? (
                <Image
                  src={photo.imageUrl}
                  alt={`${progressPhotoPoseTabLabel(pose)} progress`}
                  fill
                  className="object-cover"
                  sizes="120px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-stone-300">—</div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-center text-[9px] font-semibold uppercase tracking-wide text-white">
                {progressPhotoPoseTabLabel(pose)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

interface Props {
  measurements: Measurement[];
  progressImages: ProgressImage[];
  scoreChartData: ScorePoint[];
  trafficLightRedMax: number;
  trafficLightOrangeMax: number;
  loading?: boolean;
}

export function ClientProgressCompactPreview({
  measurements,
  progressImages,
  scoreChartData,
  trafficLightRedMax,
  trafficLightOrangeMax,
  loading = false,
}: Props) {
  const baseline = useMemo(
    () => measurements.find((m) => m.isBaseline) ?? measurements[measurements.length - 1],
    [measurements]
  );

  const latestBodyMeasurements = useMemo(
    () => getLatestBodyMeasurements(measurements, baseline),
    [measurements, baseline]
  );

  const trendCards = useMemo((): TrendCard[] => {
    const cards: TrendCard[] = [];
    const days = COMPACT_RANGE_DAYS;

    for (const key of ["bodyWeight", "waist", "hips", "chest"] as const) {
      const filtered = filterPointsByRange(getAllTrendPoints(measurements, key), days);
      cards.push({
        key,
        kind: "single",
        slotRows: buildSlotRows(filtered),
        hasInRange: filtered.length > 0,
        unit: key === "bodyWeight" ? "kg" : "cm",
      });
    }

    const thighMerged = mergePairedTrendPoints(
      filterPointsByRange(getAllTrendPoints(measurements, "leftThigh"), days),
      filterPointsByRange(getAllTrendPoints(measurements, "rightThigh"), days)
    );
    cards.push({
      key: "thighs",
      kind: "paired",
      slotRows: buildPairedSlotRows(thighMerged),
      hasInRange: thighMerged.some((r) => r.left != null || r.right != null),
      unit: "cm",
      leftLabel: "L thigh",
      rightLabel: "R thigh",
    });

    const armMerged = mergePairedTrendPoints(
      filterPointsByRange(getAllTrendPoints(measurements, "leftArm"), days),
      filterPointsByRange(getAllTrendPoints(measurements, "rightArm"), days)
    );
    cards.push({
      key: "arms",
      kind: "paired",
      slotRows: buildPairedSlotRows(armMerged),
      hasInRange: armMerged.some((r) => r.left != null || r.right != null),
      unit: "cm",
      leftLabel: "L arm",
      rightLabel: "R arm",
    });

    return cards;
  }, [measurements]);

  const hasAnyTrend = trendCards.some((c) => c.hasInRange);
  const hasPhotos = progressImages.length > 0;
  const hasScores = scoreChartData.length > 0;
  const hasMeasurements = latestBodyMeasurements.length > 0;

  if (!loading && !hasAnyTrend && !hasPhotos && !hasScores && !hasMeasurements) {
    return (
      <section>
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="vana-section-label">Your progress</h2>
          <Link href="/client/progress" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            Open full view →
          </Link>
        </div>
        <Card className="vana-card p-4 text-sm text-stone-500">
          Log measurements, check-ins, or photos to see your progress here.
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="vana-section-label">Your progress</h2>
          <p className="mt-0.5 text-xs text-stone-500">Compact preview — last 3 months</p>
        </div>
        <Link href="/client/progress" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
          Full dashboard →
        </Link>
      </div>

      {loading ? (
        <Card className="vana-card p-4 text-sm text-stone-500">Loading progress…</Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="vana-card p-3">
              <p className="text-xs font-medium text-stone-700">Check-in score</p>
              {hasScores ? (
                <div className="mt-1 -mx-1">
                  <CheckInScoreTrendChartLazy
                    data={scoreChartData}
                    redMax={trafficLightRedMax}
                    orangeMax={trafficLightOrangeMax}
                    height={132}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-stone-500">No scores yet</p>
              )}
            </Card>

            <Card className="vana-card p-3">
              <p className="text-xs font-medium text-stone-700">Body measurements</p>
              {hasMeasurements ? (
                <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-stone-700">
                  {latestBodyMeasurements.map((item) => (
                    <li key={item.key} className="flex min-w-0 flex-wrap gap-x-1">
                      <span className="truncate">
                        {item.label}: {formatNum(item.value)}
                      </span>
                      {item.change != null && item.change !== 0 && (
                        <span className={item.change < 0 ? "text-emerald-600" : "text-red-600"}>
                          ({formatDelta(item.change)})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-stone-500">No measurements logged</p>
              )}
              <Link
                href="/client/measurements"
                className="mt-2 inline-block text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                Log measurements →
              </Link>
            </Card>
          </div>

          {hasAnyTrend && (
            <Card className="vana-card p-3">
              <p className="text-xs font-medium text-stone-700">Measurement trends</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trendCards.map((card) => (
                  <div
                    key={card.key}
                    className="rounded-lg border border-stone-200/80 bg-stone-50/50 p-2"
                  >
                    <p className="truncate text-[10px] font-medium text-stone-600">
                      {CHART_LABELS[card.key] ?? card.key}
                    </p>
                    <div className="mt-1" style={{ height: COMPACT_CHART_HEIGHT }}>
                      {card.hasInRange ? (
                        card.kind === "paired" ? (
                          <MeasurementPairedSlotTrendChartLazy
                            rows={card.slotRows}
                            unit={card.unit}
                            leftLabel={card.leftLabel}
                            rightLabel={card.rightLabel}
                            seriesLabel={SERIES_LABELS[card.key]}
                            height={COMPACT_CHART_HEIGHT}
                          />
                        ) : (
                          <MeasurementSlotTrendChartLazy
                            rows={card.slotRows}
                            unit={card.unit}
                            seriesLabel={SERIES_LABELS[card.key]}
                            height={COMPACT_CHART_HEIGHT}
                          />
                        )
                      ) : (
                        <p className="flex h-full items-center justify-center text-center text-[10px] text-stone-400">
                          No data
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {hasPhotos && (
            <Card className="vana-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-stone-700">Progress photos</p>
                <Link
                  href="/client/progress-photos"
                  className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  Gallery →
                </Link>
              </div>
              <CompactLatestPhotos images={progressImages} />
            </Card>
          )}
        </>
      )}
    </section>
  );
}
