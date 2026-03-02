"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  profile: Record<string, unknown>;
  profilePersonalization: { quote: string | null; showQuote: boolean; colorTheme: string; icon: string | null };
}

interface CoachReview {
  responseId: string;
  formTitle: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  whereResponded: string[];
  notes: string | null;
  progressRating: number | null;
}

export default function ClientProfilePage() {
  const { fetchWithAuth } = useApiClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coachReviews, setCoachReviews] = useState<CoachReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", timezone: "" });

  const loadProfile = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/profile");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load profile.");
        return;
      }
      const data = await res.json();
      setProfile(data);
      setForm({
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        timezone: data.timezone ?? "",
      });
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const loadCoachReviews = async () => {
    try {
      const res = await fetchWithAuth("/api/client/coach-reviews");
      if (res.ok) {
        const data = await res.json();
        setCoachReviews(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadProfile();
  }, [fetchWithAuth]);

  useEffect(() => {
    if (profile) loadCoachReviews();
  }, [profile, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Could not save profile.");
        return;
      }
      await loadProfile();
    } catch {
      setError("Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return <p className="text-[var(--color-text-muted)]">Loading profile…</p>;
  }

  if (authError) {
    return <AuthErrorRetry onRetry={loadProfile} />;
  }

  if (error && !profile) {
    return (
      <>
        <p className="text-[var(--color-error)]">{error}</p>
        <Button variant="secondary" onClick={loadProfile}>Retry</Button>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Profile</h1>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Check-ins</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Start a new check-in or view your past submissions.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/client/check-in/new">
            <Button variant="primary">New check-in</Button>
          </Link>
          <Link href="/client/history">
            <Button variant="secondary">View history</Button>
          </Link>
        </div>
      </Card>

      {coachReviews.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Coach feedback on your check-ins</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Where your coach responded, notes, and how they rated your progress.
          </p>
          <ul className="space-y-4">
            {coachReviews.map((r) => (
              <li key={r.responseId} className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-[var(--color-text)]">{r.formTitle}</span>
                  <Link
                    href={`/client/response/${r.responseId}`}
                    className="text-sm text-[var(--color-primary)] hover:underline"
                  >
                    View response →
                  </Link>
                </div>
                {r.reviewedAt && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">
                    Reviewed {formatDateTimeDisplay(r.reviewedAt)}
                  </p>
                )}
                {r.whereResponded.length > 0 && (
                  <p className="text-sm text-[var(--color-text)] mb-1">
                    <span className="text-[var(--color-text-muted)]">Where they responded: </span>
                    {r.whereResponded.join(", ")}
                  </p>
                )}
                {r.progressRating != null && (
                  <p className="text-sm text-[var(--color-text)] mb-1">
                    <span className="text-[var(--color-text-muted)]">Progress rating: </span>
                    {r.progressRating}/10
                  </p>
                )}
                {r.notes && (
                  <p className="text-sm text-[var(--color-text)] mt-2 rounded bg-[var(--color-bg-elevated)] p-2">
                    {r.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Personal details</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
            <Input label="Last name" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input label="Timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="e.g. Australia/Perth" />
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </form>
      </Card>
    </div>
  );
}
