"use client";

/**
 * Default client home — VANA redesign (formerly /dashboard3).
 * Classic layout remains available via Profile → Home dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { getClientDashboardPref } from "@/lib/client-dashboard-pref";
import { ClientDashboardBadges } from "@/components/client/ClientDashboardBadges";
import { TodayWeightCard } from "@/components/client/TodayWeightCard";
import { VanaIcon, type VanaIconName } from "@/components/client/VanaIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckInScoreTrendChartLazy } from "@/components/ui/CheckInScoreTrendChartLazy";
import {
  MeasurementPairedSlotTrendChartLazy,
  type PairedSlotChartRow,
} from "@/components/ui/MeasurementPairedSlotTrendChartLazy";
import {
  MeasurementSlotTrendChartLazy,
  type SlotChartRow,
} from "@/components/ui/MeasurementSlotTrendChartLazy";
import { MEASUREMENT_SLOT_COUNT } from "@/components/ui/MeasurementSlotTrendChart";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import { getHabitById } from "@/lib/habits";
import { isWeekOpenPerth, thisMondayPerth, todayPerth } from "@/lib/perth-date";
import { BAND_LABELS } from "@/lib/scoring-utils";
import { WORKOUTS_HUB_URL } from "@/lib/workouts-hub";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";
import {
  DEFAULT_WEATHER_CITY_ID,
  WEATHER_CITIES,
  fetchCityWeather,
  formatLocalTimeLabel,
  getStoredWeatherCityId,
  getWeatherCity,
  isWeatherCityId,
  perthWeatherBackdrop,
  setStoredWeatherCityId,
  type PerthWeather,
  type WeatherCityId,
} from "@/lib/perth-weather";

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

interface HistoryRow {
  responseId?: string;
  formTitle?: string;
  completedAt?: string | null;
  score?: number | null;
  readByClient?: boolean;
}

interface GoalRow {
  id: string;
  title: string;
  status: string;
  progress?: number;
  currentValue?: number;
  targetValue?: number;
}

type ScoreBand = "green" | "orange" | "red";

const BODY_KEYS = [
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "rightThigh", label: "R thigh" },
  { key: "rightArm", label: "R arm" },
  { key: "hips", label: "Hips" },
  { key: "leftThigh", label: "L thigh" },
  { key: "leftArm", label: "L arm" },
] as const;

function getGreeting(firstName: string | null): string {
  if (!firstName) return "Welcome back";
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function scoreBand(score: number, redMax: number, orangeMax: number): ScoreBand {
  if (score <= redMax) return "red";
  if (score <= orangeMax) return "orange";
  return "green";
}

function bandColor(band: ScoreBand): string {
  if (band === "green") return "#248A4C";
  if (band === "orange") return "#BB770F";
  return "#D94A45";
}

function measurementNumeric(value: unknown): number | null {
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

function formatDelta(delta: number, unit = ""): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNum(delta)}${unit}`;
}

function habitOptionLabel(habitId: string, value: string | undefined): string | null {
  if (!value) return null;
  const habit = getHabitById(habitId);
  return habit?.options.find((o) => o.value === value)?.label ?? value;
}

function habitMet(habitId: string, value: string | undefined): boolean | null {
  if (!value) return null;
  const habit = getHabitById(habitId);
  return habit?.options.find((o) => o.value === value)?.goalMet ?? null;
}

function ScoreRing({
  pct,
  band,
  size = 112,
}: {
  pct: number | null;
  band: ScoreBand | null;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = pct == null ? 0 : Math.min(100, Math.max(0, pct)) / 100;
  const color = band ? bandColor(band) : "#DAA450";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECE8E3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-[#1C1A17]">
          {pct != null ? `${pct}%` : "—"}
        </span>
        {band ? (
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#6E6A65]">
            {BAND_LABELS[band]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HabitRow({
  icon,
  label,
  value,
  met,
}: {
  icon: VanaIconName;
  label: string;
  value: string;
  met: boolean | null;
}) {
  const pct = met === true ? 100 : met === false ? 35 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBF3E6]">
        <VanaIcon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-[#6E6A65]">{label}</p>
          <p className="truncate text-sm font-semibold tabular-nums text-[#1C1A17]">{value}</p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ECE8E3]">
          <div
            className="h-full rounded-full bg-[#DAA450] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: VanaIconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Card className="h-full rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] transition hover:border-[#DAA450]/50">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6E6A65]">{label}</p>
          <VanaIcon name={icon} size={18} />
        </div>
        <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-[#1C1A17]">{value}</p>
        <p className="mt-1 text-xs text-[#6E6A65]">{hint}</p>
      </Card>
    </Link>
  );
}

export default function ClientHomePage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getClientDashboardPref() === "classic") {
      router.replace("/client/classic");
    }
  }, [router]);
  const [authError, setAuthError] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [todayEntries, setTodayEntries] = useState<Record<string, string>>({});
  const [habitStreak, setHabitStreak] = useState(0);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [checkInScore, setCheckInScore] = useState<{
    pct: number;
    band: ScoreBand;
    redMax: number;
    orangeMax: number;
    delta: number | null;
  } | null>(null);
  const [scoreChartData, setScoreChartData] = useState<{ date: string; score: number; label?: string }[]>(
    []
  );
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [chartTab, setChartTab] = useState<"checkin" | "weight" | "habits">("weight");
  const [focusWeight, setFocusWeight] = useState(false);
  const [weatherCityId, setWeatherCityId] = useState<WeatherCityId>(DEFAULT_WEATHER_CITY_ID);
  const [perthWeather, setPerthWeather] = useState<PerthWeather | null>(null);
  const [localTimeLabel, setLocalTimeLabel] = useState("");
  const [savingWeatherCity, setSavingWeatherCity] = useState(false);

  useEffect(() => {
    setWeatherCityId(getStoredWeatherCityId());
    setFocusWeight(new URLSearchParams(window.location.search).get("log") === "weight");
  }, []);

  const reloadMeasurements = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/client/measurements");
      if (res.ok) {
        const data = await res.json();
        setMeasurements(Array.isArray(data) ? data : []);
      }
    } catch {
      /* keep previous list */
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    let cancelled = false;
    setPerthWeather(null);
    void fetchCityWeather(weatherCityId).then((w) => {
      if (!cancelled) setPerthWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [weatherCityId]);

  useEffect(() => {
    const tz = getWeatherCity(weatherCityId).timezone;
    const tick = () => setLocalTimeLabel(formatLocalTimeLabel(new Date(), tz));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [weatherCityId]);

  const weatherBackdrop = useMemo(
    () => perthWeatherBackdrop(perthWeather?.scene ?? "unknown"),
    [perthWeather]
  );

  const saveWeatherCity = async (nextId: WeatherCityId) => {
    setWeatherCityId(nextId);
    setStoredWeatherCityId(nextId);
    setSavingWeatherCity(true);
    try {
      const city = getWeatherCity(nextId);
      await fetchWithAuth("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherCity: nextId, timezone: city.timezone }),
      });
    } catch {
      // local preference still applied
    } finally {
      setSavingWeatherCity(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const [profileRes, assignmentsRes, measRes, habitsRes, historyRes, qpRes, goalsRes] =
        await Promise.all([
          fetchWithAuth("/api/client/profile"),
          fetchWithAuth("/api/check-in/assignments"),
          fetchWithAuth("/api/client/measurements"),
          fetchWithAuth("/api/client/habits"),
          fetchWithAuth("/api/client/history"),
          fetchWithAuth("/api/client/question-progress"),
          fetchWithAuth("/api/client/goals"),
        ]);

      if (
        [profileRes, assignmentsRes, measRes, habitsRes, historyRes, qpRes].some((r) => r.status === 401)
      ) {
        setAuthError(true);
        return;
      }

      if (profileRes.ok) {
        const p = await profileRes.json();
        setFirstName(p.firstName?.trim() || null);
        if (isWeatherCityId(p.weatherCity)) {
          setWeatherCityId(p.weatherCity);
          setStoredWeatherCityId(p.weatherCity);
        }
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
      if (measRes.ok) {
        const data = await measRes.json();
        setMeasurements(Array.isArray(data) ? data : []);
      }
      if (habitsRes.ok) {
        const data = await habitsRes.json();
        setTodayEntries(data.todayEntries ?? {});
        const streaks = data.streaks ?? {};
        let best = 0;
        for (const s of Object.values(streaks) as { current?: number }[]) {
          if ((s?.current ?? 0) > best) best = s.current ?? 0;
        }
        setHabitStreak(best);
      }
      if (historyRes.ok) {
        const rows = await historyRes.json();
        const list = Array.isArray(rows) ? rows : [];
        setHistory(list);
        const scores = list
          .filter((row: HistoryRow) => row.score != null && row.completedAt)
          .map((row: HistoryRow) => ({
            date: row.completedAt!.slice(0, 10),
            score: row.score as number,
            label: row.formTitle ?? "Check-in",
          }))
          .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
        setScoreChartData(scores);
      }
      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setGoals(Array.isArray(data) ? data : []);
      }
      if (qpRes.ok) {
        const data = await qpRes.json();
        const weeks = Array.isArray(data.weeks) ? data.weeks.slice(-3) : [];
        const redMax = typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40;
        const orangeMax =
          typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70;
        setTrafficLightRedMax(redMax);
        setTrafficLightOrangeMax(orangeMax);
        const weekOverallScore = data.weekOverallScore ?? {};
        const weekScores: number[] = [];
        for (const w of weeks) {
          const s = weekOverallScore[w.key];
          if (typeof s === "number") weekScores.push(s);
        }
        if (weekScores.length > 0) {
          const pct = Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length);
          const delta =
            weekScores.length >= 2
              ? Math.round(weekScores[weekScores.length - 1]! - weekScores[weekScores.length - 2]!)
              : null;
          setCheckInScore({
            pct,
            band: scoreBand(pct, redMax, orangeMax),
            redMax,
            orangeMax,
            delta,
          });
        } else {
          setCheckInScore(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  const thisMonday = thisMondayPerth();

  const openAssignments = useMemo(() => {
    const open = assignments.filter(
      (a) =>
        !a.reflectionWeekStart ||
        a.reflectionWeekStart <= thisMonday ||
        isWeekOpenPerth(a.reflectionWeekStart)
    );
    // Newest reflection week first so stale backlog doesn't dominate the hero.
    return [...open].sort((a, b) =>
      (b.reflectionWeekStart || "").localeCompare(a.reflectionWeekStart || "")
    );
  }, [assignments, thisMonday]);

  const checkInCta = useMemo(() => {
    // Always go to the week picker — deep-linking a calendar-week assignment
    // before Friday hits the "opens Friday 9am" lock screen.
    const startedOpen = openAssignments.find(
      (a) =>
        a.status === "started" &&
        a.reflectionWeekStart &&
        (a.reflectionWeekStart < thisMonday || isWeekOpenPerth(a.reflectionWeekStart))
    );
    if (startedOpen) {
      return {
        label: "Continue check-in →",
        href: "/client/check-in/new",
        sub: startedOpen.formTitle,
      };
    }
    const actionable = openAssignments.find(
      (a) =>
        a.reflectionWeekStart &&
        (a.reflectionWeekStart < thisMonday || isWeekOpenPerth(a.reflectionWeekStart))
    );
    return {
      label: "Start check-in →",
      href: "/client/check-in/new",
      sub: actionable?.formTitle ?? "Choose a week to check in",
    };
  }, [openAssignments, thisMonday]);

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

  const bodySnapshot = useMemo(() => {
    const withTape = measurements.filter(
      (m) => m.date && m.measurements && Object.keys(m.measurements).length > 0
    );
    if (withTape.length === 0) return [];
    const sorted = [...withTape].sort((a, b) => a.date!.localeCompare(b.date!));
    const baseline = sorted.find((m) => m.isBaseline) ?? sorted[0]!;
    const latest = sorted[sorted.length - 1]!;
    return BODY_KEYS.map(({ key, label }) => {
      const value = measurementNumeric(latest.measurements?.[key]);
      const base = measurementNumeric(baseline.measurements?.[key]);
      if (value == null) return null;
      const delta = base != null ? value - base : null;
      return { key, label, value, delta };
    }).filter((row): row is NonNullable<typeof row> => row != null);
  }, [measurements]);

  const weightChartRows = useMemo((): SlotChartRow[] => {
    const points = measurements
      .filter((m) => m.date && m.bodyWeight != null)
      .map((m) => ({ date: m.date!, value: m.bodyWeight as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const take =
      points.length > MEASUREMENT_SLOT_COUNT
        ? points.slice(-MEASUREMENT_SLOT_COUNT)
        : points;
    const rows: SlotChartRow[] = [];
    for (let i = 0; i < MEASUREMENT_SLOT_COUNT; i++) {
      if (i < take.length) {
        rows.push({ slot: i, value: take[i]!.value, date: take[i]!.date });
      } else {
        rows.push({ slot: i, value: null, date: null });
      }
    }
    return rows;
  }, [measurements]);

  const waistHipsRows = useMemo((): PairedSlotChartRow[] => {
    const dates = new Set<string>();
    for (const m of measurements) {
      if (!m.date) continue;
      if (
        measurementNumeric(m.measurements?.waist) != null ||
        measurementNumeric(m.measurements?.hips) != null
      ) {
        dates.add(m.date);
      }
    }
    const sorted = [...dates].sort((a, b) => a.localeCompare(b));
    const byDate = new Map(measurements.filter((m) => m.date).map((m) => [m.date!, m]));
    const merged = sorted.map((date) => {
      const m = byDate.get(date);
      return {
        date,
        left: measurementNumeric(m?.measurements?.waist),
        right: measurementNumeric(m?.measurements?.hips),
      };
    });
    const take =
      merged.length > MEASUREMENT_SLOT_COUNT
        ? merged.slice(-MEASUREMENT_SLOT_COUNT)
        : merged;
    const rows: PairedSlotChartRow[] = [];
    for (let i = 0; i < MEASUREMENT_SLOT_COUNT; i++) {
      if (i < take.length) {
        const r = take[i]!;
        rows.push({ slot: i, date: r.date, left: r.left, right: r.right });
      } else {
        rows.push({ slot: i, date: null, left: null, right: null });
      }
    }
    return rows;
  }, [measurements]);

  const recentCheckIns = useMemo(() => {
    return history
      .filter((h) => h.completedAt)
      .slice(0, 5)
      .map((h) => {
        const score = typeof h.score === "number" ? h.score : null;
        const band =
          score != null ? scoreBand(score, trafficLightRedMax, trafficLightOrangeMax) : null;
        return {
          id: h.responseId,
          date: h.completedAt!,
          title: h.formTitle ?? "Check-in",
          score,
          band,
        };
      });
  }, [history, trafficLightRedMax, trafficLightOrangeMax]);

  const activeGoals = useMemo(
    () => goals.filter((g) => (g.status || "active") === "active").slice(0, 5),
    [goals]
  );

  // Hero always anchors to the current Perth week; backlog check-ins stay in the KPI count.
  const weekLabel = `Week of ${formatDateDisplay(thisMonday)}`;
  const thisWeekOpenAssignment =
    openAssignments.find((a) => a.reflectionWeekStart === thisMonday) ?? null;

  const reminderCopy = thisWeekOpenAssignment
    ? `Your check-in “${thisWeekOpenAssignment.formTitle}” is open (${weekLabel}). Keep logging habits and measurements for the most accurate progress.`
    : openAssignments.length > 0
      ? `No check-in for ${weekLabel} yet — you still have ${openAssignments.length} older open check-in${openAssignments.length === 1 ? "" : "s"}.`
      : "No open check-in right now — keep logging habits and measurements for the most accurate progress.";

  if (authError) return <AuthErrorRetry onRetry={load} />;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6A65]">
            Check-in Hub
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#1C1A17] sm:text-4xl">
            {getGreeting(firstName)}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[#6E6A65]">
            Your week at a glance — check in, log habits, and dive into your progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ECE8E3] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1A17]">
            <VanaIcon name="calendar" size={14} />
            {weekLabel}
          </span>
          <Link
            href="/client/notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ECE8E3] bg-white"
            aria-label="Notifications"
          >
            <VanaIcon name="bell" size={18} />
          </Link>
          <Link
            href="/client/profile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#22180F] text-sm font-semibold text-white"
            aria-label="Profile"
          >
            {(firstName?.[0] ?? "V").toUpperCase()}
          </Link>
        </div>
      </header>

      {loading ? (
        <Card className="rounded-[18px] border border-[#ECE8E3] p-10 text-center text-sm text-[#6E6A65]">
          Loading dashboard…
        </Card>
      ) : (
        <>
          {/* Hero */}
          <Card className="overflow-hidden rounded-[20px] border border-[#ECE8E3] bg-white p-0 shadow-[0_4px_18px_rgba(35,26,14,0.045)]">
            <div className="grid lg:grid-cols-[1.1fr_0.7fr_1.2fr]">
              <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden p-5 text-white sm:min-h-[240px] sm:p-6">
                {/* Fallback sky while photo loads */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: weatherBackdrop.sky }}
                  aria-hidden
                />
                {/* Photo matched to live Perth weather type */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={weatherBackdrop.imageSrc}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: weatherBackdrop.glow }}
                  aria-hidden
                />
                {weatherBackdrop.showRain ? (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-35"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(-18deg, transparent 0 10px, rgba(255,255,255,0.18) 10px 11px)",
                      backgroundSize: "24px 40px",
                    }}
                    aria-hidden
                  />
                ) : null}
                {/* Soft charcoal/brown wash so type stays readable (mockup look) */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(20,14,10,0.58) 0%, rgba(34,24,15,0.42) 48%, rgba(12,10,8,0.62) 100%)",
                  }}
                  aria-hidden
                />

                <div className="relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      This week&apos;s check-in
                    </p>
                    <div className="flex max-w-full flex-col items-end gap-1.5">
                      <label className="sr-only" htmlFor="weather-city">
                        Nearest capital city for weather
                      </label>
                      <select
                        id="weather-city"
                        value={weatherCityId}
                        disabled={savingWeatherCity}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (isWeatherCityId(next)) void saveWeatherCity(next);
                        }}
                        className="max-w-[11rem] rounded-full border-0 bg-black/30 py-1 pl-2.5 pr-7 text-[10px] font-medium tracking-wide text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#DAA450]/70"
                      >
                        {WEATHER_CITIES.map((c) => (
                          <option key={c.id} value={c.id} className="text-[#1C1A17]">
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {perthWeather ? (
                        <p className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
                          {perthWeather.temperatureC}° · {perthWeather.label}
                          {localTimeLabel ? ` · ${localTimeLabel}` : ""}
                        </p>
                      ) : (
                        <p className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/70">
                          Loading weather…
                        </p>
                      )}
                      {perthWeather && (perthWeather.sunriseLabel || perthWeather.sunsetLabel) ? (
                        <p className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                          {perthWeather.sunriseLabel ? (
                            <span className="inline-flex items-center gap-1">
                              <VanaIcon name="sunrise" size={12} className="opacity-100 brightness-0 invert" label="Sunrise" />
                              {perthWeather.sunriseLabel}
                            </span>
                          ) : null}
                          {perthWeather.sunriseLabel && perthWeather.sunsetLabel ? (
                            <span className="opacity-50" aria-hidden>
                              ·
                            </span>
                          ) : null}
                          {perthWeather.sunsetLabel ? (
                            <span className="inline-flex items-center gap-1">
                              <VanaIcon name="sunset" size={12} className="opacity-100 brightness-0 invert" label="Sunset" />
                              {perthWeather.sunsetLabel}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-semibold leading-tight drop-shadow-sm">
                    {weekLabel}
                  </h2>
                  <p className="mt-2 text-sm text-white/80">{checkInCta.sub}</p>
                </div>

                {perthWeather && perthWeather.week.length > 0 ? (
                  <div className="relative z-10 mt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      {perthWeather.cityLabel} forecast
                    </p>
                    <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {perthWeather.week.map((day) => (
                        <div
                          key={day.date}
                          className={`min-w-[3.4rem] flex-1 rounded-xl px-1.5 py-2 text-center backdrop-blur-sm ${
                            day.isToday
                              ? "bg-[#DAA450]/90 text-[#1C1A17]"
                              : "bg-black/30 text-white"
                          }`}
                          title={`${day.label} · ${day.tempMinC}–${day.tempMaxC}°C`}
                        >
                          <p
                            className={`text-[10px] font-semibold uppercase tracking-wide ${
                              day.isToday ? "text-[#1C1A17]/80" : "text-white/70"
                            }`}
                          >
                            {day.isToday ? "Today" : day.weekdayShort}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {day.tempMaxC}°
                          </p>
                          <p
                            className={`mt-0.5 truncate text-[10px] ${
                              day.isToday ? "text-[#1C1A17]/75" : "text-white/65"
                            }`}
                          >
                            {day.shortLabel}
                          </p>
                          <p
                            className={`text-[9px] tabular-nums ${
                              day.isToday ? "text-[#1C1A17]/55" : "text-white/45"
                            }`}
                          >
                            {day.tempMinC}°
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="relative z-10 mt-5">
                  <Link
                    href={checkInCta.href}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#DAA450] px-5 text-sm font-semibold text-[#1C1A17] transition hover:bg-[#C48E3A]"
                  >
                    {checkInCta.label}
                  </Link>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-2 border-t border-[#ECE8E3] px-4 py-5 lg:border-l lg:border-t-0">
                <ScoreRing
                  pct={checkInScore?.pct ?? null}
                  band={checkInScore?.band ?? null}
                />
                <p className="text-center text-xs text-[#6E6A65]">
                  {checkInScore
                    ? checkInScore.delta != null
                      ? `${checkInScore.delta > 0 ? "↑" : checkInScore.delta < 0 ? "↓" : "→"} ${
                          checkInScore.delta > 0 ? "+" : ""
                        }${checkInScore.delta} vs prior week`
                      : "Recent check-in score"
                    : "No recent score yet"}
                </p>
                <div className="mt-2 w-full border-t border-[#ECE8E3] pt-3">
                  <TodayWeightCard
                    compact
                    measurements={measurements}
                    onSaved={() => void reloadMeasurements()}
                    focusOnMount={focusWeight}
                  />
                </div>
              </div>

              <div className="border-t border-[#ECE8E3] px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6E6A65]">
                  Today&apos;s habits
                </p>
                <HabitRow
                  icon="scale"
                  label="Weight"
                  value={(() => {
                    const today = todayPerth();
                    const todayEntry = measurements.find(
                      (m) => m.date === today && m.bodyWeight != null
                    );
                    if (todayEntry?.bodyWeight != null) {
                      return `${formatNum(todayEntry.bodyWeight)} kg · today`;
                    }
                    return weightStats?.latest.bodyWeight != null
                      ? `${formatNum(weightStats.latest.bodyWeight)} kg`
                      : "Not logged";
                  })()}
                  met={
                    measurements.some((m) => m.date === todayPerth() && m.bodyWeight != null)
                      ? true
                      : null
                  }
                />
                <HabitRow
                  icon="footprints"
                  label="Movement"
                  value={habitOptionLabel("steps", todayEntries.steps) ?? "Not logged"}
                  met={habitMet("steps", todayEntries.steps)}
                />
                <HabitRow
                  icon="droplet"
                  label="Water"
                  value={habitOptionLabel("hydration", todayEntries.hydration) ?? "Not logged"}
                  met={habitMet("hydration", todayEntries.hydration)}
                />
                <HabitRow
                  icon="bed"
                  label="Sleep"
                  value={habitOptionLabel("sleep", todayEntries.sleep) ?? "Not logged"}
                  met={habitMet("sleep", todayEntries.sleep)}
                />
                <Link
                  href="/client/habits"
                  className="mt-1 inline-flex text-xs font-medium text-[#DAA450] hover:underline"
                >
                  Update habits →
                </Link>
              </div>
            </div>
          </Card>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              href="#today-weight"
              icon="scale"
              label="Weight"
              value={
                weightStats?.latest.bodyWeight != null
                  ? `${formatNum(weightStats.latest.bodyWeight)} kg`
                  : "—"
              }
              hint={
                weightStats?.change != null
                  ? `${formatDelta(weightStats.change, " kg")} vs baseline`
                  : "Log weight"
              }
            />
            <KpiCard
              href="/client/progress"
              icon="chart-line"
              label="Check-in score"
              value={checkInScore ? `${checkInScore.pct}%` : "—"}
              hint={
                checkInScore?.delta != null
                  ? `${checkInScore.delta > 0 ? "+" : ""}${checkInScore.delta} vs prior week`
                  : "Last 3 weeks"
              }
            />
            <KpiCard
              href="/client/check-in/new"
              icon="clipboard-check"
              label="Check-ins"
              value={String(openAssignments.length)}
              hint={
                thisWeekOpenAssignment
                  ? openAssignments.length === 1
                    ? "Open this week"
                    : `This week + ${openAssignments.length - 1} older`
                  : openAssignments.length > 0
                    ? "Older open only"
                    : "None open"
              }
            />
            <KpiCard
              href="/client/habits"
              icon="flame"
              label="Habits"
              value={habitStreak > 0 ? `${habitStreak} day streak` : "—"}
              hint={habitStreak > 0 ? "Keep it going" : "Log today to start"}
            />
          </div>

          {/* Progress + measurements */}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#1C1A17]">Your progress</h2>
                  <p className="text-sm text-[#6E6A65]">
                    {chartTab === "checkin"
                      ? "Check-in score over time"
                      : chartTab === "weight"
                        ? "Body weight over time"
                        : "Habit streaks live on the Habits page"}
                  </p>
                </div>
                <div className="inline-flex rounded-full border border-[#ECE8E3] bg-[#FBF8F3] p-0.5 text-xs font-medium">
                  {(
                    [
                      ["checkin", "Check-in"],
                      ["weight", "Weight"],
                      ["habits", "Habits"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setChartTab(id)}
                      className={`rounded-full px-3 py-1.5 transition ${
                        chartTab === id
                          ? "bg-[#DAA450] text-[#1C1A17]"
                          : "text-[#6E6A65] hover:text-[#1C1A17]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 min-h-[220px]">
                {chartTab === "checkin" ? (
                  scoreChartData.length > 0 ? (
                    <CheckInScoreTrendChartLazy
                      data={scoreChartData}
                      redMax={trafficLightRedMax}
                      orangeMax={trafficLightOrangeMax}
                      height={240}
                    />
                  ) : (
                    <p className="py-16 text-center text-sm text-[#6E6A65]">
                      No scored check-ins yet.
                    </p>
                  )
                ) : chartTab === "weight" ? (
                  weightChartRows.some((r) => r.value != null) ? (
                    <MeasurementSlotTrendChartLazy
                      rows={weightChartRows}
                      unit="kg"
                      seriesLabel="Weight"
                      height={240}
                    />
                  ) : (
                    <p className="py-16 text-center text-sm text-[#6E6A65]">No weight history yet.</p>
                  )
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center">
                    <VanaIcon name="flame" size={28} />
                    <p className="text-sm text-[#6E6A65]">
                      Habit history is tracked as daily goal bands (steps, water, sleep).
                    </p>
                    <Button asChild variant="secondary">
                      <Link href="/client/habits">Open habits</Link>
                    </Button>
                  </div>
                )}
              </div>
              {chartTab === "checkin" && scoreChartData.length > 0 ? (
                <p className="mt-3 text-[11px] text-[#6E6A65]">
                  Bands: Needs attention 0–{trafficLightRedMax}% · On track{" "}
                  {trafficLightRedMax + 1}–{trafficLightOrangeMax}% · Excellent{" "}
                  {trafficLightOrangeMax + 1}–100%
                </p>
              ) : null}
            </Card>

            <Card className="rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-[#1C1A17]">Body measurements</h2>
                  <p className="text-sm text-[#6E6A65]">Latest vs baseline</p>
                </div>
                <Link
                  href="/client/measurements"
                  className="text-xs font-medium text-[#DAA450] hover:underline"
                >
                  View history →
                </Link>
              </div>
              {bodySnapshot.length === 0 ? (
                <p className="mt-8 text-sm text-[#6E6A65]">No tape measurements logged yet.</p>
              ) : (
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  {bodySnapshot.map((row) => (
                    <li key={row.key} className="border-b border-[#ECE8E3]/80 pb-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6A65]">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1C1A17]">
                        {formatNum(row.value)} cm
                        {row.delta != null ? (
                          <span className="ml-1.5 text-xs font-medium text-[#6E6A65]">
                            {formatDelta(row.delta)}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild className="mt-5 w-full" variant="secondary">
                <Link href="/client/measurements">Log measurements</Link>
              </Button>
            </Card>
          </div>

          {/* Trends / recent / goals */}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
            <Card className="rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] sm:p-5">
              <h2 className="text-lg font-semibold text-[#1C1A17]">Measurement trends</h2>
              <p className="text-sm text-[#6E6A65]">Waist vs hips</p>
              <div className="mt-4 min-h-[200px]">
                {waistHipsRows.some((r) => r.left != null || r.right != null) ? (
                  <MeasurementPairedSlotTrendChartLazy
                    rows={waistHipsRows}
                    leftLabel="Waist"
                    rightLabel="Hips"
                    unit="cm"
                    seriesLabel="Measurement"
                    height={200}
                  />
                ) : (
                  <p className="py-14 text-center text-sm text-[#6E6A65]">
                    Add waist/hips measurements to see trends.
                  </p>
                )}
              </div>
            </Card>

            <Card className="rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#1C1A17]">Recent check-ins</h2>
                <Link
                  href="/client/history"
                  className="text-xs font-medium text-[#DAA450] hover:underline"
                >
                  View all →
                </Link>
              </div>
              {recentCheckIns.length === 0 ? (
                <p className="mt-8 text-sm text-[#6E6A65]">No completed check-ins yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recentCheckIns.map((row) => (
                    <li key={`${row.id ?? row.date}`}>
                      {row.id ? (
                        <Link
                          href={`/client/response/${row.id}`}
                          className="flex items-center justify-between gap-2 rounded-xl px-1 py-1 hover:bg-[#FBF8F3]"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#1C1A17]">
                              {formatDateDisplay(row.date.slice(0, 10))}
                            </span>
                            <span className="block truncate text-xs text-[#6E6A65]">{row.title}</span>
                          </span>
                          <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-[#1C1A17]">
                            {row.score != null ? `${Math.round(row.score)}%` : "—"}
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: row.band ? bandColor(row.band) : "#A39E98",
                              }}
                            />
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-2 px-1 py-1">
                          <span className="text-sm text-[#1C1A17]">
                            {formatDateDisplay(row.date.slice(0, 10))}
                          </span>
                          <span className="text-sm tabular-nums">
                            {row.score != null ? `${Math.round(row.score)}%` : "—"}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="rounded-[18px] border border-[#ECE8E3] bg-white p-4 shadow-[0_4px_18px_rgba(35,26,14,0.045)] sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-[#1C1A17]">Goals</h2>
                <Link
                  href="/client/goals"
                  className="text-xs font-medium text-[#DAA450] hover:underline"
                >
                  Edit goals →
                </Link>
              </div>
              {activeGoals.length === 0 ? (
                <p className="mt-8 text-sm text-[#6E6A65]">No active goals yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {activeGoals.map((g) => {
                    const done =
                      (typeof g.progress === "number" && g.progress >= 100) ||
                      (g.targetValue != null &&
                        g.currentValue != null &&
                        g.targetValue > 0 &&
                        g.currentValue >= g.targetValue);
                    return (
                      <li key={g.id} className="flex items-start gap-2.5">
                        <VanaIcon
                          name={done ? "check-circle" : "check-square"}
                          size={18}
                          className="mt-0.5"
                        />
                        <span
                          className={`text-sm ${done ? "text-[#6E6A65] line-through" : "text-[#1C1A17]"}`}
                        >
                          {g.title || "Untitled goal"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Notes strip */}
          <div className="flex items-start gap-3 rounded-[16px] border border-[#ECE8E3] bg-[#FBF8F3] px-4 py-3 text-sm text-[#1C1A17]">
            <VanaIcon name="notes" size={18} className="mt-0.5" />
            <p>
              <span className="font-semibold">Notes: </span>
              {reminderCopy}
            </p>
          </div>

          {/* Preserve existing modules */}
          <ClientDashboardBadges />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-[18px] border border-[#ECE8E3] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6E6A65]">Program</p>
              <p className="mt-1 text-sm text-[#6E6A65]">Training lives in the workouts app.</p>
              <a
                href={WORKOUTS_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-[#DAA450] hover:underline"
              >
                Open Program ↗
              </a>
            </Card>
            <Card className="rounded-[18px] border border-[#ECE8E3] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6E6A65]">RecipeHUB</p>
              <p className="mt-1 text-sm text-[#6E6A65]">Recipes and meal ideas.</p>
              <a
                href={RECIPE_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-[#DAA450] hover:underline"
              >
                Open RecipeHUB ↗
              </a>
            </Card>
            <Card className="rounded-[18px] border border-[#ECE8E3] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6E6A65]">Photos</p>
              <p className="mt-1 text-sm text-[#6E6A65]">Progress photos and compare.</p>
              <Link
                href="/client/progress-photos"
                className="mt-2 inline-flex text-sm font-medium text-[#DAA450] hover:underline"
              >
                Open photos →
              </Link>
            </Card>
          </div>

          <p className="text-center text-xs text-[#6E6A65]">
            Prefer the older layout?{" "}
            <Link href="/client/profile#dashboard" className="font-medium text-[#DAA450] hover:underline">
              Switch to classic in Profile
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
