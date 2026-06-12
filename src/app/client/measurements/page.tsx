"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { MeasurementLineChartLazy } from "@/components/ui/MeasurementLineChartLazy";
import { MeasurementComparisonChartLazy } from "@/components/ui/MeasurementComparisonChartLazy";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay, toLocalDateString } from "@/lib/format-date";

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
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [importDate, setImportDate] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [importBodyWeight, setImportBodyWeight] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>({
    waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "",
  });
  const [importMeasurements, setImportMeasurements] = useState<Record<string, string>>({
    waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const todayKey = toLocalDateString(new Date());
  const [chartMetric, setChartMetric] = useState<"bodyWeight" | (typeof MEASUREMENT_KEYS)[number] | "arms" | "thighs">("bodyWeight");
  const chartData = useMemo(() => {
    if (chartMetric === "arms" || chartMetric === "thighs") return [];
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

  const comparisonChartData = useMemo(() => {
    if (chartMetric !== "arms" && chartMetric !== "thighs") return [];
    const keys = chartMetric === "arms" ? (["leftArm", "rightArm"] as const) : (["leftThigh", "rightThigh"] as const);
    const chronological = [...list]
      .filter((m) => m.date)
      .sort((a, b) => (a.date!).localeCompare(b.date!));
    return chronological
      .map((m) => {
        const row: Record<string, number | string | undefined> = { date: m.date! };
        for (const k of keys) row[k] = m.measurements?.[k] ?? undefined;
        return row;
      })
      .filter((row) => keys.some((k) => row[k] != null));
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

  const scrollToHashEntry = useCallback(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash.startsWith("measurement-")) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-[var(--color-primary-subtle)]");
      window.setTimeout(() => el.classList.remove("bg-[var(--color-primary-subtle)]"), 2000);
    }
  }, []);

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!loading && list.length > 0) scrollToHashEntry();
  }, [loading, list.length, scrollToHashEntry]);

  const buildMeasurementsPayload = (source: Record<string, string>) => {
    const measurementsNum: Record<string, number> = {};
    for (const [key, value] of Object.entries(source)) {
      const n = value.trim() ? Number(value) : undefined;
      if (n != null && !Number.isNaN(n)) measurementsNum[key] = n;
    }
    return measurementsNum;
  };

  const submitMeasurement = async ({
    entryDate,
    weight,
    measurementFields,
    importHistorical,
  }: {
    entryDate: string;
    weight: string;
    measurementFields: Record<string, string>;
    importHistorical: boolean;
  }) => {
    const measurementsNum = buildMeasurementsPayload(measurementFields);
    const weightNum = weight.trim() ? Number(weight) : undefined;
    const hasWeight = weightNum != null && !Number.isNaN(weightNum);
    const hasMeasurements = Object.keys(measurementsNum).length > 0;

    if (!entryDate) {
      throw new Error("Choose a date for this entry.");
    }
    if (!hasWeight && !hasMeasurements) {
      throw new Error("Add weight and/or at least one body measurement.");
    }

    const res = await fetchWithAuth("/api/client/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: entryDate,
        bodyWeight: hasWeight ? weightNum : undefined,
        measurements: hasMeasurements ? measurementsNum : undefined,
        importHistorical,
      }),
    });

    if (res.status === 401) {
      setAuthError(true);
      return false;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body.error as string) || "Could not save entry.");
    }

    await res.json();
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setFormError(null);
    try {
      const ok = await submitMeasurement({
        entryDate: date,
        weight: bodyWeight,
        measurementFields: measurements,
        importHistorical: false,
      });
      if (ok) {
        setShowForm(false);
        setBodyWeight("");
        setMeasurements({ waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "" });
        setDate(toLocalDateString(new Date()));
        await load();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setAdding(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const ok = await submitMeasurement({
        entryDate: importDate,
        weight: importBodyWeight,
        measurementFields: importMeasurements,
        importHistorical: true,
      });
      if (ok) {
        setImportBodyWeight("");
        setImportMeasurements({ waist: "", hips: "", chest: "", leftThigh: "", rightThigh: "", leftArm: "", rightArm: "" });
        setImportSuccess("Historical entry saved. The earliest date becomes your baseline in charts.");
        await load();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setImporting(false);
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
            <h1 className="vana-page-title">Measurements</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Log weight and tape measurements over time. Import older entries from before CheckinHUB with the real date — your earliest entry becomes the baseline in progress charts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showImportForm ? "secondary" : "primary"}
              onClick={() => {
                setShowImportForm((open) => !open);
                setImportError(null);
                setImportSuccess(null);
              }}
            >
              {showImportForm ? "Close import" : "Import before CheckinHUB"}
            </Button>
            <Button
              variant={showForm ? "secondary" : "primary"}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "Add today"}
            </Button>
          </div>
        </div>
      </div>

      {showImportForm && (
        <Card className="vana-card border-dashed border-[var(--color-primary-muted)] p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Import before CheckinHUB</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add a starting weight or measurements from an old spreadsheet, app, or coach records. Pick the date it was actually taken.
          </p>
          <form onSubmit={handleImport} className="mt-4 space-y-4">
            <Input
              label="Date taken"
              type="date"
              required
              max={todayKey}
              value={importDate}
              onChange={(e) => setImportDate(e.target.value)}
            />
            <Input
              label="Body weight (kg)"
              type="number"
              step="0.1"
              value={importBodyWeight}
              onChange={(e) => setImportBodyWeight(e.target.value)}
              placeholder="e.g. 78.2"
            />
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Body measurements (cm) – optional</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {MEASUREMENT_KEYS.map((key) => (
                  <Input
                    key={key}
                    label={formLabels[key]}
                    type="number"
                    step="0.1"
                    value={importMeasurements[key] ?? ""}
                    onChange={(e) => setImportMeasurements((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="—"
                  />
                ))}
              </div>
            </div>
            {importError && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {importError}
              </p>
            )}
            {importSuccess && (
              <p className="text-sm text-emerald-600" role="status">
                {importSuccess}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={importing}>
              {importing ? "Saving…" : "Save historical entry"}
            </Button>
          </form>
        </Card>
      )}

      {showForm && (
        <Card className="vana-card p-6">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Log today</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            For current check-ins. Same calendar day updates your existing entry.
          </p>
          <form onSubmit={handleAdd} className="mt-4 space-y-4">
            <Input
              label="Date"
              type="date"
              max={todayKey}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
            {formError && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={adding}>{adding ? "Adding…" : "Add"}</Button>
          </form>
        </Card>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <EmptyState
          title="No measurements yet"
          description="Import a starting weight from before CheckinHUB, or log today's measurement."
          actionLabel="Import before CheckinHUB"
          onAction={() => setShowImportForm(true)}
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
                <option value="arms">Arms (L &amp; R)</option>
                <option value="thighs">Thighs (L &amp; R)</option>
                {MEASUREMENT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {measurementLabels[key]} (cm)
                  </option>
                ))}
              </select>
            </div>
            {chartMetric === "arms" || chartMetric === "thighs" ? (
              comparisonChartData.length > 0 ? (
                <MeasurementComparisonChartLazy
                  data={comparisonChartData}
                  unit="cm"
                  series={
                    chartMetric === "arms"
                      ? [
                          { dataKey: "leftArm", name: "L arm", color: "var(--color-primary)" },
                          { dataKey: "rightArm", name: "R arm", color: "#0ea5e9", strokeDasharray: "6 4" },
                        ]
                      : [
                          { dataKey: "leftThigh", name: "L thigh", color: "var(--color-primary)" },
                          { dataKey: "rightThigh", name: "R thigh", color: "#0ea5e9", strokeDasharray: "6 4" },
                        ]
                  }
                />
              ) : (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No data yet. Add measurements to compare L &amp; R.
                </p>
              )
            ) : chartData.length > 0 ? (
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
                  <tr
                    key={m.id}
                    id={`measurement-${m.id}`}
                    className="scroll-mt-24 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-primary-subtle)]/20"
                  >
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
