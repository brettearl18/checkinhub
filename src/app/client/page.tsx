"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ClientDashboardBadges } from "@/components/client/ClientDashboardBadges";
import { HabitWeeklyStrip } from "@/components/client/HabitWeeklyStrip";
import { CheckInProgressChart } from "@/components/ui/CheckInProgressChart";
import { MeasurementLineChartLazy } from "@/components/ui/MeasurementLineChartLazy";
import { useApiClient } from "@/lib/api-client";
import { formatDateDdMmYyyy, formatDateTimeDisplay } from "@/lib/format-date";
import { pickBaselineAndCurrentPhoto, progressPhotoPoseLabel } from "@/lib/progress-comparison-photos";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";

interface Assignment {
  id: string;
  formId: string;
  formTitle: string;
  reflectionWeekStart?: string;
  status: string;
  dueDate: string | null;
}

interface Profile {
  firstName: string;
  lastName: string;
  profilePersonalization?: { showQuote?: boolean; quote?: string | null };
  paymentStatus: string | null;
  mealPlanLinks: { label: string; url: string }[];
  mealPlanJson?: Record<string, unknown> | null;
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

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

/** All Monday dates (YYYY-MM-DD) from first through last, inclusive. */
function allMondaysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  const start = new Date(first + "T12:00:00Z");
  const end = new Date(last + "T12:00:00Z");
  if (start.getTime() > end.getTime()) return [];
  const d = new Date(start);
  while (d.getTime() <= end.getTime()) {
    out.push(
      d.getUTCFullYear() +
        "-" +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getUTCDate()).padStart(2, "0")
    );
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** Traffic-light band from score; uses client thresholds when provided. */
function getBand(
  score: number,
  redMax: number = 40,
  orangeMax: number = 70
): "green" | "orange" | "red" {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

interface RecentResponse {
  id: string;
  formTitle: string;
  completedAt: string | null;
  responseId: string | null;
  score: number | null;
  readByClient?: boolean;
}

interface SetupStatus {
  hasBaselineMeasurement: boolean;
  hasProgressPhoto: boolean;
  hasPushEnabled: boolean;
}

const QUICK_LINKS = [
  { href: "/client/history", label: "Check-in history", description: "Past check-ins & feedback", emoji: "📋" },
  { href: "/client/progress", label: "Progress", description: "Scores, measurements, habits & photos", emoji: "📊" },
  { href: "/client/goals", label: "Goals", description: "Track your progress", emoji: "🎯" },
  { href: "/client/measurements", label: "Measurements", description: "Weight & measurements", emoji: "📏" },
  { href: "/client/progress-photos", label: "Progress photos", description: "Baseline & current by pose", emoji: "📸" },
  { href: "/client/messages", label: "Messages", description: "Chat with your coach", emoji: "💬" },
  { href: "/client/profile", label: "Profile", description: "Your details & settings", emoji: "👤" },
] as const;

const MOTIVATIONAL_LINES = [
  "Every check-in is a step forward.",
  "You're building something great.",
  "Small steps lead to big changes.",
  "Stay consistent—you've got this.",
  "Your progress matters.",
];

function getGreeting(firstName: string | null): string {
  if (!firstName) return "Welcome back.";
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

export default function ClientPortalPage() {
  const { fetchWithAuth } = useApiClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [habitStreakSummary, setHabitStreakSummary] = useState<{ current: number; longest: number } | null>(null);
  const [questionProgress, setQuestionProgress] = useState<{
    questions: Array<{ id: string; text: string }>;
    weeks: WeekLabel[];
    grid: Record<string, Record<string, number>>;
    weekOverallScore?: Record<string, number>;
    trafficLightRedMax: number;
    trafficLightOrangeMax: number;
  } | null>(null);
  const [measurementList, setMeasurementList] = useState<Measurement[]>([]);
  const [habitsData, setHabitsData] = useState<{
    habits: Array<{ id: string; label: string }>;
    history?: { start: string; end: string; byDate: Record<string, Record<string, "met" | "missed">> };
  } | null>(null);
  const [markingMissedId, setMarkingMissedId] = useState<string | null>(null);
  const [markMissedError, setMarkMissedError] = useState<string | null>(null);
  const markAssignmentMissed = useCallback(
    async (assignmentId: string) => {
      const a = assignments.find((x) => x.id === assignmentId);
      const started = a?.status === "started";
      const weekPhrase = a?.reflectionWeekStart
        ? `the week of ${formatDateDdMmYyyy(a.reflectionWeekStart)}`
        : "this check-in";
      const msg = started
        ? `Mark as missed? Your saved progress for ${weekPhrase} will be discarded and it will be removed from your to-do list.`
        : `Mark the check-in for ${weekPhrase} as missed? It will be removed from your to-do list.`;
      if (!window.confirm(msg)) return;
      setMarkMissedError(null);
      setMarkingMissedId(assignmentId);
      try {
        const res = await fetchWithAuth(`/api/check-in/${assignmentId}/mark-missed`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMarkMissedError(typeof body?.error === "string" ? body.error : "Could not mark as missed.");
          return;
        }
        setAssignments((prev) => prev.filter((x) => x.id !== assignmentId));
      } catch {
        setMarkMissedError("Could not mark as missed.");
      } finally {
        setMarkingMissedId(null);
      }
    },
    [assignments, fetchWithAuth]
  );

  // TO DO / banner: show past weeks, this calendar week (from Monday), and future weeks only after Friday 9am Perth opens that week.
  const openAssignments = useMemo(() => {
    const thisMonday = thisMondayPerth();
    return assignments.filter(
      (a) =>
        !a.reflectionWeekStart ||
        a.reflectionWeekStart <= thisMonday ||
        isWeekOpenPerth(a.reflectionWeekStart)
    );
  }, [assignments]);

  // Started but not finished – show at top so they see it.
  const resumeAssignments = useMemo(
    () => assignments.filter((a) => a.status === "started"),
    [assignments]
  );
  // Any open check-in to complete (open week) – show at top; prefer "started" first so in-progress is most visible.
  const topPriorityAssignments = useMemo(() => {
    if (resumeAssignments.length > 0) return resumeAssignments;
    return openAssignments;
  }, [resumeAssignments, openAssignments]);

  const loadData = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    setMarkMissedError(null);
    try {
      const [profileRes, assignmentsRes, historyRes, imagesRes, setupRes, habitsRes, qpRes, measRes] = await Promise.all([
        fetchWithAuth("/api/client/profile"),
        fetchWithAuth("/api/check-in/assignments"),
        fetchWithAuth("/api/client/history"),
        fetchWithAuth("/api/client/progress-images"),
        fetchWithAuth("/api/client/setup-status"),
        fetchWithAuth("/api/client/habits"),
        fetchWithAuth("/api/client/question-progress"),
        fetchWithAuth("/api/client/measurements"),
      ]);
      if (profileRes.status === 401 || assignmentsRes.status === 401 || historyRes.status === 401 || imagesRes.status === 401 || habitsRes.status === 401 || qpRes.status === 401 || measRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (setupRes.ok) {
        const s = await setupRes.json();
        setSetupStatus({
          hasBaselineMeasurement: s.hasBaselineMeasurement === true,
          hasProgressPhoto: s.hasProgressPhoto === true,
          hasPushEnabled: s.hasPushEnabled === true,
        });
      } else {
        setSetupStatus(null);
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile({
          ...p,
          paymentStatus: p.paymentStatus ?? null,
          mealPlanLinks: Array.isArray(p.mealPlanLinks) ? p.mealPlanLinks : [],
          mealPlanJson:
            p.mealPlanJson && typeof p.mealPlanJson === "object" && !Array.isArray(p.mealPlanJson)
              ? p.mealPlanJson
              : null,
        });
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(Array.isArray(data) ? data : []);
      } else {
        const body = await assignmentsRes.json().catch(() => ({}));
        setError((body && typeof body.error === "string") ? body.error : "Could not load check-ins.");
      }
      if (historyRes.ok) {
        const history = await historyRes.json();
        const list = Array.isArray(history) ? history : [];
        const unread = list.filter((item: { readByClient?: boolean }) => item.readByClient !== true);
        setRecentResponses(
          unread.slice(0, 2).map((item: { id: string; formTitle?: string; completedAt?: string | null; responseId?: string | null; score?: number | null; readByClient?: boolean }) => ({
            id: item.id,
            formTitle: item.formTitle ?? "Check-in",
            completedAt: item.completedAt ?? null,
            responseId: item.responseId ?? null,
            score: item.score ?? null,
            readByClient: item.readByClient === true,
          }))
        );
      } else {
        setRecentResponses([]);
      }
      if (imagesRes.ok) {
        const list = await imagesRes.json();
        const fullList = Array.isArray(list) ? list : [];
        setProgressImages(fullList);
      }
      if (habitsRes.ok) {
        const data = await habitsRes.json();
        setHabitsData({
          habits: Array.isArray(data.habits) ? data.habits : [],
          history: data.history,
        });
        const streaks = data.streaks ?? {};
        let current = 0;
        let longest = 0;
        for (const s of Object.values(streaks) as { current?: number; longest?: number }[]) {
          if (s?.current != null && s.current > current) current = s.current;
          if (s?.longest != null && s.longest > longest) longest = s.longest;
        }
        setHabitStreakSummary(current > 0 || longest > 0 ? { current, longest } : null);
      } else {
        setHabitsData(null);
        setHabitStreakSummary(null);
      }
      if (qpRes.ok) {
        const data = await qpRes.json();
        const redMax = typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40;
        const orangeMax = typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70;
        setQuestionProgress({
          questions: Array.isArray(data.questions) ? data.questions : [],
          weeks: Array.isArray(data.weeks) ? data.weeks : [],
          grid: typeof data.grid === "object" && data.grid !== null ? data.grid : {},
          weekOverallScore: typeof data.weekOverallScore === "object" && data.weekOverallScore !== null ? data.weekOverallScore : undefined,
          trafficLightRedMax: redMax,
          trafficLightOrangeMax: orangeMax,
        });
      } else {
        setQuestionProgress(null);
      }
      if (measRes.ok) {
        const data = await measRes.json();
        setMeasurementList(Array.isArray(data) ? data : []);
      } else {
        setMeasurementList([]);
      }
    } catch {
      setError("Could not load check-ins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fetchWithAuth]);

  // Refetch when user returns to dashboard (e.g. after adding measurement, photo, or enabling notifications)
  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchWithAuth]);

  const firstName = profile?.firstName?.trim() ?? null;
  const showQuote = profile?.profilePersonalization?.showQuote && profile?.profilePersonalization?.quote;
  const motivationalLine = MOTIVATIONAL_LINES[firstName ? firstName.length % MOTIVATIONAL_LINES.length : 0];

  const setupIncomplete =
    setupStatus &&
    (!setupStatus.hasBaselineMeasurement || !setupStatus.hasProgressPhoto || !setupStatus.hasPushEnabled);

  // Compact progress snapshot: chart (body weight only) and before/current photos
  const progressSnapshotChartData = useMemo(() => {
    const sorted = [...measurementList]
      .filter((m) => m.date != null && (m.bodyWeight != null || (m.measurements && Object.keys(m.measurements).length > 0)))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return sorted.map((m) => ({
      date: m.date!,
      value: m.bodyWeight ?? undefined,
      label: m.date ?? undefined,
    })).filter((row) => row.value != null) as { date: string; value: number; label?: string }[];
  }, [measurementList]);

  const { baselinePhoto, currentPhoto } = useMemo(
    () => pickBaselineAndCurrentPhoto(progressImages),
    [progressImages]
  );

  const comparisonPoseLabel = useMemo(
    () => progressPhotoPoseLabel(baselinePhoto?.imageType ?? currentPhoto?.imageType ?? null),
    [baselinePhoto, currentPhoto]
  );

  // Total check-in % (last 3 weeks): prefer per-week overall score so it matches history and chart
  const questionProgressSummary = useMemo(() => {
    if (!questionProgress?.weeks?.length) return null;
    const weeks = questionProgress.weeks.slice(-3);
    const redMax = questionProgress.trafficLightRedMax ?? 40;
    const orangeMax = questionProgress.trafficLightOrangeMax ?? 70;
    const weekOverallScore = questionProgress.weekOverallScore;
    if (weekOverallScore) {
      let sum = 0;
      let count = 0;
      for (const w of weeks) {
        const s = weekOverallScore[w.key];
        if (typeof s === "number") {
          sum += s;
          count += 1;
        }
      }
      if (count === 0) return null;
      const pct = Math.round(sum / count);
      return { pct, band: getBand(pct, redMax, orangeMax) };
    }
    if (!questionProgress.questions?.length) return null;
    let sum = 0;
    let count = 0;
    for (const q of questionProgress.questions) {
      for (const w of weeks) {
        const score = questionProgress.grid[q.id]?.[w.key];
        if (typeof score === "number") {
          sum += score;
          count += 1;
        }
      }
    }
    if (count === 0) return null;
    const pct = Math.round(sum / count);
    return { pct, band: getBand(pct, redMax, orangeMax) };
  }, [questionProgress]);

  // Weekly check-in % for the line chart: use overall score per week (matches history); null for missed weeks (line breaks)
  const checkInWeeklySeries = useMemo(() => {
    if (!questionProgress?.weeks?.length) return [];
    const { weeks, weekOverallScore, questions, grid } = questionProgress;
    const hasScore = (weekKey: string) => {
      if (weekOverallScore && typeof weekOverallScore[weekKey] === "number") return true;
      if (!questions?.length) return false;
      for (const q of questions) {
        if (typeof grid[q.id]?.[weekKey] === "number") return true;
      }
      return false;
    };
    const firstKey = weeks[0].key;
    const lastKey = weeks[weeks.length - 1].key;
    const allWeekKeys = allMondaysBetween(firstKey, lastKey);
    return allWeekKeys.map((weekKey) => {
      const w = weeks.find((x) => x.key === weekKey);
      const label = w?.label ?? weekKey;
      const value =
        weekOverallScore != null && typeof weekOverallScore[weekKey] === "number"
          ? weekOverallScore[weekKey]
          : hasScore(weekKey)
            ? (() => {
                if (!questions?.length) return null;
                let sum = 0;
                let count = 0;
                for (const q of questions) {
                  const s = grid[q.id]?.[weekKey];
                  if (typeof s === "number") {
                    sum += s;
                    count += 1;
                  }
                }
                return count > 0 ? Math.round(sum / count) : null;
              })()
            : null;
      return { weekKey, label, value };
    });
  }, [questionProgress]);

  return (
    <div className="min-h-[60vh]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="vana-section-label">Dashboard</p>
        <Link
          href="/client2"
          className="inline-flex items-center rounded-full border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
        >
          Try the new dashboard →
        </Link>
      </div>

      {/* Hero: welcoming, motivational + check-in % highlight */}
      <header className="vana-hero p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="vana-page-title">
              {getGreeting(firstName)}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-600">
              {motivationalLine}
            </p>
            {showQuote && (
              <p className="mt-3 text-sm italic text-stone-500">
                &ldquo;{profile?.profilePersonalization?.quote ?? ""}&rdquo;
              </p>
            )}
            <Link
              href="/client/profile#body-weight"
              className="mt-4 inline-flex items-center rounded-full border border-stone-200/80 bg-[#faf7f2] px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              Log body weight
            </Link>
          </div>
          {!loading && questionProgressSummary && (
            <div
              className={`flex-shrink-0 rounded-2xl border px-5 py-4 text-center shadow-sm ${
                questionProgressSummary.band === "green"
                  ? "border-emerald-200/80 bg-emerald-50"
                  : questionProgressSummary.band === "orange"
                    ? "border-amber-200/80 bg-amber-50"
                    : "border-rose-200/80 bg-rose-50"
              }`}
            >
              <span
                className={`font-display block text-3xl font-medium tabular-nums sm:text-4xl ${
                  questionProgressSummary.band === "green"
                    ? "text-emerald-700"
                    : questionProgressSummary.band === "orange"
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {questionProgressSummary.pct}%
              </span>
              <span className="vana-section-label mt-1 block normal-case tracking-normal text-stone-500">
                Check-in score · last 3 weeks
              </span>
            </div>
          )}
        </div>
      </header>

      {!authError && <ClientDashboardBadges className="mt-5" />}

      {!authError && !loading && markMissedError && (
        <div
          className="mt-4 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {markMissedError}
        </div>
      )}

      {/* First-time setup: baseline measurements, photos, notifications */}
      {!authError && !loading && setupIncomplete && (
        <section className="mt-4">
          <Card className="vana-card overflow-hidden border-2 border-[var(--color-primary-muted)]">
            <div className="p-5">
              <h2 className="font-display text-lg font-medium text-stone-800">Complete your setup</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Add your baseline, a photo, and turn on notifications so you don’t miss habits and check-ins.
              </p>
              <ul className="mt-3 space-y-2">
                <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">Baseline measurements</span>
                  {setupStatus!.hasBaselineMeasurement ? (
                    <span className="text-xs text-[var(--color-success)]">✓ Done</span>
                  ) : (
                    <Link href="/client/measurements" className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary)]/90">Add</Link>
                  )}
                </li>
                <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">Progress photo</span>
                  {setupStatus!.hasProgressPhoto ? (
                    <span className="text-xs text-[var(--color-success)]">✓ Done</span>
                  ) : (
                    <Link href="/client/progress-photos" className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary)]/90">Add photo</Link>
                  )}
                </li>
                <li className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">Notifications for habits & check-ins</span>
                  {setupStatus!.hasPushEnabled ? (
                    <span className="text-xs text-[var(--color-success)]">✓ Enabled</span>
                  ) : (
                    <Link href="/client/notifications" className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--color-primary)]/90">Enable</Link>
                  )}
                </li>
              </ul>
            </div>
          </Card>
        </section>
      )}

      {/* Check-in to complete – always at top when there is one (started or open) */}
      {!authError && !loading && topPriorityAssignments.length > 0 && (
        <section className="mt-4">
          <Card className="vana-card overflow-hidden border-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/60">
            <div className="p-5">
              <h2 className="font-display text-lg font-medium text-stone-800">
                {resumeAssignments.length > 0 ? "Finish your check-in" : "You have a check-in to complete"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {resumeAssignments.length > 0 ? "Complete it when you're ready." : "Complete your check-in when you're ready."}
              </p>
              <ul className="mt-3 space-y-2">
                {topPriorityAssignments.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <div className="flex flex-wrap items-stretch gap-2 rounded-lg border border-[var(--color-primary-muted)] bg-[var(--color-bg)] px-3 py-2.5 transition-all hover:border-[var(--color-primary)]">
                      <Link
                        href={`/client/check-in/${a.id}`}
                        className="min-w-0 flex-1 text-left transition-colors hover:bg-[var(--color-primary-subtle)]/30 rounded-md -m-1 p-1"
                      >
                        <span className="text-sm font-semibold text-[var(--color-text)]">{a.formTitle}</span>
                        {a.reflectionWeekStart && (
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            Week of {formatDateDdMmYyyy(a.reflectionWeekStart)}
                          </p>
                        )}
                      </Link>
                      <div className="flex flex-shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end">
                        <Link
                          href={`/client/check-in/${a.id}`}
                          className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)] whitespace-nowrap"
                        >
                          {a.status === "started" ? "Resume →" : "Start →"}
                        </Link>
                        <button
                          type="button"
                          disabled={markingMissedId === a.id}
                          onClick={() => markAssignmentMissed(a.id)}
                          className="inline-flex items-center justify-center rounded-full border border-stone-200/80 bg-transparent px-3 py-1.5 text-xs font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 disabled:opacity-60 whitespace-nowrap"
                        >
                          {markingMissedId === a.id ? "…" : "Mark as missed"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {topPriorityAssignments.length > 3 && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">+{topPriorityAssignments.length - 3} more below</p>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Recent check-in responses – prominent, right under hero */}
      {!authError && !loading && recentResponses.length > 0 && (
        <section className="mt-4">
          <Card className="vana-card overflow-hidden">
            <div className="p-5">
              <h2 className="font-display text-lg font-medium text-stone-800">Your recent check-in responses</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">View your answers and coach feedback</p>
              <ul className="mt-3 space-y-2">
                {recentResponses.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={r.responseId ? `/client/response/${r.responseId}` : "/client/history"}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-left transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]/50"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-[var(--color-text)]">{r.formTitle}</span>
                        {r.responseId && !r.readByClient && (
                          <span className="ml-1.5 rounded bg-[var(--color-primary)] px-1 py-0.5 text-[10px] font-medium text-white">New</span>
                        )}
                        {r.completedAt && (
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatDateTimeDisplay(r.completedAt)}</p>
                        )}
                        {typeof r.score === "number" && (
                          <p className="mt-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Score: {r.score}%</p>
                        )}
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)]">
                        {r.responseId ? "View response →" : "View history →"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/client/history" className="mt-3 inline-block text-xs font-medium text-[var(--color-primary)] hover:underline">
                View all check-in history →
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* Your check-in + Habits: two columns, even spacing */}
      <section className="mt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <div className="min-w-0 flex flex-col">
            <h2 className="vana-section-label mb-2">
              Your check-in
            </h2>
            <Card className="vana-card flex-1 flex flex-col overflow-hidden">
              <div className="p-3 flex flex-col flex-1">
                <p className="text-base font-semibold text-[var(--color-text)]">
                  {openAssignments.length > 0 ? "You have a check-in to complete" : "Start your check-in"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {openAssignments.length > 0 ? "Choose which week you're filling in—catch up or do this week." : "A quick reflection to keep your momentum going."}
                </p>
                <div className="mt-2.5">
                  <Button asChild variant="primary" className="!py-1.5 !min-h-0 text-sm">
                    <Link href="/client/check-in/new">Fill in a check-in</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          <div className="min-w-0 flex flex-col">
            <h2 className="vana-section-label mb-2">
              Habits
            </h2>
            <Card className="vana-card flex-1 flex flex-col overflow-hidden">
              <div className="p-3 flex flex-col flex-1">
                <p className="text-base font-semibold text-[var(--color-text)]">Habit tracker</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Steps, hydration, sleep. Log today and keep your streak.
                </p>
                {habitStreakSummary && (
                  <p className="mt-1.5 text-xs font-medium text-[var(--color-primary)]">
                    {habitStreakSummary.current > 0
                      ? `🔥 ${habitStreakSummary.current}-day streak — log today to keep it!`
                      : `Your best: ${habitStreakSummary.longest} days. Log today to start a new streak!`}
                  </p>
                )}
                <div className="mt-2.5">
                  <Button asChild variant="primary" className="!py-1.5 !min-h-0 text-sm">
                    <Link href="/client/habits">Open Habit Tracker</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* To do, Payments, Meal plan: compact cards */}
      {!authError && !loading && (
        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* To do – only when check-ins are open (week has opened, e.g. Friday 9am Perth for this/next week) */}
            {openAssignments.length > 0 && (
              <Card className="vana-card p-5">
                <h3 className="vana-section-label mb-2">
                  To do
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {openAssignments.length} check-in{openAssignments.length !== 1 ? "s" : ""} open
                </p>
                <ul className="space-y-1.5">
                  {openAssignments.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2 last:border-0 last:pb-0">
                      <Link
                        href={`/client/check-in/${a.id}`}
                        className="min-w-0 flex-1 py-1.5 text-sm text-[var(--color-primary)] hover:underline min-h-[44px] flex items-center"
                      >
                        {a.formTitle}
                        {a.reflectionWeekStart ? ` (week of ${formatDateDdMmYyyy(a.reflectionWeekStart)})` : ""} →
                      </Link>
                      <button
                        type="button"
                        disabled={markingMissedId === a.id}
                        onClick={() => markAssignmentMissed(a.id)}
                        className="flex-shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-60 min-h-[44px]"
                      >
                        {markingMissedId === a.id ? "…" : "Mark missed"}
                      </button>
                    </li>
                  ))}
                  {openAssignments.length > 3 && (
                    <li>
                      <Link href="/client/check-in/new" className="block py-1.5 text-sm text-[var(--color-text-muted)] hover:underline min-h-[44px] flex items-center">
                        +{openAssignments.length - 3} more…
                      </Link>
                    </li>
                  )}
                </ul>
              </Card>
            )}
            {/* Payments */}
            <Card className="vana-card p-5">
              <h3 className="vana-section-label mb-2">
                Payments
              </h3>
              {profile?.paymentStatus === "paid" ? (
                <p className="text-sm font-medium text-emerald-700">Paid up</p>
              ) : profile?.paymentStatus === "failed" || profile?.paymentStatus === "past_due" ? (
                <>
                  <p className="text-sm font-medium text-amber-700">Action needed</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    You have an outstanding payment. Pay securely below or contact your coach.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-3"
                    disabled={payLinkLoading}
                    onClick={async () => {
                      setPayLinkLoading(true);
                      try {
                        const res = await fetchWithAuth("/api/client/billing/pay-link");
                        const data = await res.json().catch(() => ({}));
                        if (data?.url) {
                          window.open(data.url, "_blank", "noopener,noreferrer");
                        } else {
                          window.alert("No payment link is available right now. Please contact your coach to pay.");
                        }
                      } finally {
                        setPayLinkLoading(false);
                      }
                    }}
                  >
                    {payLinkLoading ? "Opening…" : "Pay now"}
                  </Button>
                </>
              ) : profile?.paymentStatus ? (
                <p className="text-sm font-medium text-amber-700">Action needed</p>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No payment linked</p>
              )}
              {(profile?.paymentStatus === "paid" || !profile?.paymentStatus) && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Your coach manages billing. Contact them if you need to update payment.
                </p>
              )}
            </Card>
            {/* Meal plan */}
            <Card className="vana-card p-5">
              <h3 className="vana-section-label mb-2">
                Meal plan
              </h3>
              <a
                href={RECIPE_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                {profile?.mealPlanLinks?.[0]?.label?.trim() || "Open meal plan"} →
              </a>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Recipes and meal ideas at meals.vanahealth.com.au
              </p>
            </Card>
          </div>
        </section>
      )}

      {/* Error / loading / empty – no long list of check-ins; week picker is the entry point */}
      <section className="mt-6">
        {authError && <AuthErrorRetry onRetry={loadData} />}
        {!authError && error && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
            <Button variant="ghost" onClick={loadData}>Retry</Button>
          </div>
        )}
        {!authError && loading && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          </div>
        )}
        {!authError && !loading && assignments.length === 0 && (
          <EmptyState
            title="No check-ins to do"
            description="When your coach assigns check-ins, use the button above to choose a week and fill one in."
            actionLabel="New check-in"
            actionHref="/client/check-in/new"
          />
        )}
      </section>

      {/* Your progress: compact snapshot with View more → progress page */}
      {!authError && !loading && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="vana-section-label">
              Your progress
            </h2>
            <Link href="/client/progress" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
              View more →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Check-in progress: weekly % line chart with client-specific traffic-light bands */}
            <Card className="vana-card flex flex-col min-h-[280px] p-4">
              <h3 className="vana-section-label mb-2 normal-case tracking-normal text-stone-600">Check-in progress</h3>
              {checkInWeeklySeries.length > 0 && questionProgress ? (
                <>
                  <div className="flex-1 min-h-[200px] w-full min-w-0">
                    <CheckInProgressChart
                      data={checkInWeeklySeries}
                      redMax={questionProgress.trafficLightRedMax ?? 40}
                      orangeMax={questionProgress.trafficLightOrangeMax ?? 70}
                      height={200}
                    />
                  </div>
                  {questionProgressSummary && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      Your ranges: red 0–{questionProgress.trafficLightRedMax}%, orange {questionProgress.trafficLightRedMax}–{questionProgress.trafficLightOrangeMax}%, green {questionProgress.trafficLightOrangeMax}–100%
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">Complete check-ins to see your weekly score trend.</p>
              )}
            </Card>

            {/* Weight (compact chart) – row 1 */}
            <Card className="vana-card flex flex-col min-h-[280px] p-4">
              <h3 className="vana-section-label mb-2 normal-case tracking-normal text-stone-600">Weight</h3>
              {progressSnapshotChartData.length > 0 ? (
                <div className="flex-1 min-h-[200px] w-full min-w-0">
                  <MeasurementLineChartLazy
                    data={progressSnapshotChartData}
                    unit="kg"
                    height={200}
                  />
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">Add measurements to see trends.</p>
              )}
            </Card>

            {/* Habit trackers – row 2 */}
            <Card className="vana-card flex flex-col min-h-[280px] p-4">
              <h3 className="vana-section-label mb-2 normal-case tracking-normal text-stone-600">Habits this week</h3>
              {habitsData?.history?.byDate ? (
                <div className="scale-90 origin-top-left w-[111%] min-w-0 flex-1 min-h-0">
                  <HabitWeeklyStrip
                    habits={habitsData.habits}
                    byDate={habitsData.history.byDate}
                    range="7d"
                  />
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">Log habits to see your week.</p>
              )}
            </Card>

            {/* Before & current photos – row 2 */}
            <Card className="vana-card flex flex-col min-h-[280px] p-4">
              <h3 className="vana-section-label mb-2 normal-case tracking-normal text-stone-600">Before & current</h3>
              {baselinePhoto || currentPhoto ? (
                <div className="flex gap-3 w-full flex-1 min-h-0">
                  {baselinePhoto && (
                    <a
                      href={baselinePhoto.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 flex flex-col rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]"
                    >
                      <div className="w-full aspect-square min-h-0 relative bg-[var(--color-bg)]">
                        <Image
                          src={baselinePhoto.imageUrl}
                          alt="Before"
                          width={120}
                          height={120}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--color-text-muted)] py-0.5 text-center shrink-0">
                        Before{comparisonPoseLabel ? ` (${comparisonPoseLabel})` : ""}
                      </span>
                    </a>
                  )}
                  {currentPhoto && (
                    <a
                      href={currentPhoto.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 flex flex-col rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]"
                    >
                      <div className="w-full aspect-square min-h-0 relative bg-[var(--color-bg)]">
                        <Image
                          src={currentPhoto.imageUrl}
                          alt="Current"
                          width={120}
                          height={120}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-[var(--color-text-muted)] py-0.5 text-center shrink-0">
                        Current{comparisonPoseLabel ? ` (${comparisonPoseLabel})` : ""}
                      </span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center min-h-0">
                  <p className="text-xs text-[var(--color-text-muted)]">Add progress photos to compare over time.</p>
                  <Link
                    href="/client/progress-photos"
                    className="mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Add photos →
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </section>
      )}

      {/* Mini photo gallery */}
      {!authError && !loading && progressImages.length > 0 && (
        <section className="mt-6">
          <h2 className="vana-section-label mb-3">
            Recent photos
          </h2>
          <Card className="vana-card p-5">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {progressImages.slice(0, 6).map((img) => (
                <a
                  key={img.id}
                  href={img.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 block w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]"
                >
                  <img
                    src={img.imageUrl}
                    alt={img.caption || "Progress"}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
            <Link
              href="/client/progress-photos"
              className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View all photos →
            </Link>
          </Card>
        </section>
      )}

      {/* Quick links: toolkit */}
      <section className="mt-8">
        <h2 className="vana-section-label mb-3">
          Quick links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, description, emoji }) => (
            <Link key={href} href={href}>
              <Card className="vana-card h-full p-5 transition-all hover:border-[var(--color-primary-muted)] hover:shadow-md">
                <span className="text-xl leading-none" aria-hidden>{emoji}</span>
                <span className="mt-3 block font-medium text-stone-800">{label}</span>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
