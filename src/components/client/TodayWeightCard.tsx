"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";
import { formatDateDisplay } from "@/lib/format-date";
import { todayPerth } from "@/lib/perth-date";

interface WeightEntry {
  date: string | null;
  bodyWeight: number | null;
}

interface Props {
  measurements: WeightEntry[];
  onSaved: () => void;
  className?: string;
  /** Scroll to the card and focus the input (e.g. opened from the 7am reminder). */
  focusOnMount?: boolean;
}

const MIN_KG = 20;
const MAX_KG = 400;

function addDays(yyyyMmDd: string, delta: number): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Quick daily body-weight entry on the client dashboard. */
export function TodayWeightCard({ measurements, onSaved, className = "", focusOnMount = false }: Props) {
  const { fetchWithAuth } = useApiClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = todayPerth();

  useEffect(() => {
    if (!focusOnMount) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const { todayWeight, lastEntry, daysLoggedThisWeek } = useMemo(() => {
    const weighed = measurements.filter(
      (m): m is { date: string; bodyWeight: number } =>
        typeof m.date === "string" && typeof m.bodyWeight === "number" && !Number.isNaN(m.bodyWeight)
    );
    const todayMatch = weighed.find((m) => m.date === today) ?? null;
    const previous = weighed
      .filter((m) => m.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const weekStart = addDays(today, -6);
    const days = new Set(weighed.filter((m) => m.date >= weekStart && m.date <= today).map((m) => m.date));
    return { todayWeight: todayMatch?.bodyWeight ?? null, lastEntry: previous, daysLoggedThisWeek: days.size };
  }, [measurements, today]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const kg = Number(value);
    if (!value.trim() || !Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) {
      setError(`Enter your weight in kg (${MIN_KG}–${MAX_KG}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, bodyWeight: Math.round(kg * 10) / 10 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Could not save weight.");
        return;
      }
      setValue("");
      setEditing(false);
      onSaved();
    } catch {
      setError("Could not save weight. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const weekLine = `Logged ${daysLoggedThisWeek} of the last 7 days`;

  if (todayWeight != null && !editing) {
    return (
      <div ref={cardRef}>
      <Card className={`vana-card p-5 ${className}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="vana-section-label">Weight</p>
            <p className="vana-big-number mt-1 text-4xl">
              {todayWeight} <span className="text-2xl font-medium text-[var(--color-text-secondary)]">kg</span>
            </p>
            <p className="mt-1 text-[15px] text-[var(--color-success)]">Logged today ✓</p>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{weekLine}</p>
          </div>
          <Button type="button" variant="secondary" className="!min-h-[40px] !text-sm" onClick={() => setEditing(true)}>
            Update
          </Button>
        </div>
      </Card>
      </div>
    );
  }

  return (
    <div ref={cardRef}>
    <Card className={`vana-card p-5 ${className}`}>
      <p className="vana-section-label">Weight</p>
      <h2 className="vana-title-2 mt-1">
        {todayWeight != null ? "Update today’s weight" : "Log today’s weight"}
      </h2>
      <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">
        Same time each morning gives your coach a clearer trend.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[140px]">
          <span className="sr-only">Weight in kg</span>
          <div className="flex items-center rounded-[12px] bg-[var(--color-bg)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-primary)]">
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={MIN_KG}
              max={MAX_KG}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={lastEntry ? String(lastEntry.bodyWeight) : "e.g. 68.5"}
              className="min-h-[50px] w-full bg-transparent text-[17px] tabular-nums text-[var(--color-text)] outline-none"
            />
            <span className="text-[15px] text-[var(--color-text-muted)]">kg</span>
          </div>
        </label>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {editing && (
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </form>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
        {weekLine}
        {lastEntry && ` · Last: ${lastEntry.bodyWeight} kg on ${formatDateDisplay(lastEntry.date)}`}
      </p>
    </Card>
    </div>
  );
}
