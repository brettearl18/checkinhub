"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApiClient } from "@/lib/api-client";
import {
  needsCycleSetup,
  shouldShowCycleDashboardBanner,
  type CycleProfile,
} from "@/lib/cycle-tracking";

function bannerCta(profile: Pick<CycleProfile, "trackingEnabled" | "setupCompleted">): string {
  if (needsCycleSetup(profile)) return "Finish setup →";
  if (profile.setupCompleted) return "Open cycle tracker →";
  return "Try cycle tracker →";
}

export function CycleTrackerDashboardBanner() {
  const { fetchWithAuth } = useApiClient();
  const [visible, setVisible] = useState(false);
  const [cta, setCta] = useState("Try cycle tracker →");
  const [dismissing, setDismissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/client/cycle");
      if (!res.ok) return;
      const json = await res.json();
      const profile = json.profile as CycleProfile;
      setVisible(shouldShowCycleDashboardBanner(profile));
      setCta(bannerCta(profile));
    } catch {
      // non-fatal — auth refresh failures should not crash the dashboard
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener("cycle-tracking-updated", onUpdate);
    return () => window.removeEventListener("cycle-tracking-updated", onUpdate);
  }, [load]);

  const dismiss = async () => {
    setDismissing(true);
    try {
      await fetchWithAuth("/api/client/cycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissCycleDashboardBanner: true }),
      });
      setVisible(false);
    } finally {
      setDismissing(false);
    }
  };

  if (!visible) return null;

  return (
    <section className="mt-4" aria-labelledby="cycle-tracker-banner-title">
      <div className="overflow-hidden rounded-2xl border border-[#c9b8e8]/60 bg-gradient-to-r from-[#f7f3fc] via-[#faf7f2] to-[#f3eef9] shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[#8f7ec8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                New
              </span>
              <h2 id="cycle-tracker-banner-title" className="font-display text-lg font-medium text-stone-800">
                Cycle tracker
              </h2>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
              Track your period, mood, and energy with optional phase guides. It&apos;s private unless you choose to
              share with your coach.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/client/cycle"
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              {cta}
            </Link>
            <button
              type="button"
              onClick={dismiss}
              disabled={dismissing}
              className="text-xs font-medium text-stone-500 transition hover:text-stone-700 disabled:opacity-60"
            >
              {dismissing ? "Saving…" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
