"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ProgressTimeline } from "@/components/client/ProgressTimeline";
import { useApiClient } from "@/lib/api-client";
import type { TimelineWeek } from "@/lib/progress-timeline";
import { coachTimelineLinks } from "@/lib/timeline-links";

export default function CoachClientTimelinePage() {
  const params = useParams();
  const clientId = params?.clientId as string | undefined;
  const { fetchWithAuth } = useApiClient();
  const [clientName, setClientName] = useState("");
  const [weeks, setWeeks] = useState<TimelineWeek[]>([]);
  const [trafficLightRedMax, setTrafficLightRedMax] = useState(40);
  const [trafficLightOrangeMax, setTrafficLightOrangeMax] = useState(70);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const links = useMemo(() => coachTimelineLinks(clientId ?? ""), [clientId]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      setAuthError(false);
      setError(null);
      try {
        const [timelineRes, profileRes] = await Promise.all([
          fetchWithAuth(`/api/coach/clients/${clientId}/progress-timeline`),
          fetchWithAuth(`/api/coach/clients/${clientId}/profile`),
        ]);
        if (timelineRes.status === 401 || profileRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (!timelineRes.ok) {
          setError("Could not load timeline.");
          return;
        }
        const data = await timelineRes.json();
        setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
        setTrafficLightRedMax(typeof data.trafficLightRedMax === "number" ? data.trafficLightRedMax : 40);
        setTrafficLightOrangeMax(
          typeof data.trafficLightOrangeMax === "number" ? data.trafficLightOrangeMax : 70
        );
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
          setClientName(name || "Client");
        }
      } catch {
        setError("Could not load timeline.");
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, fetchWithAuth]);

  if (!clientId) {
    return <p className="text-[var(--color-text-muted)]">Invalid client.</p>;
  }

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/coach/clients/${clientId}/progress`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Progress dashboard
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">
              Timeline{clientName ? `: ${clientName}` : ""}
            </h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Week-by-week check-ins, measurements, habits, and photos — click any panel to open the detail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}`}>Check-ins</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/coach/clients/${clientId}/progress`}>Progress</Link>
          </Button>
        </div>
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
          links={links}
          audience="coach"
        />
      )}
    </div>
  );
}
