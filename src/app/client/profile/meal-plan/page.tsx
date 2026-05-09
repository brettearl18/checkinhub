"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";
import { MealPlanViewer } from "@/components/client/MealPlanViewer";

type ClientProfileResponse = {
  mealPlanJson?: Record<string, unknown> | null;
};

export default function ClientMealPlanPage() {
  const { fetchWithAuth } = useApiClient();
  const [mealPlanJson, setMealPlanJson] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setAuthError(false);
      try {
        const res = await fetchWithAuth("/api/client/profile");
        if (res.status === 401) {
          setAuthError(true);
          return;
        }
        if (!res.ok) {
          setError("Could not load meal plan.");
          return;
        }
        const data = (await res.json()) as ClientProfileResponse;
        const plan = data.mealPlanJson;
        setMealPlanJson(plan && typeof plan === "object" && !Array.isArray(plan) ? plan : null);
      } catch {
        setError("Could not load meal plan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  if (authError) return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading meal plan...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Your meal plan</h1>
        <Button asChild variant="secondary">
          <Link href="/client/profile">Back to profile</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      {!error && !mealPlanJson && (
        <Card className="p-6">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No meal plan uploaded yet. Your coach can upload one in your client settings.
          </p>
        </Card>
      )}

      {!error && mealPlanJson && <MealPlanViewer plan={mealPlanJson} />}
    </div>
  );
}
