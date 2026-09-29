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
      <Card className={`vana-card flex flex-wrap items-center justify-between gap-3 p-4 ${className}`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Today’s weight</p>
          <p className="mt-1 font-display text-2xl font-medium tabular-nums text-stone-800">
            {todayWeight} kg <span className="text-base text-emerald-600">✓</span>
          </p>
          <p className="mt-0.5 text-xs text-stone-500">{weekLine}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          Update
        </Button>
      </Card>
      </div>
    );
  }

  return (
    <div ref={cardRef}>
    <Card className={`vana-card border-2 border-[var(--color-primary-muted)] p-4 sm:p-5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">Daily weigh-in</p>
      <h2 className="mt-1 text-lg font-semibold text-stone-800">
        {todayWeight != null ? "Update today’s weight" : "Log today’s weight"}
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Weigh in each morning, same time and conditions — daily entries give your coach a much clearer trend
        than the odd one-off.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[140px]">
          <span className="sr-only">Weight in kg</span>
          <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 focus-within:border-[var(--color-primary)]">
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
              className="min-h-[44px] w-full bg-transparent text-base text-[var(--color-text)] outline-none"
            />
            <span className="text-sm text-stone-500">kg</span>
          </div>
        </label>
        <Button type="submit" variant="primary" disabled={saving} className="min-h-[44px]">
          {saving ? "Saving…" : "Save"}
        </Button>
        {editing && (
          <Button type="button" variant="secondary" onClick={() => setEditing(false)} className="min-h-[44px]">
            Cancel
          </Button>
        )}
      </form>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-stone-500">
        {weekLine}
        {lastEntry && ` · Last: ${lastEntry.bodyWeight} kg on ${formatDateDisplay(lastEntry.date)}`}
      </p>
    </Card>
    </div>
  );
}
