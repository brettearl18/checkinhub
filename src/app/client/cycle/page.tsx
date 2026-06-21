"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { CycleOnboardingForm, type CycleOnboardingInitialValues } from "@/components/client/CycleOnboardingForm";
import { CycleCalendar } from "@/components/client/CycleCalendar";
import { CyclePhaseRing } from "@/components/client/CyclePhaseRing";
import { CycleWeekStrip } from "@/components/client/CycleWeekStrip";
import { CycleLogDrawer, CycleTodaySummary } from "@/components/client/CycleLogDrawer";
import { useApiClient } from "@/lib/api-client";
import { todayPerth } from "@/lib/perth-date";
import {
  buildWeekStrip,
  formatTodayHeading,
  logsByDate,
  phaseBadgeLabel,
} from "@/lib/cycle-view";
import {
  type CycleDailyLog,
  type CyclePhaseInfo,
  type CycleProfile,
  type CycleSetupInput,
  type PeriodFlow,
  needsCycleSetup,
} from "@/lib/cycle-tracking";

interface CycleData {
  profile: CycleProfile;
  phase: CyclePhaseInfo;
  todayLog: CycleDailyLog | null;
  recentLogs: CycleDailyLog[];
  calendarLogs?: CycleDailyLog[];
}

type ViewMode = "cycle" | "calendar";

function setupInitialFromProfile(profile: CycleProfile): CycleOnboardingInitialValues {
  const pastPeriods = profile.periodHistory.filter(
    (p) => !(p.start === profile.lastPeriodStart && p.end === profile.lastPeriodEnd)
  );
  return {
    lastPeriodStart: profile.lastPeriodStart ?? "",
    lastPeriodEnd: profile.lastPeriodEnd ?? "",
    pastPeriods,
    averageCycleLength: profile.averageCycleLength,
    trackSexualActivity: profile.trackSexualActivity,
    cycleRegularity: profile.cycleRegularity,
    onHormonalBirthControl: profile.onHormonalBirthControl,
  };
}

function applyLogToForm(
  log: CycleDailyLog | null,
  setters: {
    setMood: (v: number | null) => void;
    setEnergy: (v: number | null) => void;
    setSymptoms: (v: string[]) => void;
    setFeelings: (v: string[]) => void;
    setNote: (v: string) => void;
    setIsPeriodDay: (v: boolean) => void;
    setPeriodFlow: (v: PeriodFlow) => void;
    setSexualActivity: (v: boolean | null) => void;
    setSexualActivityProtected: (v: boolean | null) => void;
  }
) {
  setters.setMood(typeof log?.mood === "number" ? log.mood : null);
  setters.setEnergy(typeof log?.energy === "number" ? log.energy : null);
  setters.setSymptoms(log?.symptoms ?? []);
  setters.setFeelings(log?.feelings ?? []);
  setters.setNote(log?.note ?? "");
  setters.setIsPeriodDay(Boolean(log?.isPeriodDay));
  setters.setPeriodFlow(log?.periodFlow ?? "none");
  setters.setSexualActivity(typeof log?.sexualActivity === "boolean" ? log.sexualActivity : null);
  setters.setSexualActivityProtected(
    typeof log?.sexualActivityProtected === "boolean" ? log.sexualActivityProtected : null
  );
}

