"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface Assignment {
  id: string;
  formId: string;
  formTitle: string;
  reflectionWeekStart?: string;
  status: string;
  dueDate: string | null;
}

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

interface Profile {
  firstName: string;
  lastName: string;
  profilePersonalization?: { showQuote?: boolean; quote?: string | null };
}

const QUICK_LINKS = [
  { href: "/client/history", label: "Check-in history", description: "Past check-ins & feedback", emoji: "📋" },
  { href: "/client/goals", label: "Goals", description: "Track your progress", emoji: "🎯" },
  { href: "/client/measurements", label: "Measurements", description: "Weight & measurements", emoji: "📏" },
  { href: "/client/progress-photos", label: "Before & after photos", description: "Progress photos", emoji: "📸" },
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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const [profileRes, assignmentsRes, goalsRes] = await Promise.all([
        fetchWithAuth("/api/client/profile"),
        fetchWithAuth("/api/check-in/assignments"),
        fetchWithAuth("/api/client/goals"),
      ]);
      if (profileRes.status === 401 || assignmentsRes.status === 401 || goalsRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile(p);
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(Array.isArray(data) ? data : []);
      } else {
        const body = await assignmentsRes.json().catch(() => ({}));
        setError((body && typeof body.error === "string") ? body.error : "Could not load check-ins.");
      }
      if (goalsRes.ok) {
        const g = await goalsRes.json();
        setGoals(Array.isArray(g) ? g : []);
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

  const firstName = profile?.firstName?.trim() ?? null;
  const showQuote = profile?.profilePersonalization?.showQuote && profile?.profilePersonalization?.quote;
  const activeGoals = goals.filter((g) => g.status === "active");
  const topGoal = activeGoals.length > 0 ? activeGoals[0] : null;
  const motivationalLine = MOTIVATIONAL_LINES[firstName ? firstName.length % MOTIVATIONAL_LINES.length : 0];

  return (
    <div className="min-h-[60vh]">
      {/* Hero: welcoming, motivational */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary-subtle)] via-[var(--color-bg-elevated)] to-[var(--color-bg)] border border-[var(--color-border)] p-6 sm:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
            {getGreeting(firstName)}
          </h1>
          <p className="mt-2 max-w-lg text-[var(--color-text-secondary)]">
            {motivationalLine}
          </p>
          {showQuote && (
            <p className="mt-4 text-sm italic text-[var(--color-text-muted)]">
              &ldquo;{profile?.profilePersonalization?.quote ?? ""}&rdquo;
            </p>
          )}
        </div>
      </header>

      {/* Progress at a glance (goals) */}
      {activeGoals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Your progress
          </h2>
          <Card className="p-5 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
            <p className="text-[var(--color-text)] font-medium">
              You're working on {activeGoals.length} {activeGoals.length === 1 ? "goal" : "goals"}
            </p>
            {topGoal && (
              <div className="mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{topGoal.title}</span>
                  <span className="font-medium text-[var(--color-primary)]">
                    {Math.round(topGoal.progress ?? 0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, topGoal.progress ?? 0))}%` }}
                  />
                </div>
              </div>
            )}
            <Link
              href="/client/goals"
              className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View all goals →
            </Link>
          </Card>
        </section>
      )}

      {/* Primary action: check-in */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Your check-in
        </h2>
        <Card className="overflow-hidden border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <div className="p-6 sm:p-8">
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {assignments.length > 0
                ? "Pick up where you left off"
                : "Start your check-in"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {assignments.length > 0
                ? "A few minutes to reflect and stay on track."
                : "A quick reflection to keep your momentum going."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="default">
                <Link href="/client/check-in/new">New check-in</Link>
              </Button>
              {assignments.length > 0 && (
                <span className="flex items-center text-sm text-[var(--color-text-muted)]">
                  or resume one below
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Resume list or empty state */}
      <section className="mt-6">
        {authError && <AuthErrorRetry onRetry={loadData} />}
        {!authError && error && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
            <Button variant="ghost" size="sm" onClick={loadData}>Retry</Button>
          </div>
        )}
        {!authError && loading && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          </div>
        )}
        {!authError && !loading && assignments.length === 0 && (
          <EmptyState
            title="No check-ins to resume"
            description="Start a new check-in when you're ready—each one helps you stay on track."
            actionLabel="New check-in"
            actionHref="/client/check-in/new"
          />
        )}
        {!authError && !loading && assignments.length > 0 && (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/client/check-in/${a.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-4 text-left transition-colors hover:border-[var(--color-primary-muted)] hover:bg-[var(--color-primary-subtle)]/50"
                >
                  <div>
                    <span className="font-medium text-[var(--color-text)]">{a.formTitle}</span>
                    {a.reflectionWeekStart && (
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        Week of {a.reflectionWeekStart}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--color-primary)]">Resume →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick links: toolkit */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Quick links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, description, emoji }) => (
            <Link key={href} href={href}>
              <Card className="h-full p-4 transition-all border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary-muted)] hover:shadow-md">
                <span className="text-xl leading-none" aria-hidden>{emoji}</span>
                <span className="mt-2 block font-medium text-[var(--color-text)]">{label}</span>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
