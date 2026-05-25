"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function todayLocalYyyyMmDd(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface BodyWeightBeforeCheckInModalProps {
  open: boolean;
  formTitle?: string;
  weekLabel?: string | null;
  initialWeightKg?: number | null;
  saving?: boolean;
  error?: string | null;
  onContinue: (bodyWeightKg: number) => void | Promise<void>;
}

/** Blocks check-in until client logs body weight to measurements. */
export function BodyWeightBeforeCheckInModal({
  open,
  formTitle,
  weekLabel,
  initialWeightKg,
  saving = false,
  error,
  onContinue,
}: BodyWeightBeforeCheckInModalProps) {
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialWeightKg != null && initialWeightKg > 0) {
      setWeight(String(initialWeightKg));
    } else {
      setWeight("");
    }
  }, [open, initialWeightKg]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = weight.trim() ? Number(weight) : NaN;
    if (Number.isNaN(w) || w <= 0 || w > 500) return;
    await onContinue(w);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="body-weight-gate-title"
    >
      <Card className="w-full max-w-md p-6">
        <h2 id="body-weight-gate-title" className="text-lg font-semibold text-[var(--color-text)]">
          Log your body weight first
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Before you start
          {formTitle ? ` ${formTitle}` : " your check-in"}
          {weekLabel ? ` (${weekLabel})` : ""}, enter your current body weight. It will be saved to your
          progress and measurements.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Input
            label="Body weight (kg)"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="500"
            required
            autoFocus
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 72.5"
            disabled={saving}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Recorded for {todayLocalYyyyMmDd()}. You can update measurements anytime from your dashboard.
          </p>
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={saving || !weight.trim()}>
            {saving ? "Saving…" : "Continue to check-in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
