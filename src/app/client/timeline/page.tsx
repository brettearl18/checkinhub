"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ProgressTimeline } from "@/components/client/ProgressTimeline";
import { useApiClient } from "@/lib/api-client";
import type { TimelineWeek } from "@/lib/progress-timeline";

export default function ClientTimelinePage() {
  const { fetchWithAuth } = useApiClient();
  const [weeks, setWeeks] = useState<TimelineWeek[]>([]);
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuthError(false);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/client/progress-timeline");
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (!res.ok) {
          setError("Could not load timeline.");
          return;
        }
        const data = await res.json();
        setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
        setTrafficLightRedMax(typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40);
        setTrafficLightOrangeMax(
          typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70
        );
      } catch {
        setError("Could not load timeline.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/client/progress2" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Progress dashboard
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Your timeline</h1>
          <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
            Trial
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Your full journey by week — check-in scores, body measurements, habits, and photos in one view.
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <ProgressTimeline
          weeks={weeks}
          trafficLightRedMax={trafficLightRedMax}
          trafficLightOrangeMax={trafficLightOrangeMax}
        />
      )}
    </div>
  );
}
