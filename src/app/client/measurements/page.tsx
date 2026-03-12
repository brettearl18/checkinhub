"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { MeasurementLineChartLazy } from "@/components/ui/MeasurementLineChartLazy";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";

interface Measurement {
  id: string;
  date: string | null;
  bodyWeight: number | null;
  measurements: Record<string, number>;
  isBaseline: boolean;
}

const MEASUREMENT_KEYS = [
  "waist",
  "hips",
  "chest",
  "leftThigh",
  "rightThigh",
  "leftArm",
  "rightArm",
] as const;

const measurementLabels: Record<string, string> = {
  waist: "Waist",
  hips: "Hips",
  chest: "Chest",
  leftThigh: "L thigh",
  rightThigh: "R thigh",
  leftArm: "L arm",
  rightArm: "R arm",
};

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
  const [chartMetric, setChartMetric] = useState<"bodyWeight" | (typeof MEASUREMENT_KEYS)[number]>("bodyWeight");

  const chartData = useMemo(() => {
    const chronological = [...list].filter((m) => m.date).reverse();
    return chronological
      .map((m) => {
        let value: number | null = null;
        if (chartMetric === "bodyWeight") value = m.bodyWeight ?? null;
        else value = m.measurements?.[chartMetric] ?? null;
        if (value == null) return null;
        return { date: m.date!, value };
      })
      .filter((p): p is { date: string; value: number } => p != null);
  }, [list, chartMetric]);

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
          isBaseline: list.length === 0, // First measurement = baseline
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

  const formLabels: Record<string, string> = {
    waist: "Waist (cm)",
    hips: "Hips (cm)",
    chest: "Chest (cm)",
    leftThigh: "Left thigh (cm)",
    rightThigh: "Right thigh (cm)",
    leftArm: "Left arm (cm)",
    rightArm: "Right arm (cm)",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/client" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">Measurements</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Track your weight and body measurements over time.
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Add measurement"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">New entry</h2>
          <form onSubmit={handleAdd} className="mt-4 space-y-4">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input label="Body weight (kg)" type="number" step="0.1" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} placeholder="e.g. 72.5" />
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Body measurements (cm) – optional</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {MEASUREMENT_KEYS.map((key) => (
                  <Input
                    key={key}
                    label={formLabels[key]}
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
        <>
          <Card className="p-4">
            <h2 className="text-lg font-medium text-[var(--color-text)]">Trends</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              View progress over time
            </p>
            <div className="mt-3">
              <label className="sr-only" htmlFor="chart-metric">Metric</label>
              <select
                id="chart-metric"
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as typeof chartMetric)}
                className="mb-4 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="bodyWeight">Body weight (kg)</option>
                {MEASUREMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {measurementLabels[key]} (cm)
                  </option>
                ))}
              </select>
            </div>
            {chartData.length > 0 ? (
              <MeasurementLineChartLazy
                data={chartData}
                unit={chartMetric === "bodyWeight" ? "kg" : "cm"}
              />
            ) : (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                No data for this metric yet.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">Weight</th>
                  {MEASUREMENT_KEYS.map((key) => (
                    <th key={key} className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">
                      {measurementLabels[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-primary-subtle)]/20">
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--color-text)]">{formatDateDisplay(m.date)}</span>
                      {m.isBaseline && (
                        <span className="ml-2 inline rounded bg-[var(--color-primary-subtle)] px-1.5 py-0.5 text-xs text-[var(--color-primary)]">
                          Baseline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-text)]">
                      {m.bodyWeight != null ? `${m.bodyWeight} kg` : "—"}
                    </td>
                    {MEASUREMENT_KEYS.map((key) => (
                      <td key={key} className="px-4 py-3 text-right text-[var(--color-text)]">
                        {m.measurements?.[key] != null ? `${m.measurements[key]} cm` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-[var(--color-text-muted)]">
            Scroll horizontally on small screens to see all columns.
          </p>
        </Card>
        </>
      )}
    </div>
  );
}
