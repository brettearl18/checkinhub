"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CycleOnboardingForm } from "@/components/client/CycleOnboardingForm";
import { useApiClient } from "@/lib/api-client";
import {
  CYCLE_HISTORY_3_MONTHS_DAYS,
  type CycleProfile,
  type CycleSetupInput,
} from "@/lib/cycle-tracking";

type Step = "intro" | "setup" | "done";

export function CycleTrackerPromoModal({
  open,
  trackingEnabled,
  onClose,
  onComplete,
}: {
  open: boolean;
  trackingEnabled: boolean;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const { fetchWithAuth } = useApiClient();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(trackingEnabled ? "setup" : "intro");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(trackingEnabled ? "setup" : "intro");
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, trackingEnabled]);

  if (!open || !mounted) return null;

  const dismissPromo = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetchWithAuth("/api/client/cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissCyclePromo: true }),
      });
      onClose();
    } catch {
      setError("Could not save your preference.");
    } finally {
      setSaving(false);
    }
  };

  const optIn = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingEnabled: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(typeof json.error === "string" ? json.error : "Could not start cycle tracking");
        return;
      }
      window.dispatchEvent(new CustomEvent("cycle-tracking-updated", { detail: { enabled: true } }));
      setStep("setup");
    } catch {
      setError("Could not start cycle tracking");
    } finally {
      setSaving(false);
    }
  };

  const completeSetup = async (setup: CycleSetupInput) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/cycle/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...setup, historyMaxDays: CYCLE_HISTORY_3_MONTHS_DAYS }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save setup");
        return;
      }
      setStep("done");
      onComplete?.();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cycle-promo-title"
      >
        {step === "intro" && (
          <Card className="flex max-h-[min(92vh,760px)] flex-col overflow-hidden border-0 shadow-none">
            <div className="overflow-y-auto p-6">
              <h2 id="cycle-promo-title" className="text-xl font-semibold text-[var(--color-text)]">
                Optional cycle tracking
              </h2>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Track your period, mood, and energy to see estimated cycle phases and wellbeing guides. Nothing is
                shared with your coach unless you choose to later.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>· Log your most recent period to get started</li>
                <li>· Optionally backfill up to <strong className="text-[var(--color-text)]">3 months</strong> of past periods if you remember them</li>
                <li>· Skip earlier dates any time — only fill in what you know</li>
              </ul>
              {error && <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p>}
            </div>
            <div className="shrink-0 border-t border-[var(--color-border)] p-4 flex flex-col gap-2">
              <Button type="button" className="w-full" disabled={saving} onClick={optIn}>
                {saving ? "Starting…" : "Set up cycle tracking"}
              </Button>
              <Button type="button" variant="secondary" className="w-full" disabled={saving} onClick={dismissPromo}>
                Not now
              </Button>
            </div>
          </Card>
        )}

        {step === "setup" && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <CycleOnboardingForm
              variant="setup"
              saving={saving}
              error={error}
              historyMaxDays={CYCLE_HISTORY_3_MONTHS_DAYS}
              seedPastPeriodRows
              onCancel={dismissPromo}
              onSubmit={completeSetup}
            />
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <Button type="button" variant="secondary" className="w-full" disabled={saving} onClick={dismissPromo}>
                Skip for now
              </Button>
              <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                You can set this up later from the Cycle page in the menu.
              </p>
            </div>
          </div>
        )}

        {step === "done" && (
          <Card className="border-0 p-6 text-center shadow-none">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Cycle tracking is ready</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Your setup is saved. Open the Cycle page any time to log mood, energy, and period days.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/client/cycle" onClick={onClose}>
                  Open cycle tracker
                </Link>
              </Button>
              <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
                Back to dashboard
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>,
    document.body
  );
}

export async function fetchShouldShowCyclePromo(
  fetchWithAuth: (url: string, init?: RequestInit) => Promise<Response>
): Promise<{ show: boolean; trackingEnabled: boolean; profile: CycleProfile | null }> {
  try {
    const res = await fetchWithAuth("/api/client/cycle");
    if (!res.ok) return { show: false, trackingEnabled: false, profile: null };
    const json = await res.json();
    const profile = json.profile as CycleProfile;
    const show =
      !profile.cyclePromoDismissedAt &&
      !profile.setupCompleted;
    return { show, trackingEnabled: Boolean(profile.trackingEnabled), profile };
  } catch {
    return { show: false, trackingEnabled: false, profile: null };
  }
}
