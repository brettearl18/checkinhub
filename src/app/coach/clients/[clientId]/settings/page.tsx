"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { PREDEFINED_MEAL_PLANS } from "@/lib/meal-plan-predefined-urls";

interface ClientSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  status: string;
  trafficLightRedMax: number;
  trafficLightOrangeMax: number;
  programStartDate: string;
  programDurationWeeks: number | null;
  checkInFrequency: string;
  communicationPreference: string;
  coachNotes: string;
  stripeCustomerId: string | null;
  paymentStatus: string | null;
  firstPaymentAt: string | null;
  mealPlanLinks: { label: string; url: string }[];
}

const DEFAULT_SETTINGS: ClientSettings = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  timezone: "",
  status: "active",
  trafficLightRedMax: 40,
  trafficLightOrangeMax: 70,
  programStartDate: "",
  programDurationWeeks: null,
  checkInFrequency: "weekly",
  communicationPreference: "email",
  coachNotes: "",
  stripeCustomerId: null,
  paymentStatus: null,
  firstPaymentAt: null,
  mealPlanLinks: [],
};

function formatTimeWithVana(firstPaymentAt: string | null): string {
  if (!firstPaymentAt) return "";
  const date = new Date(firstPaymentAt);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  );
  if (months < 1) return `Since ${date.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`;
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} (since ${date.toLocaleDateString("en-AU", { month: "short", year: "numeric" })})`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} (since ${date.toLocaleDateString("en-AU", { month: "short", year: "numeric" })})`;
}

