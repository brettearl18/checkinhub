"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import { PREDEFINED_MEAL_PLANS } from "@/lib/meal-plan-predefined-urls";

const SCORING_PROFILES = [
  { id: "moderate", label: "Moderate (0–60% red, 61–85% orange, 86–100% green)", redMax: 60, orangeMax: 85 },
  { id: "lifestyle", label: "Lifestyle (0–33% red, 34–80% orange, 81–100% green)", redMax: 33, orangeMax: 80 },
  { id: "high-performance", label: "High performance (0–75% red, 76–89% orange, 90–100% green)", redMax: 75, orangeMax: 89 },
  { id: "custom", label: "Custom", redMax: 70, orangeMax: 85 },
] as const;

interface ClientSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  status: string;
  scoringProfile: string;
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
  packagePaidAt: string;
  packageMonths: number | null;
  packageFreeWeeks: number;
}

const DEFAULT_SETTINGS: ClientSettings = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  timezone: "",
  status: "active",
  scoringProfile: "moderate",
  trafficLightRedMax: 60,
  trafficLightOrangeMax: 85,
  programStartDate: "",
  programDurationWeeks: null,
  checkInFrequency: "weekly",
  communicationPreference: "email",
  coachNotes: "",
  stripeCustomerId: null,
  paymentStatus: null,
  firstPaymentAt: null,
  mealPlanLinks: [],
  packagePaidAt: "",
  packageMonths: null,
  packageFreeWeeks: 0,
};

