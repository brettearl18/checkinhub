"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";

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
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  uploadedAt: string | null;
}

interface RecentResponse {
  id: string;
  formTitle: string;
  completedAt: string | null;
  responseId: string | null;
  score: number | null;
  readByClient?: boolean;
}

const QUICK_LINKS = [
  { href: "/client/history", label: "Check-in history", description: "Past check-ins & feedback", emoji: "📋" },
  { href: "/client/progress", label: "Question progress", description: "Traffic light chart by week", emoji: "📊" },
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
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show assignments in TO DO when the week has opened (Friday 9am Perth for this/next week).
  const openAssignments = useMemo(() => {
    const thisMonday = thisMondayPerth();
    return assignments.filter(
      (a) =>
        !a.reflectionWeekStart ||
        a.reflectionWeekStart < thisMonday ||
        isWeekOpenPerth(a.reflectionWeekStart)
    );
  }, [assignments]);

  const loadData = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const [profileRes, assignmentsRes, historyRes, imagesRes] = await Promise.all([
        fetchWithAuth("/api/client/profile"),
        fetchWithAuth("/api/check-in/assignments"),
        fetchWithAuth("/api/client/history"),
        fetchWithAuth("/api/client/progress-images"),
      ]);
      if (profileRes.status === 401 || assignmentsRes.status === 401 || historyRes.status === 401 || imagesRes.status === 401) {
        setAuthError(true);
        return;
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile({
          ...p,
          paymentStatus: p.paymentStatus ?? null,
          mealPlanLinks: Array.isArray(p.mealPlanLinks) ? p.mealPlanLinks : [],
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
        setRecentResponses(
          list.slice(0, 2).map((item: { id: string; formTitle?: string; completedAt?: string | null; responseId?: string | null; score?: number | null; readByClient?: boolean }) => ({
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
        setProgressImages(Array.isArray(list) ? list.slice(0, 6) : []);
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

      {/* Recent check-in responses – prominent, right under hero */}
      {!authError && !loading && recentResponses.length > 0 && (
        <section className="mt-6">
          <Card className="overflow-hidden border-2 border-[var(--color-primary-muted)] bg-gradient-to-br from-[var(--color-primary-subtle)]/80 to-[var(--color-bg-elevated)]">
            <div className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)] sm:text-xl">
                Your recent check-in responses
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                View your answers and coach feedback
              </p>
              <ul className="mt-4 space-y-3">
                {recentResponses.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={r.responseId ? `/client/response/${r.responseId}` : "/client/history"}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-left transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]/50 hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[var(--color-text)]">{r.formTitle}</span>
                        {r.responseId && !r.readByClient && (
                          <span className="ml-2 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-xs font-medium text-white">
                            New
                          </span>
                        )}
                        {r.completedAt && (
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            {formatDateTimeDisplay(r.completedAt)}
                          </p>
                        )}
                        {typeof r.score === "number" && (
                          <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                            Score: {r.score}%
                          </p>
                        )}
                      </div>
                      <span className="flex-shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)]/90">
                        {r.responseId ? "View response →" : "View history →"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/client/history"
                className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
              >
                View all check-in history →
              </Link>
            </div>
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
              {openAssignments.length > 0
                ? "You have a check-in to complete"
                : "Start your check-in"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {openAssignments.length > 0
                ? "Complete your open check-in below, or start a new one from the week picker."
                : "A quick reflection to keep your momentum going."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/client/check-in/new">New check-in</Link>
              </Button>
              {openAssignments.length > 0 && (
                <span className="flex items-center text-sm text-[var(--color-text-muted)]">
                  or open one from the list below
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* To do, Payments, Meal plan: compact cards */}
      {!authError && !loading && (
        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* To do – only when check-ins are open (week has opened, e.g. Friday 9am Perth for this/next week) */}
            {openAssignments.length > 0 && (
              <Card className="p-4 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  To do
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {openAssignments.length} check-in{openAssignments.length !== 1 ? "s" : ""} open
                </p>
                <ul className="space-y-1.5">
                  {openAssignments.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/client/check-in/${a.id}`}
                        className="block py-1.5 text-sm text-[var(--color-primary)] hover:underline min-h-[44px] flex items-center"
                      >
                        {a.formTitle}
                        {a.reflectionWeekStart ? ` (week of ${a.reflectionWeekStart})` : ""} →
                      </Link>
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
            <Card className="p-4 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Payments
              </h3>
              {profile?.paymentStatus === "paid" ? (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Paid up</p>
              ) : profile?.paymentStatus ? (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Action needed</p>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No payment linked</p>
              )}
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Your coach manages billing. Contact them if you need to update payment.
              </p>
            </Card>
            {/* Meal plan */}
            <Card className="p-4 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Meal plan
              </h3>
              {profile?.mealPlanLinks && profile.mealPlanLinks.length > 0 ? (
                <ul className="space-y-1.5">
                  {profile.mealPlanLinks.slice(0, 3).map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-primary)] hover:underline"
                      >
                        {link.label || "Meal plan"} →
                      </a>
                    </li>
                  ))}
                  {profile.mealPlanLinks.length > 3 && (
                    <li className="text-xs text-[var(--color-text-muted)]">
                      +{profile.mealPlanLinks.length - 3} more
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No meal plan assigned. Your coach can add one in your settings.
                </p>
              )}
            </Card>
          </div>
        </section>
      )}

      {/* Resume list or empty state */}
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

      {/* Mini photo gallery */}
      {!authError && !loading && progressImages.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Recent photos
          </h2>
          <Card className="p-4 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {progressImages.map((img) => (
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