export default function CoachClientSettingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { fetchWithAuth } = useApiClient();
  const [profile, setProfile] = useState<ClientSettings | null>(null);
  const [form, setForm] = useState<ClientSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectResult, setConnectResult] = useState<{ name: string | null; email: string | null } | { error: string } | null>(null);
  const [billingAction, setBillingAction] = useState<"idle" | "pause" | "resume" | "cancel">("idle");
  const [billingError, setBillingError] = useState<string | null>(null);
  const [pauseResumeOn, setPauseResumeOn] = useState<string>("");
  const [subscription, setSubscription] = useState<{ currentPrice: { id: string; label: string } } | null>(null);
  const [prices, setPrices] = useState<{ id: string; label: string }[]>([]);
  const [changePriceId, setChangePriceId] = useState<string>("");
  const [updatePriceLoading, setUpdatePriceLoading] = useState(false);
  const [newMealPlanLabel, setNewMealPlanLabel] = useState("");
  const [newMealPlanUrl, setNewMealPlanUrl] = useState("");
  const [selectedPredefinedMealPlan, setSelectedPredefinedMealPlan] = useState<string>("");

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`);
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (res.status === 403 || res.status === 404) {
          setError("Client not found.");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setForm({
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            timezone: data.timezone ?? "",
            status: data.status ?? "active",
            trafficLightRedMax: typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40,
            trafficLightOrangeMax: typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70,
            programStartDate: data.programStartDate ?? "",
            programDurationWeeks: data.programDurationWeeks ?? null,
            checkInFrequency: data.checkInFrequency ?? "weekly",
            communicationPreference: data.communicationPreference ?? "email",
            coachNotes: data.coachNotes ?? "",
            stripeCustomerId: data.stripeCustomerId ?? null,
            paymentStatus: data.paymentStatus ?? null,
            firstPaymentAt: data.firstPaymentAt ?? null,
            mealPlanLinks: Array.isArray(data.mealPlanLinks)
              ? data.mealPlanLinks.map((l) => ({ label: l?.label ?? "", url: l?.url ?? "" }))
              : [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  useEffect(() => {
    if (!clientId || !form.stripeCustomerId) {
      setSubscription(null);
      setPrices([]);
      setChangePriceId("");
      return;
    }
    (async () => {
      try {
        const [subRes, pricesRes] = await Promise.all([
          fetchWithAuth(`/api/coach/clients/${clientId}/billing/subscription`),
          fetchWithAuth("/api/coach/stripe/prices"),
        ]);
        if (subRes.ok) {
          const d = await subRes.json();
          setSubscription(d.subscription ?? null);
        } else {
          setSubscription(null);
        }
        if (pricesRes.ok) {
          const d = await pricesRes.json();
          setPrices(Array.isArray(d.prices) ? d.prices : []);
        } else {
          setPrices([]);
        }
      } catch {
        setSubscription(null);
        setPrices([]);
      }
    })();
  }, [clientId, form.stripeCustomerId, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          timezone: form.timezone,
          status: form.status,
          trafficLightRedMax: form.trafficLightRedMax,
          trafficLightOrangeMax: form.trafficLightOrangeMax,
          programStartDate: form.programStartDate || undefined,
          programDurationWeeks: form.programDurationWeeks ?? undefined,
          checkInFrequency: form.checkInFrequency,
          communicationPreference: form.communicationPreference,
          coachNotes: form.coachNotes,
          stripeCustomerId: form.stripeCustomerId || undefined,
          mealPlanLinks: form.mealPlanLinks,
        }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data && data.error) || "Save failed.");
        return;
      }
      setProfile(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  const greenMin = form.trafficLightOrangeMax + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/coach/clients/${clientId}`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Back to check-ins
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
            Client settings
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Configure program settings and profile for this client.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/coach/clients/${clientId}/progress`}>Progress</Link>
        </Button>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {error && !profile && (
        <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
      )}

      {!loading && (profile || !error) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              Settings saved.
            </p>
          )}

          {/* Profile */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-4">Profile</h2>
            <div className="space-y-4 max-w-lg">
              <Input
                label="First name"
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
              <Input
                label="Timezone (e.g. Australia/Perth)"
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Traffic light thresholds */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Traffic light thresholds</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Set red / orange / green percentage splits for scoring (0–100%).
            </p>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0" aria-hidden />
                <span className="text-sm text-[var(--color-text)]">Red (0–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.trafficLightRedMax}
                  onChange={(e) => setForm((p) => ({ ...p, trafficLightRedMax: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                  className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                />
                <span className="text-sm text-[var(--color-text-muted)]">%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500 flex-shrink-0" aria-hidden />
                <span className="text-sm text-[var(--color-text)]">Orange ({form.trafficLightRedMax + 1}–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.trafficLightOrangeMax}
                  onChange={(e) => setForm((p) => ({ ...p, trafficLightOrangeMax: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                  className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                />
                <span className="text-sm text-[var(--color-text-muted)]">%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0" aria-hidden />
                <span className="text-sm text-[var(--color-text)]">Green ({greenMin}–100%)</span>
              </div>
            </div>
          </Card>

          {/* Program details */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-4">Program details</h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Program start date</label>
                <input
                  type="date"
                  value={form.programStartDate}
                  onChange={(e) => setForm((p) => ({ ...p, programStartDate: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Program duration (weeks)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 12"
                  value={form.programDurationWeeks ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, programDurationWeeks: e.target.value === "" ? null : Number(e.target.value) || 0 }))}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                />
              </div>
            </div>
          </Card>

          {/* Meal plan links */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Meal plan</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Assign and manage meal plan links for this client. Choose from Hub Vana plans below or add custom links.
            </p>
            <div className="mb-4">
              <label htmlFor="predefined-meal-plan" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Select meal plan
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <select
                  id="predefined-meal-plan"
                  value={selectedPredefinedMealPlan}
                  onChange={(e) => setSelectedPredefinedMealPlan(e.target.value)}
                  className="min-w-[220px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="">— Select a meal plan —</option>
                  {PREDEFINED_MEAL_PLANS.map((plan, idx) => (
                    <option key={plan.url} value={String(idx)}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={selectedPredefinedMealPlan === ""}
                  onClick={() => {
                    const idx = parseInt(selectedPredefinedMealPlan, 10);
                    if (Number.isNaN(idx) || idx < 0 || idx >= PREDEFINED_MEAL_PLANS.length) return;
                    const plan = PREDEFINED_MEAL_PLANS[idx];
                    setForm((p) => ({
                      ...p,
                      mealPlanLinks: [...p.mealPlanLinks, { label: plan.name, url: plan.url }],
                    }));
                    setSelectedPredefinedMealPlan("");
                  }}
                >
                  Assign meal plan to client
                </Button>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Or add a custom link (PDF, Notion, etc.):</p>
            {form.mealPlanLinks.length > 0 && (
              <ul className="mb-4 space-y-2">
                {form.mealPlanLinks.map((link, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--color-text)]">{link.label || "Meal plan"}</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-sm text-[var(--color-primary)] hover:underline truncate block"
                      >
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          mealPlanLinks: p.mealPlanLinks.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-sm text-[var(--color-error)] hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-3 mt-2">
              <input
                type="text"
                placeholder="Label (e.g. Week 1–4 Plan)"
                value={newMealPlanLabel}
                onChange={(e) => setNewMealPlanLabel(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] w-48"
              />
              <input
                type="url"
                placeholder="https://..."
                value={newMealPlanUrl}
                onChange={(e) => setNewMealPlanUrl(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] flex-1 min-w-[200px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = newMealPlanUrl.trim();
                  if (!url) return;
                  setForm((p) => ({ ...p, mealPlanLinks: [...p.mealPlanLinks, { label: newMealPlanLabel.trim() || "Meal plan", url }] }));
                  setNewMealPlanLabel("");
                  setNewMealPlanUrl("");
                }}
              >
                Add link
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Add from the dropdown or custom link above, then click &quot;Save settings&quot; below to save.
            </p>
          </Card>

          {/* Communication settings */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-4">Communication settings</h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Check-in frequency</label>
                <select
                  value={form.checkInFrequency}
                  onChange={(e) => setForm((p) => ({ ...p, checkInFrequency: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Communication preference</label>
                <select
                  value={form.communicationPreference}
                  onChange={(e) => setForm((p) => ({ ...p, communicationPreference: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="in_app">In-app</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Coach notes */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Coach notes</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              These notes are only visible to coaches.
            </p>
            <textarea
              value={form.coachNotes}
              onChange={(e) => setForm((p) => ({ ...p, coachNotes: e.target.value }))}
              placeholder="Add notes about this client, their goals, preferences, or any important information…"
              rows={4}
              className="w-full max-w-2xl rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
            />
          </Card>

          {/* Billing / Stripe */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Billing / Stripe</h2>
            {form.stripeCustomerId && (
              <p className="text-sm text-[var(--color-text)] mb-2">
                <span className="font-medium">Time with Vana:</span>{" "}
                {form.firstPaymentAt ? (
                  <>
                    {formatTimeWithVana(form.firstPaymentAt)}
                    <span className="ml-1 text-[var(--color-text-muted)]">(from first Stripe payment)</span>
                  </>
                ) : (
                  <span className="text-[var(--color-text-muted)]">— (recorded after first payment is received)</span>
                )}
              </p>
            )}
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Link this client to a Stripe customer so payment status (paid up / failed) can appear on their profile. Paste the Customer ID from Stripe, click Connect to verify, then Save settings.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Stripe Customer ID</label>
                <input
                  type="text"
                  placeholder="cus_..."
                  value={form.stripeCustomerId ?? ""}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, stripeCustomerId: e.target.value.trim() || null }));
                    setConnectResult(null);
                  }}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)] font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={connectLoading || !(form.stripeCustomerId ?? "").trim()}
                onClick={async () => {
                  const id = (form.stripeCustomerId ?? "").trim();
                  if (!id) return;
                  setConnectLoading(true);
                  setConnectResult(null);
                  try {
                    const res = await fetchWithAuth(`/api/coach/stripe/customer-lookup?customerId=${encodeURIComponent(id)}`);
                    if (res.status === 401) {
                      setAuthError(true);
                      return;
                    }
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setConnectResult({ name: data.name ?? null, email: data.email ?? null });
                    } else {
                      setConnectResult({ error: (data && data.error) || "Lookup failed" });
                    }
                  } finally {
                    setConnectLoading(false);
                  }
                }}
              >
                {connectLoading ? "Checking…" : "Connect"}
              </Button>
            </div>
            {connectResult && (
              <div className="mt-3 text-sm">
                {"error" in connectResult ? (
                  <p className="text-[var(--color-error)]">{connectResult.error}</p>
                ) : (
                  <p className="text-[var(--color-text-muted)]">
                    Found: {connectResult.name || "—"} {connectResult.email ? `(${connectResult.email})` : ""}
                  </p>
                )}
              </div>
            )}
            {form.stripeCustomerId && (
              <>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  Current status: {form.paymentStatus === "paid" ? (
                    <span className="text-green-600 dark:text-green-400">Paid up</span>
                  ) : form.paymentStatus === "failed" || form.paymentStatus === "past_due" ? (
                    <span className="text-red-600 dark:text-red-400">Payment failed / past due</span>
                  ) : form.paymentStatus === "canceled" ? (
                    <span className="text-amber-600 dark:text-amber-400">Canceled</span>
                  ) : (
                    <span>Not synced yet (webhook will update after you add the endpoint)</span>
                  )}
                </p>
                {subscription?.currentPrice && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[var(--color-text-muted)]">Current plan:</span>
                    <span className="text-sm font-medium text-[var(--color-text)]">{subscription.currentPrice.label}</span>
                    <span className="text-sm text-[var(--color-text-muted)]">·</span>
                    <span className="text-sm text-[var(--color-text-muted)]">Change to:</span>
                    <select
                      value={changePriceId}
                      onChange={(e) => setChangePriceId(e.target.value)}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
                    >
                      <option value="">Select price…</option>
                      {prices
                        .filter((p) => p.id !== subscription.currentPrice.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={updatePriceLoading || !changePriceId}
                      onClick={async () => {
                        if (!changePriceId) return;
                        setBillingError(null);
                        setUpdatePriceLoading(true);
                        try {
                          const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/update-price`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ priceId: changePriceId }),
                          });
                          if (res.status === 401) {
                            setAuthError(true);
                            return;
                          }
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setBillingError(null);
                            setChangePriceId("");
                            const subRes = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/subscription`);
                            if (subRes.ok) {
                              const d = await subRes.json();
                              setSubscription(d.subscription ?? null);
                            }
                          } else {
                            setBillingError((data && data.error) || "Failed to update price");
                          }
                        } finally {
                          setUpdatePriceLoading(false);
                        }
                      }}
                    >
                      {updatePriceLoading ? "Updating…" : "Update price"}
                    </Button>
                  </div>
                )}
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  If this client has an active subscription, you can pause, resume, or cancel it below.
                </p>
                {billingError && (
                  <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">{billingError}</p>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm text-[var(--color-text-muted)]">Resume on (optional):</label>
                    <input
                      type="date"
                      value={pauseResumeOn}
                      onChange={(e) => setPauseResumeOn(e.target.value)}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
                      title="Set a date to auto-resume when pausing"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">Used when you click Pause</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={billingAction !== "idle"}
                    onClick={async () => {
                      setBillingError(null);
                      setBillingAction("pause");
                      try {
                        const body: { resumesAt?: string } = {};
                        if (pauseResumeOn) body.resumesAt = new Date(pauseResumeOn).toISOString();
                        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/pause-subscription`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        if (res.status === 401) {
                          setAuthError(true);
                          return;
                        }
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          setBillingError(null);
                          const profileRes = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`);
                          if (profileRes.ok) {
                            const p = await profileRes.json();
                            setForm((f) => ({ ...f, paymentStatus: p.paymentStatus ?? null }));
                          }
                        } else {
                          setBillingError((data && data.error) || "Failed to pause");
                        }
                      } finally {
                        setBillingAction("idle");
                      }
                    }}
                  >
                    {billingAction === "pause" ? "Pausing…" : "Pause subscription"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={billingAction !== "idle"}
                    onClick={async () => {
                      setBillingError(null);
                      setBillingAction("resume");
                      try {
                        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/resume-subscription`, { method: "POST" });
                        if (res.status === 401) {
                          setAuthError(true);
                          return;
                        }
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          setBillingError(null);
                          const profileRes = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`);
                          if (profileRes.ok) {
                            const p = await profileRes.json();
                            setForm((f) => ({ ...f, paymentStatus: p.paymentStatus ?? null }));
                          }
                        } else {
                          setBillingError((data && data.error) || "Failed to resume");
                        }
                      } finally {
                        setBillingAction("idle");
                      }
                    }}
                  >
                    {billingAction === "resume" ? "Resuming…" : "Resume subscription"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={billingAction !== "idle"}
                    onClick={async () => {
                      if (!confirm("Cancel this subscription? By default it will cancel at the end of the current billing period. Confirm?")) return;
                      setBillingError(null);
                      setBillingAction("cancel");
                      try {
                        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/cancel-subscription`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ cancelAtPeriodEnd: true }),
                        });
                        if (res.status === 401) {
                          setAuthError(true);
                          return;
                        }
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          setBillingError(null);
                          const profileRes = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`);
                          if (profileRes.ok) {
                            const p = await profileRes.json();
                            setForm((f) => ({ ...f, paymentStatus: p.paymentStatus ?? null }));
                          }
                        } else {
                          setBillingError((data && data.error) || "Failed to cancel");
                        }
                      } finally {
                        setBillingAction("idle");
                      }
                    }}
                  >
                    {billingAction === "cancel" ? "Canceling…" : "Cancel subscription"}
                  </Button>
                </div>
              </>
            )}
          </Card>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link href={`/coach/clients/${clientId}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
