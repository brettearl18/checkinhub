"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface Assignment {
  programId: string;
  programName: string;
  programSnapshot: { days: { name?: string }[] }[];
  startDate: string;
  currentWeek: number;
  status: string;
}

interface TodaySession {
  programName: string;
  weekIndex: number;
  dayIndex: number;
  session: { weekLabel: string; dayLabel: string } | null;
  message?: string;
}

export default function ClientProgramPage() {
  const { fetchWithAuth } = useApiClient();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAuthError(false);
    Promise.all([
      fetchWithAuth("/api/client/program"),
      fetchWithAuth("/api/client/program/today"),
    ])
      .then(([progRes, todayRes]) => {
        if (cancelled) return;
        if (progRes.status === 401 || todayRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (progRes.ok) {
          progRes.json().then((data) => {
            if (!cancelled && data) setAssignment(data);
          });
        } else {
          if (!cancelled) setAssignment(null);
        }
        if (todayRes.ok) {
          todayRes.json().then((data) => {
            if (!cancelled && data) setTodaySession(data);
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Program</h1>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Program</h1>
        <EmptyState
          title="No program assigned"
          description="Your coach hasn’t assigned a program yet. Ask them to assign one from your profile."
        />
      </div>
    );
  }

  const weeks = assignment.programSnapshot ?? [];
  const currentWeekIndex = Math.max(0, Math.min(assignment.currentWeek - 1, weeks.length - 1));
  const currentWeek = weeks[currentWeekIndex];
  const days = currentWeek?.days ?? [];
  const hasToday = todaySession?.session != null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--color-text)]">Program</h1>

      <Card className="p-4">
        <p className="font-medium text-[var(--color-text)]">{assignment.programName}</p>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Week {assignment.currentWeek} of {weeks.length}
          {assignment.startDate ? ` · Started ${new Date(assignment.startDate + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
        </p>
      </Card>

      {hasToday && todaySession && (
        <Link href={`/client/program/session/${todaySession.weekIndex}/${todaySession.dayIndex}`}>
          <Card className="p-4 border-[var(--color-primary)] bg-[var(--color-primary-subtle)] min-h-[44px] flex items-center justify-between">
            <span className="font-medium text-[var(--color-text)]">Today’s workout</span>
            <span className="text-sm text-[var(--color-primary)]">
              {todaySession.session?.weekLabel} – {todaySession.session?.dayLabel}
            </span>
          </Card>
        </Link>
      )}

      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-2">Week {assignment.currentWeek}</h2>
        <div className="space-y-2">
          {days.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No days in this week.</p>
          ) : (
            days.map((day, dayIndex) => (
              <Link
                key={dayIndex}
                href={`/client/program/session/${assignment.currentWeek}/${dayIndex}`}
                className="block min-h-[44px]"
              >
                <Card className="p-4 flex items-center justify-between">
                  <span className="font-medium text-[var(--color-text)]">{day.name || `Day ${dayIndex + 1}`}</span>
                  <span className="text-sm text-[var(--color-text-muted)]">View</span>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

      {weeks.length > 1 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Your coach can change your current week from their dashboard. Tap a day above to see the workout.
        </p>
      )}
    </div>
  );
}
