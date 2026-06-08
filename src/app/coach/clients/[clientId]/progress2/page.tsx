"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { HabitWeeklyStrip, type HabitStripRange } from "@/components/client/HabitWeeklyStrip";
import { CheckInScoreTrendChartLazy } from "@/components/ui/CheckInScoreTrendChartLazy";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import {
  formatProgressImageTypeLabel,
  pickBaselineAndCurrentPhoto,
  progressPhotoPoseLabel,
} from "@/lib/progress-comparison-photos";
import type { HabitDefinition } from "@/lib/habits";

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

interface QuestionProgress {
  questions: Array<{ id: string; text: string }>;
  weeks: Array<{ key: string; label: string }>;
  grid: Record<string, Record<string, number>>;
}

interface HabitsData {
  habits: HabitDefinition[];
  streaks: Record<string, { current: number; longest: number; goalMetToday: boolean }>;
  history?: {
    start: string;
    end: string;
    byDate: Record<string, Record<string, "met" | "missed">>;
  };
}

function getScoreBand(score: number, redMax: number, orangeMax: number): "red" | "orange" | "green" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

const BAND_DOT: Record<"red" | "orange" | "green", string> = {
  red: "bg-red-500",
  orange: "bg-amber-500",
  green: "bg-green-500",
};

const BAND_TEXT: Record<"red" | "orange" | "green", string> = {
  red: "text-red-600 dark:text-red-400",
  orange: "text-amber-600 dark:text-amber-400",
  green: "text-green-600 dark:text-green-400",
};

const BODY_MEASUREMENT_SUMMARY_ORDER = [
  "waist",
  "hips",
  "chest",
  "leftThigh",
  "rightThigh",
  "leftArm",
  "rightArm",
] as const;

const BODY_MEASUREMENT_SUMMARY_LABELS: Record<(typeof BODY_MEASUREMENT_SUMMARY_ORDER)[number], string> = {
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  leftThigh: "Left thigh",
  rightThigh: "Right thigh",
  leftArm: "Left arm",
  rightArm: "Right arm",
};

function measurementNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMeasurementNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatMeasurementDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatMeasurementNumber(delta)} cm`;
}

function getLatestBodyMeasurements(
  measurements: Measurement[],
  baseline: Measurement | undefined
): Array<{ key: string; label: string; value: number; change: number | null }> {
  const result: Array<{ key: string; label: string; value: number; change: number | null }> = [];
  for (const key of BODY_MEASUREMENT_SUMMARY_ORDER) {
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
      label: BODY_MEASUREMENT_SUMMARY_LABELS[key],
      value,
      change: baselineValue != null ? value - baselineValue : null,
    });
  }
  return result;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.now();
  return Math.floor((now - then) / (24 * 60 * 60 * 1000));
}

function getQuestionTrends(qp: QuestionProgress | null) {
  if (!qp || qp.weeks.length < 2) return { improving: [], declining: [] };
  const trends: Array<{ id: string; text: string; delta: number; latest: number; earliest: number }> = [];
  for (const q of qp.questions) {
    const scores = qp.weeks
      .map((w) => qp.grid[q.id]?.[w.key])
      .filter((s): s is number => s != null);
    if (scores.length < 2) continue;
    const earliest = scores[0]!;
    const latest = scores[scores.length - 1]!;
    const delta = latest - earliest;
    if (delta === 0) continue;
    trends.push({ id: q.id, text: q.text, delta, latest, earliest });
  }
  return {
    improving: trends.filter((t) => t.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    declining: trends.filter((t) => t.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
  };
}

export default function CoachClientProgress2Page() {
  const params = useParams();
  const clientId = params?.clientId as string | undefined;
  const { fetchWithAuth } = useApiClient();

  const [clientName, setClientName] = useState("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [checkInScores, setCheckInScores] = useState<CheckInScore[]>([]);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress | null>(null);
  const [habitsData, setHabitsData] = useState<HabitsData | null>(null);
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [habitRange, setHabitRange] = useState<HabitStripRange>("30d");

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      try {
        const [progressRes, habitsRes] = await Promise.all([
          fetchWithAuth(`/api/coach/clients/${clientId}/progress`),
          fetchWithAuth(`/api/coach/clients/${clientId}/habits`),
        ]);
        if (progressRes.status === 401 || habitsRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (progressRes.ok) {
          const data = await progressRes.json();
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
          setTrafficLightOrangeMax(
            typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70
          );
        }
        if (habitsRes.ok) {
          const h = await habitsRes.json();
          setHabitsData({
            habits: h.habits ?? [],
            streaks: h.streaks ?? {},
            history: h.history,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  const latest = measurements[0];
  const baseline = measurements.find((m) => m.isBaseline) ?? measurements[measurements.length - 1];
  const currentWeight = latest?.bodyWeight ?? null;
  const baselineWeight = baseline?.bodyWeight ?? null;
  const weightChange =
    currentWeight != null && baselineWeight != null ? currentWeight - baselineWeight : null;

  const latestBodyMeasurements = useMemo(
    () => getLatestBodyMeasurements(measurements, baseline),
    [measurements, baseline]
  );

  const latestScore = checkInScores[0] ?? null;
  const latestScoreBand = latestScore
    ? getScoreBand(latestScore.score, trafficLightRedMax, trafficLightOrangeMax)
    : null;

  const scoreChartData = useMemo(
    () =>
      [...checkInScores]
        .filter((s) => s.submittedAt)
        .sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))
        .map((s) => ({
          date: s.submittedAt!.slice(0, 10),
          score: s.score,
          label: s.formTitle,
        })),
    [checkInScores]
  );

  const avgScore4wk = useMemo(() => {
    const recent = scoreChartData.slice(-4);
    if (recent.length === 0) return null;
    return Math.round(recent.reduce((sum, p) => sum + p.score, 0) / recent.length);
  }, [scoreChartData]);

  const bestHabitStreak = useMemo(() => {
    if (!habitsData) return null;
    let best = { label: "", current: 0 };
    for (const h of habitsData.habits) {
      const s = habitsData.streaks[h.id]?.current ?? 0;
      if (s > best.current) best = { label: h.label, current: s };
    }
    return best.current > 0 ? best : null;
  }, [habitsData]);

  const daysSinceCheckIn = daysSince(latestScore?.submittedAt ?? null);

  const photoPair = useMemo(() => pickBaselineAndCurrentPhoto(progressImages), [progressImages]);

  const questionTrends = useMemo(() => getQuestionTrends(questionProgress), [questionProgress]);

  const activeGoals = goals.filter((g) => g.status === "active");

  if (!clientId) {
    return <p className="text-[var(--color-text-muted)]">Invalid client.</p>;
  }

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/coach/clients/${clientId}/progress`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Classic progress view
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">
              Progress dashboard: {loading ? "…" : clientName.toUpperCase()}
            </h1>
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Command-centre view — scores, body comp, habits, and photos at a glance
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}`}>Check-ins</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}/settings`}>Settings</Link>
          </Button>
        </div>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && (
        <>
          {/* KPI strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Weight</p>
              {currentWeight != null ? (
                <>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{currentWeight} kg</p>
                  {weightChange != null && (
                    <p className={`mt-1 text-sm ${weightChange <= 0 ? BAND_TEXT.green : BAND_TEXT.red}`}>
                      {weightChange > 0 ? "+" : ""}
                      {weightChange.toFixed(1)} kg vs baseline
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No weight logged</p>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Latest score</p>
              {latestScore ? (
                <>
                  <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-[var(--color-text)]">
                    <span
                      className={`h-3 w-3 rounded-full ${latestScoreBand ? BAND_DOT[latestScoreBand] : "bg-[var(--color-border)]"}`}
                      aria-hidden
                    />
                    {latestScore.score}%
                  </p>
                  {avgScore4wk != null && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {avgScore4wk}% avg (last {Math.min(4, scoreChartData.length)} check-ins)
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No check-ins yet</p>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Habit streak</p>
              {bestHabitStreak ? (
                <>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                    🔥 {bestHabitStreak.current} days
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">{bestHabitStreak.label}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">No active streak</p>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Last check-in</p>
              {daysSinceCheckIn != null ? (
                <>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                    {daysSinceCheckIn === 0 ? "Today" : `${daysSinceCheckIn}d ago`}
                  </p>
                  {latestScore?.submittedAt && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {formatDateDisplay(latestScore.submittedAt.slice(0, 10))}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">—</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Score trend */}
            <Card className="p-4">
              <h2 className="font-medium text-[var(--color-text)]">Check-in score trend</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Overall traffic-light score over time (dashed lines = client thresholds)
              </p>
              {scoreChartData.length > 0 ? (
                <div className="mt-4">
                  <CheckInScoreTrendChartLazy
                    data={scoreChartData}
                    redMax={trafficLightRedMax}
                    orangeMax={trafficLightOrangeMax}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-muted)]">No check-in scores yet.</p>
              )}
            </Card>

            {/* Body measurements snapshot */}
            <Card className="p-4">
              <h2 className="font-medium text-[var(--color-text)]">Body measurements</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Latest values with change vs baseline</p>
              {latestBodyMeasurements.length > 0 ? (
                <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-[var(--color-text)]">
                  {latestBodyMeasurements.map((item) => (
                    <li
                      key={item.key}
                      className={`flex min-w-0 flex-wrap items-baseline gap-x-1.5${item.key === "chest" ? " col-span-2" : ""}`}
                    >
                      <span className="whitespace-nowrap">
                        {item.label}: {formatMeasurementNumber(item.value)} cm
                      </span>
                      {item.change != null && item.change !== 0 && (
                        <span
                          className={
                            item.change < 0
                              ? `whitespace-nowrap ${BAND_TEXT.green}`
                              : `whitespace-nowrap ${BAND_TEXT.red}`
                          }
                        >
                          ({formatMeasurementDelta(item.change)})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">No body measurements logged.</p>
              )}
              <Link
                href={`/coach/clients/${clientId}/progress`}
                className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                View measurement charts →
              </Link>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Before / after photos */}
            <Card className="p-4">
              <h2 className="font-medium text-[var(--color-text)]">Progress photos</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Baseline vs current (matching pose)</p>
              {photoPair.baselinePhoto || photoPair.currentPhoto ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(["baselinePhoto", "currentPhoto"] as const).map((slot) => {
                    const img = photoPair[slot];
                    const title = slot === "baselinePhoto" ? "Baseline" : "Current";
                    return (
                      <div key={slot} className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                        <div className="relative aspect-[3/4] bg-[var(--color-bg-elevated)]">
                          {img ? (
                            <Image
                              src={img.imageUrl}
                              alt={title}
                              fill
                              className="object-cover"
                              sizes="200px"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-[var(--color-text)]">{title}</p>
                          {img && (
                            <>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {formatProgressImageTypeLabel(img.imageType)}
                              </p>
                              {img.uploadedAt && (
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {formatDateDisplay(img.uploadedAt.slice(0, 10))}
                                </p>
                              )}
                              {progressPhotoPoseLabel(img.imageType) && (
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {progressPhotoPoseLabel(img.imageType)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-muted)]">No progress photos uploaded.</p>
              )}
            </Card>

            {/* Goals */}
            <Card className="p-4">
              <h2 className="font-medium text-[var(--color-text)]">Goals</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Active targets</p>
              {activeGoals.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {activeGoals.slice(0, 4).map((g) => (
                    <li key={g.id}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium text-[var(--color-text)]">{g.title}</span>
                        <span className="text-[var(--color-text-muted)]">
                          {g.currentValue} / {g.targetValue} {g.unit}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)]"
                          style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">No active goals.</p>
              )}
            </Card>
          </div>

          {/* Habits */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium text-[var(--color-text)]">Habit trackers</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Client habit compliance (read-only)</p>
              </div>
              <Link
                href={`/coach/clients/${clientId}/habits`}
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                Full habits view →
              </Link>
            </div>
            {habitsData?.history ? (
              <>
                <div className="mt-3 flex gap-1 rounded-lg bg-[var(--color-bg)] p-1">
                  {(["7d", "30d"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setHabitRange(r)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        habitRange === r
                          ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {r === "7d" ? "This week" : "Last 30 days"}
                    </button>
                  ))}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <HabitWeeklyStrip
                    habits={habitsData.habits}
                    byDate={habitsData.history.byDate}
                    range={habitRange}
                    historyStart={habitRange === "30d" ? habitsData.history.start : undefined}
                    historyEnd={habitRange === "30d" ? habitsData.history.end : undefined}
                  />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">No habit data for this client.</p>
            )}
          </Card>

          {/* Question insights */}
          {(questionTrends.improving.length > 0 || questionTrends.declining.length > 0) && (
            <Card className="p-4">
              <h2 className="font-medium text-[var(--color-text)]">Question trends</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Biggest shifts from first to latest scored week
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                    Improving
                  </h3>
                  {questionTrends.improving.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm">
                      {questionTrends.improving.map((t) => (
                        <li key={t.id} className="text-[var(--color-text)]">
                          <span className="line-clamp-2" title={t.text}>
                            {t.text}
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            {" "}
                            +{t.delta}% ({t.earliest}% → {t.latest}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">—</p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Needs attention
                  </h3>
                  {questionTrends.declining.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm">
                      {questionTrends.declining.map((t) => (
                        <li key={t.id} className="text-[var(--color-text)]">
                          <span className="line-clamp-2" title={t.text}>
                            {t.text}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            {" "}
                            {t.delta}% ({t.earliest}% → {t.latest}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">—</p>
                  )}
                </div>
              </div>
              <Link
                href={`/coach/clients/${clientId}/progress`}
                className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                Full question grid →
              </Link>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
