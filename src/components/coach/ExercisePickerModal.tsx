"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";

interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
}

interface ExercisePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: { id: string; name: string }) => void;
  excludeIds?: string[];
}

export function ExercisePickerModal({ open, onClose, onSelect, excludeIds = [] }: ExercisePickerModalProps) {
  const { fetchWithAuth } = useApiClient();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    let cancelled = false;
    setLoading(true);
    fetchWithAuth("/api/coach/exercises")
      .then((res) => res.ok ? res.json() : [])
      .then((data: Exercise[]) => {
        if (!cancelled) setExercises(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, fetchWithAuth]);

  const filtered = search.trim()
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : exercises;
  const toShow = filtered.filter((e) => !excludeIds.includes(e.id));

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-picker-title"
      >
        <div className="border-b border-[var(--color-border)] p-4">
          <h2 id="exercise-picker-title" className="text-lg font-semibold text-[var(--color-text)]">
            Add exercise from library
          </h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            autoFocus
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</p>}
          {!loading && toShow.length === 0 && (
            <p className="p-4 text-sm text-[var(--color-text-muted)]">
              {exercises.length === 0 ? "No exercises in your library. Add exercises first." : "No matches."}
            </p>
          )}
          {!loading &&
            toShow.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  onSelect({ id: ex.id, name: ex.name });
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-left text-sm hover:border-[var(--color-border)] hover:bg-[var(--color-bg)]"
              >
                <span className="font-medium text-[var(--color-text)]">{ex.name}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {[ex.category, ex.equipment].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            ))}
        </div>
        <div className="border-t border-[var(--color-border)] p-3">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
