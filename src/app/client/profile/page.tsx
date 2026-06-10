"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay, formatDateDisplay } from "@/lib/format-date";

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  profile: Record<string, unknown>;
  profilePersonalization: { quote: string | null; showQuote: boolean; colorTheme: string; icon: string | null };
  mealPlanJson?: Record<string, unknown> | null;
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
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);

  const loadMeasurements = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/client/measurements");
      if (res.status === 401) return;
      if (res.ok) {
        const data = await res.json();
        setMeasurements(Array.isArray(data) ? data : []);
      }
    } catch {
      // non-fatal
    }
  }, [fetchWithAuth]);

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
    loadMeasurements();
  }, [loadMeasurements]);

  useEffect(() => {
    if (profile) loadCoachReviews();
  }, [profile, fetchWithAuth]);

  const weightStats = useMemo(() => {
    const withWeight = measurements.filter((m) => m.bodyWeight != null && m.date);
    if (withWeight.length === 0) return null;
    const byDate = [...withWeight].sort((a, b) => a.date!.localeCompare(b.date!));
    const baseline = byDate.find((m) => m.isBaseline) ?? byDate[0];
    const latest = byDate[byDate.length - 1];
    const change =
      baseline.bodyWeight != null && latest.bodyWeight != null
        ? latest.bodyWeight - baseline.bodyWeight
        : null;
    return { latest, baseline, change };
  }, [measurements]);

  const logWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = weightInput.trim() ? Number(weightInput) : NaN;
    if (Number.isNaN(w) || w <= 0) {
      setWeightError("Enter a valid weight in kg.");
      return;
    }
    setWeightSaving(true);
    setWeightError(null);
    try {
      const res = await fetchWithAuth("/api/client/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: weightDate,
          bodyWeight: w,
          isBaseline: measurements.length === 0,
        }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setWeightError("Could not save weight.");
        return;
      }
      setWeightInput("");
      setWeightDate(new Date().toISOString().slice(0, 10));
      await loadMeasurements();
    } catch {
      setWeightError("Could not save weight.");
    } finally {
      setWeightSaving(false);
    }
  };

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

      <Card className="p-6" id="body-weight">
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Body weight</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Log your weight here — it’s saved to your progress stats. Same calendar day updates your entry. For waist/hips
          and charts, use the link below.
        </p>
        {weightStats ? (
          <div className="mb-4 grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Latest</p>
              <p className="font-medium tabular-nums text-[var(--color-text)]">
                {weightStats.latest.bodyWeight} kg
                {weightStats.latest.date && (
                  <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                    ({formatDateDisplay(weightStats.latest.date)})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Baseline</p>
              <p className="font-medium tabular-nums text-[var(--color-text)]">
                {weightStats.baseline.bodyWeight} kg
                {weightStats.baseline.date && (
                  <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                    ({formatDateDisplay(weightStats.baseline.date)})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Change from baseline</p>
              <p
                className={`font-medium tabular-nums ${
                  weightStats.change == null
                    ? "text-[var(--color-text)]"
                    : weightStats.change < 0
                      ? "text-[var(--color-success)]"
                      : weightStats.change > 0
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-text)]"
                }`}
              >
                {weightStats.change == null
                  ? "—"
                  : `${weightStats.change > 0 ? "+" : ""}${weightStats.change.toFixed(1)} kg`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">No weight logged yet. Add your first entry below.</p>
        )}
        <form onSubmit={logWeight} className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <Input
              label="Date"
              type="date"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
            />
          </div>
          <div className="min-w-[120px]">
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="e.g. 72.4"
            />
          </div>
          <Button type="submit" variant="primary" disabled={weightSaving}>
            {weightSaving ? "Saving…" : "Log weight"}
          </Button>
        </form>
        {weightError && <p className="mb-3 text-sm text-[var(--color-error)]">{weightError}</p>}
        <p className="text-sm text-[var(--color-text-secondary)]">
          <Link href="/client/measurements" className="font-medium text-[var(--color-primary)] hover:underline">
            Body measurements &amp; height charts
          </Link>{" "}
          — optional tape measurements and full history.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-[var(--color-text)] mb-3">Meal Plan</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Browse recipes and meal ideas in Vana RecipeHUB.
        </p>
        <Button asChild variant="secondary">
          <a href={RECIPE_HUB_URL} target="_blank" rel="noopener noreferrer">
            Open RecipeHUB
          </a>
        </Button>
      </Card>

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
