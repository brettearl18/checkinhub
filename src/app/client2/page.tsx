"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ClientDashboardBadges } from "@/components/client/ClientDashboardBadges";
import { ClientProgressCompactPreview } from "@/components/client/ClientProgressCompactPreview";
import { useApiClient } from "@/lib/api-client";
import { formatDateDdMmYyyy, formatDateDisplay, formatDateTimeDisplay } from "@/lib/format-date";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";

interface Assignment {
  id: string;
  formTitle: string;
  reflectionWeekStart?: string;
  status: string;
}

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

interface CheckInScore {
  date: string;
  score: number;
  label?: string;
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  uploadedAt: string | null;
}

function getGreeting(firstName: string | null): string {
  if (!firstName) return "Welcome back";
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function scoreBand(score: number, redMax: number, orangeMax: number): "green" | "orange" | "red" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

export default function ClientDashboard2Page() {
  const { fetchWithAuth } = useApiClient();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [habitStreak, setHabitStreak] = useState(0);
  const [checkInScore, setCheckInScore] = useState<{
    pct: number;
    band: "green" | "orange" | "red";
    redMax: number;
    orangeMax: number;
  } | null>(null);
  const [scoreChartData, setScoreChartData] = useState<CheckInScore[]>([]);
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [coachFeedback, setCoachFeedback] = useState<{
    formTitle: string;
    responseId: string;
    completedAt: string | null;
  } | null>(null);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  const [markingMissedId, setMarkingMissedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const [profileRes, assignmentsRes, measRes, imagesRes, habitsRes, qpRes, historyRes, setupRes] =
        await Promise.all([
          fetchWithAuth("/api/client/profile"),
          fetchWithAuth("/api/check-in/assignments"),
          fetchWithAuth("/api/client/measurements"),
          fetchWithAuth("/api/client/progress-images"),
          fetchWithAuth("/api/client/habits"),
          fetchWithAuth("/api/client/question-progress"),
          fetchWithAuth("/api/client/history"),
          fetchWithAuth("/api/client/setup-status"),
        ]);

      if ([profileRes, assignmentsRes, measRes, imagesRes, habitsRes, qpRes, historyRes].some((r) => r.status === 401)) {
        setAuthError(true);
        return;
      }

      if (profileRes.ok) {
        const p = await profileRes.json();
        setFirstName(p.firstName?.trim() || null);
      }

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(Array.isArray(data) ? data : []);
      }

      if (measRes.ok) {
        const data = await measRes.json();
        setMeasurements(Array.isArray(data) ? data : []);
      }

      if (imagesRes.ok) {
        const data = await imagesRes.json();
        setProgressImages(Array.isArray(data) ? data : []);
      }

      if (habitsRes.ok) {
        const data = await habitsRes.json();
        const streaks = data.streaks ?? {};
        let best = 0;
        for (const s of Object.values(streaks) as { current?: number }[]) {
          if ((s?.current ?? 0) > best) best = s.current ?? 0;
        }
        setHabitStreak(best);
      }

      if (historyRes.ok) {
        const history = await historyRes.json();
        const rows = Array.isArray(history) ? history : [];

        const scores: CheckInScore[] = rows
          .filter(
            (row: { score?: number | null; completedAt?: string | null }) =>
              row.score != null && row.completedAt
          )
          .map(
            (row: { formTitle?: string; completedAt: string; score: number }) => ({
              date: row.completedAt.slice(0, 10),
              score: row.score,
              label: row.formTitle ?? "Check-in",
            })
          )
          .sort((a, b) => a.date.localeCompare(b.date));
        setScoreChartData(scores);

        const unread = rows.find(
          (item: { readByClient?: boolean; responseId?: string }) =>
            item.readByClient !== true && item.responseId
        );
        if (unread) {
          setCoachFeedback({
            formTitle: unread.formTitle ?? "Check-in",
            responseId: unread.responseId,
            completedAt: unread.completedAt ?? null,
          });
        } else {
          setCoachFeedback(null);
        }
      }

      if (qpRes.ok) {
        const data = await qpRes.json();
        const weeks = Array.isArray(data.weeks) ? data.weeks.slice(-3) : [];
        const redMax = typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40;
        const orangeMax = typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70;
        setTrafficLightRedMax(redMax);
        setTrafficLightOrangeMax(orangeMax);
        const weekOverallScore = data.weekOverallScore ?? {};
        let sum = 0;
        let count = 0;
        for (const w of weeks) {
          const s = weekOverallScore[w.key];
          if (typeof s === "number") {
            sum += s;
            count += 1;
          }
        }
        if (count > 0) {
          const pct = Math.round(sum / count);
          setCheckInScore({ pct, band: scoreBand(pct, redMax, orangeMax), redMax, orangeMax });
        } else {
          setCheckInScore(null);
        }
      }

      if (setupRes.ok) {
        const s = await setupRes.json();
        setSetupIncomplete(
          !s.hasBaselineMeasurement || !s.hasProgressPhoto || !s.hasPushEnabled
        );
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const thisMonday = thisMondayPerth();
  const openAssignments = useMemo(
    () =>
      assignments.filter(
        (a) =>
          !a.reflectionWeekStart ||
          a.reflectionWeekStart <= thisMonday ||
          isWeekOpenPerth(a.reflectionWeekStart)
      ),
    [assignments, thisMonday]
  );
  const priorityCheckIn = useMemo(() => {
    const started = openAssignments.filter((a) => a.status === "started");
    if (started.length > 0) return started[0]!;
    return openAssignments[0] ?? null;
  }, [openAssignments]);

  const weightStats = useMemo(() => {
    const withWeight = measurements.filter((m) => m.bodyWeight != null && m.date);
    if (withWeight.length === 0) return null;
    const sorted = [...withWeight].sort((a, b) => a.date!.localeCompare(b.date!));
    const baseline = sorted.find((m) => m.isBaseline) ?? sorted[0]!;
    const latest = sorted[sorted.length - 1]!;
    const change =
      baseline.bodyWeight != null && latest.bodyWeight != null
        ? latest.bodyWeight - baseline.bodyWeight
        : null;
    return { latest, baseline, change };
  }, [measurements]);

  const markMissed = async (assignmentId: string) => {
    setMarkingMissedId(assignmentId);
    try {
      await fetchWithAuth(`/api/check-in/${assignmentId}/mark-missed`, { method: "POST" });
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } finally {
      setMarkingMissedId(null);
    }
  };

  if (authError) return <AuthErrorRetry onRetry={load} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <header className="vana-hero p-5 sm:p-6">
        <p className="vana-section-label mb-2">Home</p>
        <h1 className="vana-page-title">{getGreeting(firstName)}</h1>
        <p className="mt-2 max-w-lg text-sm text-stone-600">
          Your week at a glance — check in, log habits, then dive into Progress for the full picture.
        </p>
      </header>

      {loading ? (
        <Card className="vana-card p-8 text-center text-sm text-stone-500">Loading…</Card>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link href="/client/progress" className="block">
              <Card className="vana-card h-full p-4 transition hover:border-[var(--color-primary-muted)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Check-in score</p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums text-stone-800">
                  {checkInScore ? `${checkInScore.pct}%` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">Last 3 weeks</p>
              </Card>
            </Link>
            <Link href="/client/measurements" className="block">
              <Card className="vana-card h-full p-4 transition hover:border-[var(--color-primary-muted)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Weight</p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums text-stone-800">
                  {weightStats?.latest.bodyWeight != null ? `${weightStats.latest.bodyWeight} kg` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {weightStats?.change != null
                    ? `${weightStats.change > 0 ? "+" : ""}${weightStats.change.toFixed(1)} kg vs baseline`
                    : "Log weight"}
                </p>
              </Card>
            </Link>
            <Link href="/client/habits" className="block">
              <Card className="vana-card h-full p-4 transition hover:border-[var(--color-primary-muted)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Habits</p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums text-stone-800">
                  {habitStreak > 0 ? `${habitStreak}d` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">Current streak</p>
              </Card>
            </Link>
            <Link href="/client/check-in/new" className="block">
              <Card className="vana-card h-full p-4 transition hover:border-[var(--color-primary-muted)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Check-ins</p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums text-stone-800">
                  {openAssignments.length}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">Open this week</p>
              </Card>
            </Link>
          </div>

          <ClientDashboardBadges />

          <ClientProgressCompactPreview
            measurements={measurements}
            progressImages={progressImages}
            scoreChartData={scoreChartData}
            trafficLightRedMax={trafficLightRedMax}
            trafficLightOrangeMax={trafficLightOrangeMax}
            loading={loading}
          />

          {/* Today's focus */}
          <Card
            className={`vana-card overflow-hidden p-5 ${
              priorityCheckIn ? "border-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/40" : ""
            }`}
          >
            <h2 className="font-display text-lg font-medium text-stone-800">Today&apos;s focus</h2>
            {priorityCheckIn ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-800">{priorityCheckIn.formTitle}</p>
                  {priorityCheckIn.reflectionWeekStart && (
                    <p className="text-sm text-stone-500">
                      Week of {formatDateDdMmYyyy(priorityCheckIn.reflectionWeekStart)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/client/check-in/${priorityCheckIn.id}`}>
                      {priorityCheckIn.status === "started" ? "Resume check-in" : "Start check-in"}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={markingMissedId === priorityCheckIn.id}
                    onClick={() => markMissed(priorityCheckIn.id)}
                  >
                    Mark missed
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-stone-600">No open check-ins — keep your habits going.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="primary">
                    <Link href="/client/habits">Log habits</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/client/check-in/new">New check-in</Link>
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {coachFeedback && (
            <Card className="vana-card border-emerald-200/80 bg-emerald-50/50 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Coach feedback</p>
              <p className="mt-1 font-medium text-stone-800">{coachFeedback.formTitle}</p>
              {coachFeedback.completedAt && (
                <p className="text-xs text-stone-500">{formatDateTimeDisplay(coachFeedback.completedAt)}</p>
              )}
              <Button asChild className="mt-3" variant="secondary">
                <Link href={`/client/response/${coachFeedback.responseId}`}>Read feedback</Link>
              </Button>
            </Card>
          )}

          {setupIncomplete && (
            <Card className="vana-card border-dashed border-amber-200 bg-amber-50/40 p-4">
              <p className="text-sm font-medium text-stone-800">Finish setup</p>
              <p className="mt-1 text-xs text-stone-600">
                Add a baseline measurement, progress photo, and enable notifications.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/client/measurements"
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-[var(--color-primary)]"
                >
                  Measurements
                </Link>
                <Link
                  href="/client/progress-photos"
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-[var(--color-primary)]"
                >
                  Photos
                </Link>
                <Link
                  href="/client/notifications"
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-[var(--color-primary)]"
                >
                  Notifications
                </Link>
              </div>
            </Card>
          )}

          {/* Quick utilities */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="vana-card p-4">
              <p className="vana-section-label mb-1">Meal plan</p>
              <p className="text-sm text-stone-600">Recipes and meal ideas in RecipeHUB.</p>
              <a
                href={RECIPE_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Open RecipeHUB ↗
              </a>
            </Card>
            <Card className="vana-card p-4">
              <p className="vana-section-label mb-1">Weight log</p>
              <p className="text-sm text-stone-600">Quick entry from your profile.</p>
              <Link
                href="/client/profile#body-weight"
                className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Log body weight →
              </Link>
            </Card>
          </div>

          <p className="text-center text-xs text-stone-400">
            Preview dashboard —{" "}
            <Link href="/client" className="text-[var(--color-primary)] hover:underline">
              view classic home
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
