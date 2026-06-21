"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  CYCLE_FEELING_OPTIONS,
  CYCLE_SYMPTOM_OPTIONS,
  type PeriodFlow,
} from "@/lib/cycle-tracking";

function RatingPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className={`min-h-[44px] min-w-[44px] rounded-xl border text-sm font-medium transition-colors ${
              value === n
                ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
            } disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipToggle({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: readonly { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(active ? selected.filter((id) => id !== opt.id) : [...selected, opt.id])
            }
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
            } disabled:opacity-50`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CycleLogDrawer({
  open,
  onClose,
  dateLabel,
  isToday = false,
  trackSexualActivity = false,
  mood,
  energy,
  symptoms,
  feelings,
  note,
  isPeriodDay,
  periodFlow,
  sexualActivity,
  sexualActivityProtected,
  onMoodChange,
  onEnergyChange,
  onSymptomsChange,
  onFeelingsChange,
  onNoteChange,
  onPeriodDayChange,
  onPeriodFlowChange,
  onSexualActivityChange,
  onSexualActivityProtectedChange,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  isToday?: boolean;
  trackSexualActivity?: boolean;
  mood: number | null;
  energy: number | null;
  symptoms: string[];
  feelings: string[];
  note: string;
  isPeriodDay: boolean;
  periodFlow: PeriodFlow;
  sexualActivity: boolean | null;
  sexualActivityProtected: boolean | null;
  onMoodChange: (n: number | null) => void;
  onEnergyChange: (n: number | null) => void;
  onSymptomsChange: (next: string[]) => void;
  onFeelingsChange: (next: string[]) => void;
  onNoteChange: (v: string) => void;
  onPeriodDayChange: (v: boolean) => void;
  onPeriodFlowChange: (v: PeriodFlow) => void;
  onSexualActivityChange: (v: boolean | null) => void;
  onSexualActivityProtectedChange: (v: boolean | null) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cycle-log-title"
        className="relative flex max-h-[min(90vh,680px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)] sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="cycle-log-title" className="text-lg font-semibold text-[var(--color-text)]">
                {isToday ? "Log today" : "Log entry"}
              </h2>
              <p className="truncate text-sm text-[var(--color-text-muted)]">{dateLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <RatingPicker label="Mood" value={mood} onChange={onMoodChange} disabled={saving} />
              <RatingPicker label="Energy" value={energy} onChange={onEnergyChange} disabled={saving} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Symptoms</p>
              <ChipToggle
                options={CYCLE_SYMPTOM_OPTIONS}
                selected={symptoms}
                onChange={onSymptomsChange}
                disabled={saving}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text)]">How you&apos;re feeling</p>
              <ChipToggle
                options={CYCLE_FEELING_OPTIONS}
                selected={feelings}
                onChange={onFeelingsChange}
                disabled={saving}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isPeriodDay}
                disabled={saving}
                onChange={(e) => onPeriodDayChange(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                {isToday ? "Period day today" : "Period day"}
              </span>
            </label>

            {isPeriodDay && (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Flow</p>
                <div className="flex flex-wrap gap-2">
                  {(["light", "medium", "heavy"] as PeriodFlow[]).map((flow) => (
                    <button
                      key={flow}
                      type="button"
                      disabled={saving}
                      onClick={() => onPeriodFlowChange(flow)}
                      className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                        periodFlow === flow
                          ? "bg-[var(--color-primary)] text-white"
                          : "border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {flow}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trackSexualActivity && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-sm font-medium text-[var(--color-text)]">Sexual activity</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Only if you&apos;re trying to fall pregnant. Never shared with your coach.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      onSexualActivityChange(sexualActivity === true ? null : true);
                      if (sexualActivity === true) onSexualActivityProtectedChange(null);
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      sexualActivity === true
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      onSexualActivityChange(sexualActivity === false ? null : false);
                      onSexualActivityProtectedChange(null);
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      sexualActivity === false
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    No
                  </button>
                </div>
                {sexualActivity === true && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Protection used?</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          onSexualActivityProtectedChange(sexualActivityProtected === true ? null : true)
                        }
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          sexualActivityProtected === true
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        Protected
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          onSexualActivityProtectedChange(sexualActivityProtected === false ? null : false)
                        }
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          sexualActivityProtected === false
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        Unprotected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="cycle-drawer-note" className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                Notes (optional, private)
              </label>
              <textarea
                id="cycle-drawer-note"
                rows={3}
                maxLength={500}
                value={note}
                disabled={saving}
                onChange={(e) => onNoteChange(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="Anything else you want to remember…"
              />
            </div>

            {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" className="w-full" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : isToday ? "Save today's log" : "Save log"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CycleTodaySummary({
  cycleDay,
  mood,
  energy,
  symptoms,
  feelings,
  isPeriodDay,
  onOpenLog,
}: {
  cycleDay: number | null;
  mood: number | null;
  energy: number | null;
  symptoms: string[];
  feelings: string[];
  isPeriodDay: boolean;
  onOpenLog: () => void;
}) {
  const hasAny =
    mood != null ||
    energy != null ||
    symptoms.length > 0 ||
    feelings.length > 0 ||
    isPeriodDay;

  const feelingLabels = feelings
    .map((id) => CYCLE_FEELING_OPTIONS.find((o) => o.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Today</p>
          {cycleDay != null && (
            <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">Cycle day {cycleDay}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenLog}
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {hasAny ? "Edit" : "Log"}
        </button>
      </div>

      {!hasAny ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Nothing logged yet today.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
          {mood != null && <li>Mood · {mood}/5</li>}
          {energy != null && <li>Energy · {energy}/5</li>}
          {isPeriodDay && <li>Period day logged</li>}
          {symptoms.length > 0 && <li>Symptoms · {symptoms.join(", ")}</li>}
          {feelingLabels.length > 0 && <li>Feelings · {feelingLabels.join(", ")}</li>}
        </ul>
      )}
    </div>
  );
}
