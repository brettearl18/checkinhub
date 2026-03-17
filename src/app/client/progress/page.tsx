"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { HabitWeeklyStrip, type HabitStripRange } from "@/components/client/HabitWeeklyStrip";
import { MeasurementLineChartLazy } from "@/components/ui/MeasurementLineChartLazy";
import { MeasurementComparisonChartLazy } from "@/components/ui/MeasurementComparisonChartLazy";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

interface WeekLabel {
  key: string;
  label: string;
}

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
  caption: string | null;
  uploadedAt: string | null;
}

interface HabitsHistory {
  start: string;
  end: string;
  byDate: Record<string, Record<string, "met" | "missed">>;
}

const MEASUREMENT_KEYS = [
  "waist",
  "hips",
  "chest",
  "leftThigh",
  "rightThigh",
  "leftArm",
  "rightArm",
] as const;

const measurementLabels: Record<string, string> = {
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  leftThigh: "L thigh",
  rightThigh: "R thigh",
  leftArm: "L arm",
  rightArm: "R arm",
};

const BEFORE_TYPES = ["before_front", "before_side", "before_back"];
const AFTER_TYPES = ["after_front", "after_side", "after_back"];

/** Fixed bands for per-question grid: Good (7–10), Moderate (4–6), Needs attention (0–3). Score is 0–100. */
function getBand(score: number): "green" | "orange" | "red" {
  if (score < 40) return "red";
  if (score < 70) return "orange";
  return "green";
}

