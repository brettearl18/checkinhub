"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MeasurementSlotTrendChartLazy } from "@/components/ui/MeasurementSlotTrendChartLazy";
import { MeasurementPairedSlotTrendChartLazy } from "@/components/ui/MeasurementPairedSlotTrendChartLazy";
import { MEASUREMENT_SLOT_COUNT, type SlotChartRow } from "@/components/ui/MeasurementSlotTrendChart";
import type { PairedSlotChartRow } from "@/components/ui/MeasurementPairedSlotTrendChart";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import { formatProgressImageTypeLabel } from "@/lib/progress-comparison-photos";

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

interface Goal {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
  status: string;
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

interface CheckInScore {
  id: string;
  formTitle: string;
  submittedAt: string | null;
  score: number;
}

interface QuestionProgressWeek {
  key: string;
  label: string;
}

interface QuestionProgress {
  questions: Array<{ id: string; text: string }>;
  weeks: QuestionProgressWeek[];
  grid: Record<string, Record<string, number>>;
}

/** Fixed bands for per-question grid (Good 7–10, Moderate 4–6, Needs attention 0–3). Score is 0–100. */
function getQuestionBand(score: number): "green" | "orange" | "red" {
  if (score < 40) return "red";
  if (score < 70) return "orange";
  return "green";
}

// Traffic light bands for overall score 0–100 (per-client thresholds).
function getScoreBand(score: number, redMax: number, orangeMax: number): "red" | "orange" | "green" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

const MEASUREMENT_LABELS: Record<string, string> = {
  bodyWeight: "Body Weight (kg)",
  waist: "Waist (cm)",
  hips: "Hips (cm)",
  chest: "Chest (cm)",
  thighs: "Thighs (cm)",
  arms: "Arms (cm)",
};

/** All measurements with a value for this metric, oldest → newest. */
function getAllTrendPoints(
  measurements: Measurement[],
  key: "bodyWeight" | string
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (const m of measurements) {
    let value: number | null = null;
    if (key === "bodyWeight") value = m.bodyWeight ?? null;
    else value = m.measurements?.[key] ?? null;
    if (value != null && m.date) points.push({ date: m.date, value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

type MeasurementRangeKey = "7d" | "30d" | "90d" | "180d";

const MEASUREMENT_RANGE_OPTIONS: { key: MeasurementRangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "1 month", days: 30 },
  { key: "90d", label: "3 months", days: 90 },
  { key: "180d", label: "6 months", days: 180 },
];

function filterPointsByRange(
  points: { date: string; value: number }[],
  days: number
): { date: string; value: number }[] {
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
  const take = points.slice(0, MEASUREMENT_SLOT_COUNT);
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

interface PairedMeasurementRow {
  date: string;
  left: number | null;
  right: number | null;
}

/** One row per date in range, union of left/right series (for thighs or arms). */
function mergePairedTrendPoints(
  left: { date: string; value: number }[],
  right: { date: string; value: number }[]
): PairedMeasurementRow[] {
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

function buildPairedSlotRows(merged: PairedMeasurementRow[]): PairedSlotChartRow[] {
  const take = merged.slice(0, MEASUREMENT_SLOT_COUNT);
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

type MeasurementTrendCard =
  | {
      key: string;
      label: string;
      kind: "single";
      slotRows: SlotChartRow[];
      hasInRange: boolean;
      hasEver: boolean;
      unit: string;
    }
  | {
      key: string;
      label: string;
      kind: "paired";
      slotRows: PairedSlotChartRow[];
      leftLabel: string;
      rightLabel: string;
      hasInRange: boolean;
      hasEver: boolean;
      unit: string;
    };

const GRID_CHART_HEIGHT = 200;

export default function CoachClientProgressPage() {
  const params = useParams();
  const clientId = params?.clientId as string | undefined;
  const [clientName, setClientName] = useState("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [checkInScores, setCheckInScores] = useState<CheckInScore[]>([]);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress | null>(null);
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [measurementRange, setMeasurementRange] = useState<MeasurementRangeKey>("180d");

  const { fetchWithAuth } = useApiClient();

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/progress`);
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.status === 403 || res.status === 404) {
          setMeasurements([]);
          setGoals([]);
          setProgressImages([]);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const c = data.client ?? {};
          setClientName([c.firstName, c.lastName].filter(Boolean).join(" ") || "Client");
          setMeasurements(Array.isArray(data.measurements) ? data.measurements : []);
          setGoals(Array.isArray(data.goals) ? data.goals : []);
          setProgressImages(Array.isArray(data.progressImages) ? data.progressImages : []);
          setCheckInScores(Array.isArray(data.checkInScores) ? data.checkInScores : []);
          const qp = data.questionProgress;
          setQuestionProgress(
            qp && Array.isArray(qp.questions) && Array.isArray(qp.weeks) && qp.grid != null
              ? { questions: qp.questions, weeks: qp.weeks, grid: qp.grid }
              : null
          );
          setTrafficLightRedMax(typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40);
          setTrafficLightOrangeMax(typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  const measurementRangeDays = MEASUREMENT_RANGE_OPTIONS.find((r) => r.key === measurementRange)?.days ?? 180;

  const measurementTrendCards = useMemo((): MeasurementTrendCard[] => {
    const days = measurementRangeDays;
    const cards: MeasurementTrendCard[] = [];

    for (const key of ["bodyWeight", "waist", "hips", "chest"] as const) {
      const all = getAllTrendPoints(measurements, key);
      const filtered = filterPointsByRange(all, days);
      cards.push({
        key,
        label: MEASUREMENT_LABELS[key] ?? key,
        kind: "single",
        slotRows: buildSlotRows(filtered),
        hasInRange: filtered.length > 0,
        hasEver: all.length > 0,
        unit: key === "bodyWeight" ? "kg" : "cm",
      });
    }

    const leftThigh = filterPointsByRange(getAllTrendPoints(measurements, "leftThigh"), days);
    const rightThigh = filterPointsByRange(getAllTrendPoints(measurements, "rightThigh"), days);
    const thighMerged = mergePairedTrendPoints(leftThigh, rightThigh);
    cards.push({
      key: "thighs",
      label: MEASUREMENT_LABELS.thighs,
      kind: "paired",
      slotRows: buildPairedSlotRows(thighMerged),
      leftLabel: "Left thigh",
      rightLabel: "Right thigh",
      hasInRange: thighMerged.some((r) => r.left != null || r.right != null),
      hasEver:
        getAllTrendPoints(measurements, "leftThigh").length > 0 ||
        getAllTrendPoints(measurements, "rightThigh").length > 0,
      unit: "cm",
    });

    const leftArm = filterPointsByRange(getAllTrendPoints(measurements, "leftArm"), days);
    const rightArm = filterPointsByRange(getAllTrendPoints(measurements, "rightArm"), days);
    const armMerged = mergePairedTrendPoints(leftArm, rightArm);
    cards.push({
      key: "arms",
      label: MEASUREMENT_LABELS.arms,
      kind: "paired",
      slotRows: buildPairedSlotRows(armMerged),
      leftLabel: "Left arm",
      rightLabel: "Right arm",
      hasInRange: armMerged.some((r) => r.left != null || r.right != null),
      hasEver:
        getAllTrendPoints(measurements, "leftArm").length > 0 ||
        getAllTrendPoints(measurements, "rightArm").length > 0,
      unit: "cm",
    });

    return cards;
  }, [measurements, measurementRangeDays]);

  const latest = measurements[0];
  const baseline = measurements.find((m) => m.isBaseline) ?? measurements[measurements.length - 1];
  const currentWeight = latest?.bodyWeight ?? null;
  const baselineWeight = baseline?.bodyWeight ?? null;
  const weightChange =
    currentWeight != null && baselineWeight != null ? currentWeight - baselineWeight : null;
  const latestMeasurements = latest?.measurements ?? {};
  const measurementKeys = Object.keys(latestMeasurements).filter(
    (k) => k !== "bodyWeight" && typeof latestMeasurements[k] === "number"
  );
  if (!clientId) {
    return (
      <div className="space-y-6">
        <Link href="/coach/clients" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Clients
        </Link>
        <p className="text-[var(--color-text-muted)]">Invalid client.</p>
      </div>
    );
  }

  if (authError) {
    return <AuthErrorRetry onRetry={() => clientId && window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={clientId ? `/coach/clients/${clientId}` : "/coach/clients"}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Back to check-ins
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
            Progress: {loading ? "…" : clientName.toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Question-level progress over time
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={clientId ? `/coach/clients/${clientId}/settings` : "#"}>
            Settings
          </Link>
        </Button>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && (
        <>
          {/* Traffic light legend (per-client thresholds) */}
          <Card className="p-3">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Traffic light system</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
                <span className="text-[var(--color-text)]">Good</span>
                <span className="text-[var(--color-text-muted)]">({trafficLightOrangeMax + 1}–100%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
                <span className="text-[var(--color-text)]">Moderate</span>
                <span className="text-[var(--color-text-muted)]">({trafficLightRedMax + 1}–{trafficLightOrangeMax}%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
                <span className="text-[var(--color-text)]">Needs attention</span>
                <span className="text-[var(--color-text-muted)]">(0–{trafficLightRedMax}%)</span>
              </span>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Weight</h3>
              {currentWeight != null ? (
                <>
                  <p className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                    {currentWeight} kg
                  </p>
                  {weightChange != null && baselineWeight != null && (
                    <p className="text-sm flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                          weightChange < 0
                            ? "bg-green-500"
                            : weightChange > 0
                              ? "bg-red-500"
                              : "bg-amber-500"
                        }`}
                        aria-hidden
                      />
                      <span
                        className={
                          weightChange < 0
                            ? "text-green-600 dark:text-green-400"
                            : weightChange > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                        }
                      >
                        {weightChange > 0 ? "+" : ""}
                        {weightChange.toFixed(1)} kg from baseline
                      </span>
                    </p>
                  )}
                  {baselineWeight != null && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Baseline: {baselineWeight} kg
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No weight recorded</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Body measurements</h3>
              {measurementKeys.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-[var(--color-text)]">
                  {measurementKeys.slice(0, 6).map((key) => (
                    <li key={key}>
                      {key.replace(/([A-Z])/g, " $1").trim()}: {latestMeasurements[key]} cm
                    </li>
                  ))}
                  {measurementKeys.length > 6 && (
                    <li className="text-[var(--color-text-muted)]">+{measurementKeys.length - 6} more</li>
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No measurements</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Goals</h3>
              {goals.filter((g) => g.status === "active").length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {goals
                    .filter((g) => g.status === "active")
                    .slice(0, 3)
                    .map((g) => (
                      <li key={g.id} className="text-[var(--color-text)]">
                        {g.title}: {g.currentValue} / {g.targetValue} {g.unit}
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                          <div
                            className="h-full bg-[var(--color-primary)]"
                            style={{ width: `${Math.min(100, g.progress ?? 0)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No goals set</p>
              )}
            </Card>
          </div>

          {/* Check-in scores (traffic light) */}
          {checkInScores.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium text-[var(--color-text)]">Check-in scores</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Overall score per check-in (traffic light)
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {checkInScores.map((r) => {
                  const band = getScoreBand(r.score, trafficLightRedMax, trafficLightOrangeMax);
                  const bandClass =
                    band === "green"
                      ? "bg-green-500"
                      : band === "orange"
                        ? "bg-amber-500"
                        : "bg-red-500";
                  const textClass =
                    band === "green"
                      ? "text-green-700 dark:text-green-300"
                      : band === "orange"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-red-700 dark:text-red-300";
                  return (
                    <Link
                      key={r.id}
                      href={`/coach/clients/${clientId}/responses/${r.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm hover:border-[var(--color-primary-muted)] hover:bg-[var(--color-primary-subtle)]/30"
                    >
                      <span
                        className={`h-4 w-4 flex-shrink-0 rounded-full ${bandClass}`}
                        aria-hidden
                      />
                      <span className={`font-medium tabular-nums ${textClass}`}>
                        {r.score}%
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {r.formTitle}
                        {r.submittedAt && (
                          <> · {formatDateDisplay(r.submittedAt)}</>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Question progress table (per-question traffic light grid) */}
          {questionProgress && questionProgress.questions.length > 0 && questionProgress.weeks.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <div className="p-4 pb-2">
                <h3 className="font-medium text-[var(--color-text)]">Question progress over time</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Per-question score by week (fixed scale: Good 7–10, Moderate 4–6, Needs attention 0–3)
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
                    Good (7–10)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
                    Moderate (4–6)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
                    Needs attention (0–3)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[var(--color-border)]" aria-hidden />
                    Not scored
                  </span>
                </div>
              </div>
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                    <th className="sticky left-0 z-10 min-w-[120px] bg-[var(--color-bg-elevated)] px-3 py-2 text-left font-medium text-[var(--color-text-muted)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                      Question
                    </th>
                    {questionProgress.weeks.map((w) => (
                      <th
                        key={w.key}
                        className="px-2 py-2 text-center font-medium text-[var(--color-text-muted)] whitespace-nowrap"
                      >
                        {w.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questionProgress.questions.map((q) => (
                    <tr
                      key={q.id}
                      className="group border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/50"
                    >
                      <td className="sticky left-0 z-10 min-w-[120px] max-w-[200px] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] truncate shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)] group-hover:bg-[var(--color-bg-elevated)]/50" title={q.text}>
                        {q.text}
                      </td>
                      {questionProgress.weeks.map((w) => {
                        const score = questionProgress.grid[q.id]?.[w.key];
                        const band = score != null ? getQuestionBand(score) : null;
                        return (
                          <td key={w.key} className="px-2 py-2 text-center">
                            <span
                              className={`inline-block h-4 w-4 rounded-full ${
                                band === "green"
                                  ? "bg-green-500"
                                  : band === "orange"
                                    ? "bg-amber-500"
                                    : band === "red"
                                      ? "bg-red-500"
                                      : "bg-[var(--color-border)]"
                              }`}
                              title={score != null ? `${score}%` : "Not scored"}
                              aria-hidden
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                Scroll horizontally on small screens to see all weeks.
              </p>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-medium text-[var(--color-text)]">Measurement trends</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Track weight and body measurements over time
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">Time range</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {MEASUREMENT_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMeasurementRange(opt.key)}
                  className={`rounded px-3 py-1.5 text-sm ${measurementRange === opt.key ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "bg-[var(--color-bg-elevated)] text-[var(--color-text)] ring-1 ring-[var(--color-border)]"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Readings in order within the range (not stretched by calendar gaps). Charts scale to your data so changes are easier to see.
              Thighs and arms plot left and right together; each reading # is a day with at least one side logged.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {measurementTrendCards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3"
                >
                  <h4 className="text-sm font-medium text-[var(--color-text)]">{card.label}</h4>
                  <div className="mt-2">
                    {card.hasInRange ? (
                      card.kind === "paired" ? (
                        <MeasurementPairedSlotTrendChartLazy
                          rows={card.slotRows}
                          unit={card.unit}
                          leftLabel={card.leftLabel}
                          rightLabel={card.rightLabel}
                          height={GRID_CHART_HEIGHT}
                          fillContainer
                        />
                      ) : (
                        <MeasurementSlotTrendChartLazy
                          rows={card.slotRows}
                          unit={card.unit}
                          height={GRID_CHART_HEIGHT}
                          fillContainer
                        />
                      )
                    ) : (
                      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                        {card.hasEver
                          ? "No measurements in this time range."
                          : "No data yet."}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium text-[var(--color-text)]">Progress photos</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Visual progress tracking over time
                </p>
              </div>
            </div>
            {progressImages.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {progressImages.map((img) => (
                  <div key={img.id} className="overflow-hidden rounded border border-[var(--color-border)]">
                    <div className="relative aspect-[3/4] bg-[var(--color-bg-elevated)]">
                      <Image
                        src={img.imageUrl}
                        alt={img.caption || img.imageType || "Progress"}
                        fill
                        className="object-cover"
                        sizes="200px"
                        unoptimized
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">
                        {formatProgressImageTypeLabel(img.imageType)}
                      </p>
                      {img.uploadedAt && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatDateDisplay(img.uploadedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">No progress photos yet</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}