function formatBillingAmount(cents: number, currency: string): string {
  const code = (currency || "aud").toUpperCase();
  const symbol = code === "AUD" ? "A$" : code === "USD" ? "$" : code + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatTimeWithVana(firstPaymentAt: string | null): string {
  if (!firstPaymentAt) return "";
  const date = new Date(firstPaymentAt);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  );
  const dateStr = formatDateDisplay(firstPaymentAt);
  if (months < 1) return `Since ${dateStr}`;
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} (since ${dateStr})`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} (since ${dateStr})`;
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
  const [syncBillingLoading, setSyncBillingLoading] = useState(false);
  const [newMealPlanLabel, setNewMealPlanLabel] = useState("");
  const [newMealPlanUrl, setNewMealPlanUrl] = useState("");
  const [selectedPredefinedMealPlan, setSelectedPredefinedMealPlan] = useState<string>("");
  const [billingHistoryInvoices, setBillingHistoryInvoices] = useState<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    amountDue: number;
    currency: string;
    created: string | null;
    paid: boolean;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }[]>([]);
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);
  const [paymentHistoryExpanded, setPaymentHistoryExpanded] = useState(false);
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(null);
  const [allocationForms, setAllocationForms] = useState<{ id: string; title?: string }[]>([]);
  const [allocationAssignments, setAllocationAssignments] = useState<{ id: string; formTitle: string; formId: string; status: string; reflectionWeekStart: string | null; responseId: string | null }[]>([]);
  const [assignFormId, setAssignFormId] = useState("");
  const [assignWeek, setAssignWeek] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const allocationWeekOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = -2; i <= 1; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + 7 * i);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const m = new Date(d);
      m.setDate(diff);
      const monday = m.toISOString().slice(0, 10);
      const [y, mo, dayNum] = monday.split("-").map(Number);
      const end = new Date(y, mo - 1, dayNum);
      end.setDate(end.getDate() + 6);
      const endStr = end.toISOString().slice(0, 10);
      options.push({ value: monday, label: `${formatDateDisplay(monday)} – ${formatDateDisplay(endStr)}` });
    }
    return options;
  }, []);

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
            scoringProfile: typeof data.scoringProfile === "string" ? data.scoringProfile : "moderate",
            trafficLightRedMax: typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 60,
            trafficLightOrangeMax: typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 85,
            programStartDate: data.programStartDate ?? "",
            programDurationWeeks: data.programDurationWeeks ?? null,
            checkInFrequency: data.checkInFrequency ?? "weekly",
            communicationPreference: data.communicationPreference ?? "email",
            coachNotes: data.coachNotes ?? "",
            stripeCustomerId: data.stripeCustomerId ?? null,
            paymentStatus: data.paymentStatus ?? null,
            firstPaymentAt: data.firstPaymentAt ?? null,
            packagePaidAt: data.packagePaidAt ?? "",
            packageMonths: data.packageMonths ?? null,
            packageFreeWeeks: typeof data.packageFreeWeeks === "number" ? data.packageFreeWeeks : 0,
            mealPlanLinks: Array.isArray(data.mealPlanLinks)
              ? data.mealPlanLinks.map((l: { label?: string; url?: string }) => ({ label: l?.label ?? "", url: l?.url ?? "" }))
              : [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const [formsRes, checkInsRes] = await Promise.all([
          fetchWithAuth("/api/coach/forms"),
          fetchWithAuth(`/api/coach/clients/${clientId}/check-ins`),
        ]);
        if (formsRes.ok) {
          const data = await formsRes.json();
          setAllocationForms(Array.isArray(data) ? data : []);
        }
        if (checkInsRes.ok) {
          const data = await checkInsRes.json();
          setAllocationAssignments(Array.isArray(data) ? data : []);
        }
      } catch {
        // non-fatal
      }
    })();
  }, [clientId, fetchWithAuth]);

  const handleAssignCheckIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!assignFormId || !assignWeek) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: assignFormId, reflectionWeekStart: assignWeek }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignError(data.message ?? "Failed to assign check-in.");
        return;
      }
      setAssignError(null);
      const newRow = {
        id: data.assignmentId ?? "",
        formTitle: allocationForms.find((f) => f.id === assignFormId)?.title ?? "Check-in",
        formId: assignFormId,
        status: "pending",
        reflectionWeekStart: assignWeek,
        responseId: null,
      };
      setAllocationAssignments((prev) => [newRow, ...prev]);
      setAssignFormId("");
      setAssignWeek("");
    } finally {
      setAssigning(false);
    }
  };

  // Load payment history when client has a Stripe customer linked
  useEffect(() => {
    if (!clientId || !form.stripeCustomerId) {
      setBillingHistoryInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setBillingHistoryLoading(true);
      try {
        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/history`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setBillingHistoryInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        } else {
          setBillingHistoryInvoices([]);
        }
      } finally {
        if (!cancelled) setBillingHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, form.stripeCustomerId, fetchWithAuth]);

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
          scoringProfile: form.scoringProfile || undefined,
          trafficLightRedMax: form.trafficLightRedMax,
          trafficLightOrangeMax: form.trafficLightOrangeMax,
          programStartDate: form.programStartDate || undefined,
          programDurationWeeks: form.programDurationWeeks ?? undefined,
          checkInFrequency: form.checkInFrequency,
          communicationPreference: form.communicationPreference,
          coachNotes: form.coachNotes,
          stripeCustomerId: form.stripeCustomerId || undefined,
          packagePaidAt: form.packagePaidAt || undefined,
          packageMonths: form.packageMonths ?? undefined,
          packageFreeWeeks: form.packageFreeWeeks,
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
        <Button asChild variant="secondary">
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

          {/* Check-in allocation */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Check-in allocation</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Choose a check-in form and the first week this client&apos;s check-ins start (week beginning Monday). You can also assign from the client&apos;s Check-ins tab.
            </p>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="min-w-[200px]">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Form</label>
                <select
                  value={assignFormId}
                  onChange={(e) => setAssignFormId(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="">Select form</option>
                  {allocationForms.map((f) => (
                    <option key={f.id} value={f.id}>{f.title ?? f.id}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px]">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">First week check-ins start</label>
                <select
                  value={assignWeek}
                  onChange={(e) => setAssignWeek(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="">Select week</option>
                  {allocationWeekOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={() => handleAssignCheckIn()}
                disabled={!assignFormId || !assignWeek || assigning}
              >
                {assigning ? "Assigning…" : "Assign check-in"}
              </Button>
            </div>
            {assignError && (
              <p className="text-sm text-[var(--color-error)] mb-4" role="alert">{assignError}</p>
            )}
            {allocationAssignments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[var(--color-text)] mb-2">Current assignments</p>
                <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
                  {allocationAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-[var(--color-text)]">{a.formTitle}</span>
                      <span className="text-[var(--color-text-muted)]">
                        {a.reflectionWeekStart ? formatDateDisplay(a.reflectionWeekStart) : "—"}
                      </span>
                      <span className="capitalize text-[var(--color-text-muted)]">{a.status}</span>
                      {a.responseId && (
                        <Link
                          href={`/coach/clients/${clientId}/responses/${a.responseId}`}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          View response
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  <Link href={`/coach/clients/${clientId}`} className="text-[var(--color-primary)] hover:underline">
                    Manage all check-ins →
                  </Link>
                </p>
              </div>
            )}
          </Card>

          {/* Traffic light thresholds */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Traffic light thresholds</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Set red / orange / green percentage splits for scoring (0–100%). Form-level thresholds override these when set.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Scoring profile</label>
              <select
                value={form.scoringProfile}
                onChange={(e) => {
                  const id = e.target.value;
                  const preset = SCORING_PROFILES.find((p) => p.id === id);
                  setForm((p) => ({
                    ...p,
                    scoringProfile: id,
                    ...(preset && preset.id !== "custom" ? { trafficLightRedMax: preset.redMax, trafficLightOrangeMax: preset.orangeMax } : {}),
                  }));
                }}
                className="min-w-[280px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {SCORING_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0" aria-hidden />
                <span className="text-sm text-[var(--color-text)]">Red (0–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.trafficLightRedMax}
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setForm((p) => ({ ...p, trafficLightRedMax: v, scoringProfile: "custom" }));
                  }}
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
                  onChange={(e) => {
                    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setForm((p) => ({ ...p, trafficLightOrangeMax: v, scoringProfile: "custom" }));
                  }}
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
              Add links (name + URL) and they’re added to this client’s list. The client sees them on their dashboard. Click &quot;Save settings&quot; when done.
            </p>

            {/* Assigned list – shown first */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Assigned meal plans</h3>
              {form.mealPlanLinks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] py-2">No meal plans yet. Add one below (or pick from the dropdown).</p>
              ) : (
                <ul className="space-y-2">
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
            </div>

            {/* Add a link: name + URL → added to list */}
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Add a link</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-2">Enter a name and URL; it will be added to the list above.</p>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <input
                type="text"
                placeholder="Name (e.g. Week 1–4 Plan)"
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
                onClick={() => {
                  const url = newMealPlanUrl.trim();
                  if (!url) return;
                  setForm((p) => ({ ...p, mealPlanLinks: [...p.mealPlanLinks, { label: newMealPlanLabel.trim() || "Meal plan", url }] }));
                  setNewMealPlanLabel("");
                  setNewMealPlanUrl("");
                }}
              >
                Add to list
              </Button>
            </div>

            {/* Predefined dropdown */}
            <div className="pt-3 border-t border-[var(--color-border)]">
              <label htmlFor="predefined-meal-plan" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Or pick from Hub Vana plans
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
                  Add to list
                </Button>
              </div>
            </div>
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-text-muted)]">
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
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={syncBillingLoading}
                    onClick={async () => {
                      setBillingError(null);
                      setSyncBillingLoading(true);
                      try {
                        const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/sync`, { method: "POST" });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.paymentStatus != null) {
                          setForm((f) => ({ ...f, paymentStatus: data.paymentStatus }));
                          const profileRes = await fetchWithAuth(`/api/coach/clients/${clientId}/profile`);
                          if (profileRes.ok) {
                            const p = await profileRes.json();
                            setForm((f) => ({ ...f, paymentStatus: p.paymentStatus ?? null }));
                          }
                          const subRes = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/subscription`);
                          if (subRes.ok) {
                            const subData = await subRes.json();
                            setSubscription(subData.subscription ?? null);
                          } else {
                            setSubscription(null);
                          }
                        } else {
                          setBillingError((data && data.error) || "Sync failed");
                        }
                      } catch {
                        setBillingError("Sync failed");
                      } finally {
                        setSyncBillingLoading(false);
                      }
                    }}
                  >
                    {syncBillingLoading ? "Syncing…" : "Sync from Stripe"}
                  </Button>
                </div>
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
                {/* Payment history (expandable) */}
                <div className="mt-6 border-t border-[var(--color-border)] pt-6">
                  <button
                    type="button"
                    onClick={() => setPaymentHistoryExpanded((e) => !e)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left hover:bg-[var(--color-bg-elevated)]"
                  >
                    <h3 className="text-base font-medium text-[var(--color-text)]">
                      Payment history
                      {!billingHistoryLoading && billingHistoryInvoices.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                          ({billingHistoryInvoices.length} invoice{billingHistoryInvoices.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </h3>
                    <span className="text-[var(--color-text-muted)]" aria-hidden>
                      {paymentHistoryExpanded ? "▼" : "▶"}
                    </span>
                  </button>
                  {paymentHistoryExpanded && (
                    <>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-[var(--color-text-muted)]">
                          From Stripe. For full report, open Payment from the menu and click the client.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={billingHistoryLoading}
                          onClick={async () => {
                            if (!clientId) return;
                            setBillingHistoryLoading(true);
                            try {
                              const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/history`);
                              if (res.ok) {
                                const data = await res.json();
                                setBillingHistoryInvoices(Array.isArray(data.invoices) ? data.invoices : []);
                              }
                            } finally {
                              setBillingHistoryLoading(false);
                            }
                          }}
                        >
                          {billingHistoryLoading ? "Loading…" : "Refresh"}
                        </Button>
                      </div>
                      {billingHistoryLoading && (
                        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Loading…</p>
                      )}
                      {!billingHistoryLoading && billingHistoryInvoices.length === 0 && (
                        <p className="mt-2 text-sm text-[var(--color-text-muted)]">No invoices yet for this customer.</p>
                      )}
                      {!billingHistoryLoading && billingHistoryInvoices.length > 0 && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-border)]">
                          <table className="w-full min-w-[500px] text-sm">
                            <thead>
                              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                                <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Date</th>
                                <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Amount</th>
                                <th className="px-3 py-2 text-left font-medium text-[var(--color-text)]">Status</th>
                                <th className="px-3 py-2 text-right font-medium text-[var(--color-text)]">Invoice</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...billingHistoryInvoices]
                                .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""))
                                .map((inv) => (
                                  <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-b-0">
                                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                                      {inv.created ? formatDateDisplay(inv.created) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text)]">
                                      {formatBillingAmount(inv.amountPaid || inv.amountDue, inv.currency)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={
                                          inv.paid
                                            ? "text-green-600 dark:text-green-400"
                                            : inv.status === "uncollectible"
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-[var(--color-text-muted)]"
                                        }
                                      >
                                        {inv.status ?? "—"}
                                      </span>
                                    </td>
                                <td className="px-3 py-2 text-right">
                                      <span className="flex items-center justify-end gap-2">
                                        {(inv.status === "uncollectible" || inv.status === "open") && !inv.paid && (
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={retryingInvoiceId !== null}
                                            onClick={async () => {
                                              if (!clientId) return;
                                              setRetryingInvoiceId(inv.id);
                                              try {
                                                const res = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/retry-invoice`, {
                                                  method: "POST",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ invoiceId: inv.id }),
                                                });
                                                const data = await res.json().catch(() => ({}));
                                                if (res.ok) {
                                                  const histRes = await fetchWithAuth(`/api/coach/clients/${clientId}/billing/history`);
                                                  if (histRes.ok) {
                                                    const h = await histRes.json();
                                                    setBillingHistoryInvoices(Array.isArray(h.invoices) ? h.invoices : []);
                                                  }
                                                } else {
                                                  alert((data && data.error) || "Retry failed");
                                                }
                                              } finally {
                                                setRetryingInvoiceId(null);
                                              }
                                            }}
                                          >
                                            {retryingInvoiceId === inv.id ? "Retrying…" : "Retry payment"}
                                          </Button>
                                        )}
                                        {inv.hostedInvoiceUrl ? (
                                          <a
                                            href={inv.hostedInvoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[var(--color-primary)] hover:underline"
                                          >
                                            View
                                          </a>
                                        ) : inv.invoicePdf ? (
                                          <a
                                            href={inv.invoicePdf}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[var(--color-primary)] hover:underline"
                                          >
                                            PDF
                                          </a>
                                        ) : null}
                                        {!inv.hostedInvoiceUrl && !inv.invoicePdf && "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Upfront package: months + free weeks, expiry auto-calculated */}
          <Card className="p-6">
            <h2 className="text-lg font-medium text-[var(--color-text)] mb-1">Upfront package</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              For clients who paid upfront. Set payment date, months and free weeks — expiry is calculated automatically.
            </p>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Payment date</label>
                <input
                  type="date"
                  value={form.packagePaidAt || ""}
                  onChange={(e) => setForm((p) => ({ ...p, packagePaidAt: e.target.value }))}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Months</label>
                <select
                  value={form.packageMonths ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, packageMonths: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Free weeks</label>
                <input
                  type="number"
                  min={0}
                  max={52}
                  value={form.packageFreeWeeks}
                  onChange={(e) => setForm((p) => ({ ...p, packageFreeWeeks: Math.max(0, Math.min(52, Number(e.target.value) || 0)) }))}
                  className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
              <div className="min-w-[140px]">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-muted)]">Expires</span>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {form.packagePaidAt && form.packageMonths != null
                    ? formatDateDisplay(
                        (() => {
                          const d = new Date(form.packagePaidAt);
                          if (Number.isNaN(d.getTime())) return "";
                          d.setMonth(d.getMonth() + form.packageMonths!);
                          d.setDate(d.getDate() + form.packageFreeWeeks * 7);
                          return d.toISOString().slice(0, 10);
                        })()
                      )
                    : "—"}
                </p>
              </div>
            </div>
            {(form.packagePaidAt || form.packageMonths != null) && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                {form.packagePaidAt && form.packageMonths != null
                  ? `Paid ${formatDateDisplay(form.packagePaidAt)} · ${form.packageMonths} month${form.packageMonths !== 1 ? "s" : ""}${form.packageFreeWeeks > 0 ? ` + ${form.packageFreeWeeks} free week${form.packageFreeWeeks !== 1 ? "s" : ""}` : ""}`
                  : form.packagePaidAt
                    ? `Paid ${formatDateDisplay(form.packagePaidAt)}`
                    : ""}
              </p>
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
