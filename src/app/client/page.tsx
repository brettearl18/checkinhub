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

interface Profile {
  firstName: string;
  lastName: string;
  profilePersonalization?: { showQuote?: boolean; quote?: string | null };
}

const QUICK_LINKS = [
  { href: "/client/history", label: "Check-in history", description: "Past check-ins & feedback" },
  { href: "/client/goals", label: "Goals", description: "Track your progress" },
  { href: "/client/measurements", label: "Measurements", description: "Weight & measurements" },
  { href: "/client/progress-photos", label: "Before & after photos", description: "Progress photos" },
  { href: "/client/messages", label: "Messages", description: "Chat with your coach" },
  { href: "/client/profile", label: "Profile", description: "Your details & settings" },
] as const;

export default function ClientPortalPage() {
  const { fetchWithAuth } = useApiClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const [profileRes, assignmentsRes] = await Promise.all([
        fetchWithAuth("/api/client/profile"),
        fetchWithAuth("/api/check-in/assignments"),
      ]);
      if (profileRes.status === 401 || assignmentsRes.status === 401) {
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
        const msg = (body && typeof body.error === "string") ? body.error : "Could not load check-ins.";
        setError(msg);
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

  const firstName = profile?.firstName?.trim();
  const welcomeName = firstName ? firstName : null;
  const showQuote = profile?.profilePersonalization?.showQuote && profile?.profilePersonalization?.quote;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {welcomeName ? `Hi, ${welcomeName}` : "Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {welcomeName
            ? "Here’s your check-in hub. Start a new check-in or pick up where you left off."
            : "Start a new check-in or resume one you’ve already started."}
        </p>
        {showQuote && (
          <p className="mt-3 text-sm italic text-[var(--color-text-muted)]">
            &ldquo;{profile?.profilePersonalization?.quote ?? ""}&rdquo;
          </p>
        )}
      </header>

      <section>
        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Get started</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Start a new check-in or resume one you’ve already started.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href="/client/check-in/new">New check-in</Link>
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Resume</h2>
        <Card className="p-6">
          {authError && (
            <AuthErrorRetry onRetry={loadData} />
          )}
          {!authError && error && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
              <Button variant="ghost" onClick={loadData}>
                Retry
              </Button>
            </div>
          )}
          {!authError && loading && (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          )}
          {!authError && !loading && assignments.length === 0 && (
            <EmptyState
              title="No check-ins to resume"
              description="Start a new check-in or complete any pending ones."
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
                    className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)]"
                  >
                    <span className="font-medium">{a.formTitle}</span>
                    {a.reflectionWeekStart && (
                      <span className="ml-2 text-[var(--color-text-muted)]">
                        Week of {a.reflectionWeekStart}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Quick links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, description }) => (
            <Link key={href} href={href}>
              <Card className="p-4 h-full transition-colors hover:bg-[var(--color-primary-subtle)] border-[var(--color-border)]">
                <span className="font-medium text-[var(--color-text)]">{label}</span>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