export default function ClientProgressPage() {
  const { fetchWithAuth } = useApiClient();
  const [questions, setQuestions] = useState<Array<{ id: string; text: string }>>([]);
  const [weeks, setWeeks] = useState<WeekLabel[]>([]);
  const [grid, setGrid] = useState<Record<string, Record<string, number>>>({});
  const [qpError, setQpError] = useState<string | null>(null);

  const [measurementList, setMeasurementList] = useState<Measurement[]>([]);
  const [habitsData, setHabitsData] = useState<{
    habits: Array<{ id: string; label: string }>;
    history?: HabitsHistory;
  } | null>(null);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [chartMetric, setChartMetric] = useState<"bodyWeight" | (typeof MEASUREMENT_KEYS)[number] | "arms" | "thighs">("bodyWeight");
  const [stripRange, setStripRange] = useState<HabitStripRange>("7d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setQpError(null);
      setAuthError(false);
      try {
        const [qpRes, measRes, habitsRes, imagesRes] = await Promise.all([
          fetchWithAuth("/api/client/question-progress"),
          fetchWithAuth("/api/client/measurements"),
          fetchWithAuth("/api/client/habits"),
          fetchWithAuth("/api/client/progress-images"),
        ]);

        if (qpRes.status === 401 || measRes.status === 401 || habitsRes.status === 401 || imagesRes.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }

        if (!cancelled) {
          if (qpRes.ok) {
            const data = await qpRes.json();
            setQuestions(Array.isArray(data.questions) ? data.questions : []);
            setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
            setGrid(typeof data.grid === "object" && data.grid !== null ? data.grid : {});
          } else {
            setQpError("Could not load question progress.");
          }

          if (measRes.ok) {
            const data = await measRes.json();
            setMeasurementList(Array.isArray(data) ? data : []);
          }

          if (habitsRes.ok) {
            const data = await habitsRes.json();
            setHabitsData({
              habits: Array.isArray(data.habits) ? data.habits : [],
              history: data.history,
            });
          }

          if (imagesRes.ok) {
            const data = await imagesRes.json();
            setProgressImages(Array.isArray(data) ? data : []);
          }
        }
      } catch {
        if (!cancelled) setQpError("Could not load progress.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth]);

  const chartData = useMemo(() => {
    if (chartMetric === "arms" || chartMetric === "thighs") return [];
    const chronological = [...measurementList].filter((m) => m.date).reverse();
    return chronological
      .map((m) => {
        let value: number | null = null;
        if (chartMetric === "bodyWeight") value = m.bodyWeight ?? null;
        else value = m.measurements?.[chartMetric] ?? null;
        if (value == null) return null;
        return { date: m.date!, value };
      })
      .filter((p): p is { date: string; value: number } => p != null);
  }, [measurementList, chartMetric]);

  const comparisonChartData = useMemo(() => {
    if (chartMetric !== "arms" && chartMetric !== "thighs") return [];
    const keys = chartMetric === "arms" ? (["leftArm", "rightArm"] as const) : (["leftThigh", "rightThigh"] as const);
    const chronological = [...measurementList]
      .filter((m) => m.date)
      .sort((a, b) => (a.date!).localeCompare(b.date!));
    return chronological
      .map((m) => {
        const row: Record<string, number | undefined> = { date: m.date! };
        for (const k of keys) row[k] = m.measurements?.[k] ?? undefined;
        return row;
      })
      .filter((row) => keys.some((k) => row[k] != null));
  }, [measurementList, chartMetric]);

  const { baselinePhoto, currentPhoto } = useMemo(() => {
    const before = progressImages.filter((img) => img.imageType && BEFORE_TYPES.includes(img.imageType));
    const after = progressImages.filter((img) => img.imageType && AFTER_TYPES.includes(img.imageType));
    const byDate = (a: ProgressImage, b: ProgressImage) => {
      const ta = a.uploadedAt || "";
      const tb = b.uploadedAt || "";
      return ta.localeCompare(tb);
    };
    return {
      baselinePhoto: before.length > 0 ? [...before].sort(byDate)[0] : null,
      currentPhoto: after.length > 0 ? [...after].sort(byDate).pop()! : progressImages[0] ?? null,
    };
  }, [progressImages]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Your Progress</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Question scores, measurements, habits, and photos in one place.
        </p>
      </div>

      {loading && (
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Habit trackers: desktop = col 1 row 1 (above question progress) */}
          <section className="min-w-0 md:col-start-1 md:row-start-1">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Habit trackers</h2>
            {habitsData?.history ? (
              <>
                <div className="mb-3 flex gap-1 rounded-lg bg-[var(--color-bg)] p-1">
                  {(["7d", "30d", "all"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStripRange(r)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        stripRange === r
                          ? "bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {r === "7d" ? "This week" : r === "30d" ? "1 month" : "All time"}
                    </button>
                  ))}
                </div>
                <HabitWeeklyStrip
                  habits={habitsData.habits}
                  byDate={habitsData.history.byDate}
                  range={stripRange}
                  historyStart={stripRange === "all" ? habitsData.history.start : undefined}
                  historyEnd={stripRange === "all" ? habitsData.history.end : undefined}
                />
                <Link href="/client/habits" className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline">
                  Log habits →
                </Link>
              </>
            ) : (
              <Card className="p-6">
                <p className="text-[var(--color-text-muted)]">Log your daily habits to see your streak and history here.</p>
                <Link href="/client/habits" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
                  Go to Habits →
                </Link>
              </Card>
            )}
          </section>

          {/* Question progress (check-in): desktop = col 1 row 2 */}
          <section className="min-w-0 md:col-start-1 md:row-start-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Question progress over time</h2>
            {qpError && (
              <p className="text-sm text-[var(--color-error)]" role="alert">{qpError}</p>
            )}
            {!qpError && questions.length > 0 && weeks.length > 0 && (
              <>
                <Card className="p-4 mb-3">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                    Per-question traffic light (fixed scale 0–10)
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
                      <span className="text-[var(--color-text)]">Good (7–10)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden />
                      <span className="text-[var(--color-text)]">Moderate (4–6)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
                      <span className="text-[var(--color-text)]">Needs attention (0–3)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-[var(--color-border)]" aria-hidden />
                      <span className="text-[var(--color-text)]">Not scored</span>
                    </span>
                  </div>
                </Card>
                <Card className="overflow-x-auto p-0">
                  <table className="w-full min-w-[600px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                        <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Question</th>
                        {weeks.map((w) => (
                          <th key={w.key} className="px-2 py-2 text-center font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                            {w.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr key={q.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]/50">
                          <td className="px-3 py-2 text-[var(--color-text)] max-w-[200px] truncate" title={q.text}>
                            {q.text}
                          </td>
                          {weeks.map((w) => {
                            const score = grid[q.id]?.[w.key];
                            const band = score != null ? getBand(score) : null;
                            return (
                              <td key={w.key} className="px-2 py-2 text-center">
                                <span
                                  className={`inline-block h-4 w-4 rounded-full ${
                                    band === "green" ? "bg-green-500"
                                    : band === "orange" ? "bg-amber-500"
                                    : band === "red" ? "bg-red-500"
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
              </>
            )}
            {!qpError && (questions.length === 0 || weeks.length === 0) && (
              <Card className="p-6">
                <p className="text-[var(--color-text-muted)]">Complete check-ins to see your question progress here.</p>
                <Link href="/client/check-in/new" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
                  New check-in →
                </Link>
              </Card>
            )}
          </section>

          {/* Weight & measurement trends: desktop = col 2 row 1 (so gallery can sit under it) */}
          <section className="min-w-0 md:col-start-2 md:row-start-1">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Weight & measurement trends</h2>
            <Card className="p-4">
              {measurementList.length === 0 ? (
                <>
                  <p className="text-[var(--color-text-muted)]">No measurements yet. Add your first entry to see trends.</p>
                  <Link href="/client/measurements" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
                    Add measurement →
                  </Link>
                </>
              ) : (
                <>
                  <label className="sr-only" htmlFor="progress-chart-metric">Metric</label>
                  <select
                    id="progress-chart-metric"
                    value={chartMetric}
                    onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                    className="mb-4 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  >
                    <option value="bodyWeight">Body weight (kg)</option>
                    <option value="arms">Arms (L &amp; R)</option>
                    <option value="thighs">Thighs (L &amp; R)</option>
                    {MEASUREMENT_KEYS.map((key) => (
                      <option key={key} value={key}>{measurementLabels[key]} (cm)</option>
                    ))}
                  </select>
                  {chartMetric === "arms" || chartMetric === "thighs" ? (
                    comparisonChartData.length > 0 ? (
                      <MeasurementComparisonChartLazy
                        data={comparisonChartData}
                        unit="cm"
                        series={
                          chartMetric === "arms"
                            ? [
                                { dataKey: "leftArm", name: "L arm", color: "var(--color-primary)" },
                                { dataKey: "rightArm", name: "R arm", color: "#0ea5e9", strokeDasharray: "6 4" },
                              ]
                            : [
                                { dataKey: "leftThigh", name: "L thigh", color: "var(--color-primary)" },
                                { dataKey: "rightThigh", name: "R thigh", color: "#0ea5e9", strokeDasharray: "6 4" },
                              ]
                        }
                      />
                    ) : (
                      <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No data yet. Add measurements to compare L &amp; R.</p>
                    )
                  ) : chartData.length > 0 ? (
                    <MeasurementLineChartLazy
                      data={chartData}
                      unit={chartMetric === "bodyWeight" ? "kg" : "cm"}
                    />
                  ) : (
                    <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No data for this metric yet.</p>
                  )}
                  <Link href="/client/measurements" className="mt-3 inline-block text-sm text-[var(--color-primary)] hover:underline">
                    View all measurements →
                  </Link>
                </>
              )}
            </Card>
          </section>

          {/* Before & current photos: desktop = col 2 row 2 (right underneath the graph) */}
          <section className="min-w-0 md:col-start-2 md:row-start-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Before & current photos</h2>
            <Card className="p-4">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Baseline / First before</h3>
                  {baselinePhoto ? (
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <Image
                        src={baselinePhoto.imageUrl}
                        alt={baselinePhoto.caption || "Before"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        unoptimized
                      />
                      {baselinePhoto.uploadedAt && (
                        <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white">
                          {formatDateDisplay(baselinePhoto.uploadedAt)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-center p-4">
                      <p className="text-sm text-[var(--color-text-muted)]">No before photo yet</p>
                      <Link href="/client/progress-photos" className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:underline">
                        Upload photo
                      </Link>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">Current</h3>
                  {currentPhoto ? (
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <Image
                        src={currentPhoto.imageUrl}
                        alt={currentPhoto.caption || "Current"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                        unoptimized
                      />
                      {currentPhoto.uploadedAt && (
                        <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white">
                          {formatDateDisplay(currentPhoto.uploadedAt)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-center p-4">
                      <p className="text-sm text-[var(--color-text-muted)]">No current photo yet</p>
                      <Link href="/client/progress-photos" className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:underline">
                        Upload photo
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <Link href="/client/progress-photos" className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline">
                Manage all photos →
              </Link>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
