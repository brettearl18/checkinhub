"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

export default function ClientMeasurementsPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bodyWeight, setBodyWeight] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>({
    waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "",
  });

  const measurementLabels: Record<string, string> = {
    waist: "Waist (cm)",
    hips: "Hips (cm)",
    chest: "Chest (cm)",
    leftThigh: "Left thigh (cm)",
    rightThigh: "Right thigh (cm)",
    leftArm: "Left arm (cm)",
    rightArm: "Right arm (cm)",
  };

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/client/measurements");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const measurementsNum: Record<string, number> = {};
      for (const [key, value] of Object.entries(measurements)) {
        const n = value.trim() ? Number(value) : undefined;
        if (n != null && !Number.isNaN(n)) measurementsNum[key] = n;
      }
      const res = await fetchWithAuth("/api/client/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          bodyWeight: bodyWeight ? Number(bodyWeight) : undefined,
          measurements: Object.keys(measurementsNum).length ? measurementsNum : undefined,
        }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        setShowForm(false);
        setBodyWeight("");
        setMeasurements({ waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "" });
        setDate(new Date().toISOString().slice(0, 10));
        await load();
      }
    } finally {
      setAdding(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Measurements</h1>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add measurement"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Body weight (kg)" type="number" step="0.1" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} placeholder="e.g. 72.5" />
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Measurements (cm) – optional</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(measurementLabels) as Array<keyof typeof measurementLabels>).map((key) => (
                  <Input
                    key={key}
                    label={measurementLabels[key]}
                    type="number"
                    step="0.1"
                    value={measurements[key] ?? ""}
                    onChange={(e) => setMeasurements((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="—"
                  />
                ))}
              </div>
            </div>
            <Button type="submit" variant="primary" disabled={adding}>{adding ? "Adding…" : "Add"}</Button>
          </form>
        </Card>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <EmptyState
          title="No measurements yet"
          description="Add your first body weight or measurement to track progress."
          actionLabel="Add measurement"
          onAction={() => setShowForm(true)}
        />
      )}
      {!loading && list.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {list.map((m) => {
              const hasMeasurements = m.measurements && Object.keys(m.measurements).length > 0;
              return (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">{m.date}</span>
                    <span className="text-sm text-[var(--color-text)]">
                      {m.bodyWeight != null ? `${m.bodyWeight} kg` : ""}
                    </span>
                  </div>
                  {hasMeasurements && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                      {(Object.entries(m.measurements) as [string, number][]).map(([key, value]) => (
                        <span key={key}>
                          {measurementLabels[key] ?? key}: {value} cm
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