export default function ClientCyclePage() {
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<CycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cycle");
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [coachSettingsOpen, setCoachSettingsOpen] = useState(false);
  const [showSetupRedo, setShowSetupRedo] = useState(false);
  const [selectedLogDate, setSelectedLogDate] = useState(todayPerth());

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [isPeriodDay, setIsPeriodDay] = useState(false);
  const [periodFlow, setPeriodFlow] = useState<PeriodFlow>("none");
  const [sexualActivity, setSexualActivity] = useState<boolean | null>(null);
  const [sexualActivityProtected, setSexualActivityProtected] = useState<boolean | null>(null);

  const today = todayPerth();
  const formSetters = {
    setMood,
    setEnergy,
    setSymptoms,
    setFeelings,
    setNote,
    setIsPeriodDay,
    setPeriodFlow,
    setSexualActivity,
    setSexualActivityProtected,
  };

  const allLogs = useMemo(() => {
    if (!data) return [];
    const merged = [...(data.calendarLogs ?? []), ...data.recentLogs];
    const seen = new Set<string>();
    return merged.filter((l) => {
      if (seen.has(l.date)) return false;
      seen.add(l.date);
      return true;
    });
  }, [data]);

  const logMap = useMemo(() => logsByDate(allLogs), [allLogs]);

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load cycle data");
        return;
      }
      const json = (await res.json()) as CycleData;
      setData(json);
      applyLogToForm(json.todayLog, formSetters);
      setSelectedLogDate(todayPerth());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const openLogForDate = (date: string) => {
    setSelectedLogDate(date);
    applyLogToForm(logMap.get(date) ?? null, formSetters);
    setLogDrawerOpen(true);
  };

  const patchProfile = async (patch: Partial<CycleProfile>) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save settings");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: json.profile as CycleProfile,
              phase: json.phase as CyclePhaseInfo,
            }
          : prev
      );
      if (typeof patch.trackingEnabled === "boolean") {
        window.dispatchEvent(
          new CustomEvent("cycle-tracking-updated", {
            detail: { enabled: patch.trackingEnabled },
          })
        );
      }
      setSuccess("Saved");
      setTimeout(() => setSuccess(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const saveLog = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
          date: selectedLogDate,
          mood,
          energy,
          symptoms,
          feelings,
          note: note.trim() || null,
          isPeriodDay,
          periodFlow: isPeriodDay ? periodFlow : "none",
        };
      if (data?.profile.trackSexualActivity) {
        payload.sexualActivity = sexualActivity;
        payload.sexualActivityProtected =
          sexualActivity === true ? sexualActivityProtected : null;
      }
      const res = await fetchWithAuth("/api/client/cycle/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save log");
        return;
      }
      await load();
      setLogDrawerOpen(false);
      setSuccess(selectedLogDate === today ? "Today's log saved" : "Log saved");
      setTimeout(() => setSuccess(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const logPeriodStartToday = async () => {
    setSaving(true);
    setError(null);
    try {
      const patchRes = await fetchWithAuth("/api/client/cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastPeriodStart: today }),
      });
      if (!patchRes.ok) {
        const json = await patchRes.json().catch(() => ({}));
        setError(typeof json.error === "string" ? json.error : "Could not log period start");
        return;
      }
      setIsPeriodDay(true);
      setPeriodFlow("medium");
      const logRes = await fetchWithAuth("/api/client/cycle/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          mood,
          energy,
          symptoms,
          feelings,
          note: note.trim() || null,
          isPeriodDay: true,
          periodFlow: "medium",
        }),
      });
      if (!logRes.ok) {
        const json = await logRes.json().catch(() => ({}));
        setError(typeof json.error === "string" ? json.error : "Could not save period day");
        return;
      }
      await load();
      setSuccess("Period started logged");
      setTimeout(() => setSuccess(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const logPeriodEndedToday = async () => {
    setIsPeriodDay(false);
    setPeriodFlow("none");
    await saveLogWithOverrides({ isPeriodDay: false, periodFlow: "none" });
    setSuccess("Period ended logged");
    setTimeout(() => setSuccess(null), 2500);
  };

  const saveLogWithOverrides = async (overrides: Partial<{
    isPeriodDay: boolean;
    periodFlow: PeriodFlow;
  }>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          mood,
          energy,
          symptoms,
          feelings,
          note: note.trim() || null,
          isPeriodDay: overrides.isPeriodDay ?? isPeriodDay,
          periodFlow: (overrides.isPeriodDay ?? isPeriodDay) ? (overrides.periodFlow ?? periodFlow) : "none",
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(typeof json.error === "string" ? json.error : "Could not save");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const optInToTracking = async () => {
    await patchProfile({ trackingEnabled: true });
  };

  const completeSetup = async (setup: CycleSetupInput, variant: "setup" | "redo" = "setup") => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save setup");
        return;
      }
      await load();
      setShowSetupRedo(false);
      setSuccess(variant === "redo" ? "Cycle setup updated" : "Cycle tracking is ready");
      setTimeout(() => setSuccess(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const stopTracking = async () => {
    if (
      !confirm(
        "Stop cycle tracking? Your past logs are kept, but the tracker will be hidden until you opt in again."
      )
    ) {
      return;
    }
    await patchProfile({ trackingEnabled: false });
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  const profile = data?.profile;
  const weekDays = profile ? buildWeekStrip(profile, logMap, today) : [];

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Today · {formatTodayHeading(today)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Cycle tracker</h1>
        </div>
        {profile?.trackingEnabled && profile.setupCompleted && !showSetupRedo && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("cycle")}
                className={`rounded-lg px-3 py-1.5 font-medium ${
                  viewMode === "cycle"
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                Cycle
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg px-3 py-1.5 font-medium ${
                  viewMode === "calendar"
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowSetupRedo(true);
              }}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              Set up
            </button>
          </div>
        )}
      </div>

      {success && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          {success}
        </p>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && profile && !profile.trackingEnabled && (
        <Card className="border-[var(--color-primary-muted)] p-8 text-center">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Cycle & wellbeing tracking</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-text-secondary)]">
            Optional. Track your period, mood, and energy to see estimated cycle phases. Nothing is recorded until
            you opt in.
          </p>
          {error && <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>}
          <Button type="button" className="mt-6" disabled={saving} onClick={optInToTracking}>
            {saving ? "Starting…" : "I want to use cycle tracking"}
          </Button>
        </Card>
      )}

      {!loading && profile && profile.trackingEnabled && needsCycleSetup(profile) && (
        <CycleOnboardingForm saving={saving} error={error} onSubmit={completeSetup} />
      )}

      {!loading && profile?.trackingEnabled && profile.setupCompleted && showSetupRedo && (
        <CycleOnboardingForm
          variant="redo"
          saving={saving}
          error={error}
          initialValues={setupInitialFromProfile(profile)}
          onCancel={() => {
            setShowSetupRedo(false);
            setError(null);
          }}
          onSubmit={(setup) => completeSetup(setup, "redo")}
        />
      )}

      {!loading && profile?.trackingEnabled && profile.setupCompleted && data && !showSetupRedo && (
        <>
          {viewMode === "cycle" ? (
            <>
              <Card className="overflow-hidden p-4 sm:p-5">
                <CycleWeekStrip days={weekDays} onSelectDate={openLogForDate} />

                {data.phase && (
                  <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" aria-hidden />
                      {phaseBadgeLabel(data.phase)} · estimated
                    </span>
                  </div>
                )}

                <div className="mt-4">
                  <CyclePhaseRing profile={profile} phaseInfo={data.phase} />
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" disabled={saving} onClick={logPeriodStartToday}>
                    Period started
                  </Button>
                  <Button type="button" variant="secondary" disabled={saving} onClick={logPeriodEndedToday}>
                    Period ended
                  </Button>
                  <Button type="button" variant="secondary" disabled={saving} onClick={() => openLogForDate(today)}>
                    Log today
                  </Button>
                </div>
              </Card>

              <CycleTodaySummary
                cycleDay={data.phase.cycleDay}
                mood={data.todayLog?.mood ?? null}
                energy={data.todayLog?.energy ?? null}
                symptoms={data.todayLog?.symptoms ?? []}
                feelings={data.todayLog?.feelings ?? []}
                isPeriodDay={Boolean(data.todayLog?.isPeriodDay)}
                onOpenLog={() => openLogForDate(today)}
              />
            </>
          ) : (
            <Card className="p-4 sm:p-5">
              <CycleCalendar profile={profile} logs={allLogs} onSelectDate={openLogForDate} />
            </Card>
          )}

          <Card className="p-4">
            <button
              type="button"
              onClick={() => setCoachSettingsOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-[var(--color-text)]">Coach sharing & settings</span>
              <span className="text-[var(--color-text-muted)]">{coachSettingsOpen ? "−" : "+"}</span>
            </button>

            {coachSettingsOpen && (
              <div className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded"
                    checked={profile.shareWithCoach}
                    disabled={saving}
                    onChange={(e) => patchProfile({ shareWithCoach: e.target.checked })}
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Share cycle summary with my coach (phase, mood averages, period days)
                  </span>
                </label>
                {profile.shareWithCoach && (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded"
                      checked={profile.shareNotesWithCoach}
                      disabled={saving}
                      onChange={(e) => patchProfile({ shareNotesWithCoach: e.target.checked })}
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      Also share my daily notes with my coach
                    </span>
                  </label>
                )}
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded"
                    checked={profile.trackSexualActivity}
                    disabled={saving}
                    onChange={(e) => patchProfile({ trackSexualActivity: e.target.checked })}
                  />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Log sexual activity in daily tracker
                    <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                      Only if you&apos;re trying to fall pregnant. Never shared with your coach.
                    </span>
                  </span>
                </label>
                {profile.computedCycleLengthMin != null && profile.computedCycleLengthMax != null && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Your logged history: ~{profile.averageCycleLength}-day cycles (
                    {profile.computedCycleLengthMin}–{profile.computedCycleLengthMax} day range), ~
                    {profile.averagePeriodLength}-day periods.
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setError(null);
                    setCoachSettingsOpen(false);
                    setShowSetupRedo(true);
                  }}
                >
                  Set up again
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={stopTracking}>
                  Stop cycle tracking
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      <CycleLogDrawer
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        isToday={selectedLogDate === today}
        dateLabel={formatTodayHeading(selectedLogDate)}
        trackSexualActivity={Boolean(profile?.trackSexualActivity)}
        mood={mood}
        energy={energy}
        symptoms={symptoms}
        feelings={feelings}
        note={note}
        isPeriodDay={isPeriodDay}
        periodFlow={periodFlow}
        sexualActivity={sexualActivity}
        sexualActivityProtected={sexualActivityProtected}
        onMoodChange={setMood}
        onEnergyChange={setEnergy}
        onSymptomsChange={setSymptoms}
        onFeelingsChange={setFeelings}
        onNoteChange={setNote}
        onPeriodDayChange={setIsPeriodDay}
        onPeriodFlowChange={setPeriodFlow}
        onSexualActivityChange={setSexualActivity}
        onSexualActivityProtectedChange={setSexualActivityProtected}
        onSave={saveLog}
        saving={saving}
        error={error}
      />
    </div>
  );
}
