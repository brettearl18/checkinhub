"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExercisePickerModal } from "@/components/coach/ExercisePickerModal";
import { useApiClient } from "@/lib/api-client";

type BlockType = "straight_sets" | "superset" | "circuit";
type ProgramExercise = { exerciseId: string; exerciseName: string; sets: string; reps: string; notes: string };
type ProgramBlock = { type: BlockType; restSeconds: number | ""; exercises: ProgramExercise[] };
type ProgramDay = { name: string; blocks: ProgramBlock[] };
type ProgramWeek = { days: ProgramDay[] };

const REST_PRESETS = [30, 60, 90, 120] as const;
const initialWeek = (): ProgramWeek => ({ days: [] });
const initialDay = (dayIndex: number): ProgramDay => ({ name: `Day ${dayIndex + 1}`, blocks: [] });
const initialBlock = (type: BlockType): ProgramBlock => ({ type, restSeconds: "", exercises: [] });

export default function CoachNewProgramPage() {
  const router = useRouter();
  const { fetchWithAuth } = useApiClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationWeeks, setDurationWeeks] = useState<number | "">("");
  const [phaseName, setPhaseName] = useState("");
  const [weeks, setWeeks] = useState<ProgramWeek[]>([{ days: [] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ weekIdx: number; dayIdx: number; blockIdx: number } | null>(null);

  const addWeek = () => setWeeks((w) => [...w, initialWeek()]);
  const removeWeek = (weekIdx: number) => {
    if (weeks.length <= 1) return;
    setWeeks((w) => w.filter((_, i) => i !== weekIdx));
  };
  const addDay = (weekIdx: number) => {
    setWeeks((w) => {
      const next = [...w];
      const week = next[weekIdx];
      next[weekIdx] = { days: [...week.days, initialDay(week.days.length)] };
      return next;
    });
  };
  const removeDay = (weekIdx: number, dayIdx: number) => {
    setWeeks((w) => {
      const next = [...w];
      const week = next[weekIdx];
      if (week.days.length <= 1) return w;
      next[weekIdx] = { days: week.days.filter((_, i) => i !== dayIdx) };
      return next;
    });
  };
  const setDayName = (weekIdx: number, dayIdx: number, value: string) => {
    setWeeks((w) => {
      const next = [...w];
      next[weekIdx].days[dayIdx] = { ...next[weekIdx].days[dayIdx], name: value };
      return next;
    });
  };

  const addBlock = (weekIdx: number, dayIdx: number, type: BlockType) => {
    setWeeks((w) => {
      const next = [...w];
      const day = next[weekIdx].days[dayIdx];
      next[weekIdx].days[dayIdx] = { ...day, blocks: [...day.blocks, initialBlock(type)] };
      return next;
    });
  };
  const removeBlock = (weekIdx: number, dayIdx: number, blockIdx: number) => {
    setWeeks((w) => {
      const next = [...w];
      next[weekIdx].days[dayIdx].blocks = next[weekIdx].days[dayIdx].blocks.filter((_, i) => i !== blockIdx);
      return next;
    });
  };
  const setBlockRest = (weekIdx: number, dayIdx: number, blockIdx: number, value: number | "") => {
    setWeeks((w) => {
      const next = [...w];
      next[weekIdx].days[dayIdx].blocks[blockIdx] = { ...next[weekIdx].days[dayIdx].blocks[blockIdx], restSeconds: value };
      return next;
    });
  };
  const setBlockType = (weekIdx: number, dayIdx: number, blockIdx: number, type: BlockType) => {
    setWeeks((w) => {
      const next = [...w];
      const block = next[weekIdx].days[dayIdx].blocks[blockIdx];
      next[weekIdx].days[dayIdx].blocks[blockIdx] = { ...block, type };
      return next;
    });
  };

  const openPicker = (weekIdx: number, dayIdx: number, blockIdx: number) => {
    setPickerTarget({ weekIdx, dayIdx, blockIdx });
    setPickerOpen(true);
  };
  const addExerciseToBlock = (weekIdx: number, dayIdx: number, blockIdx: number, exercise: { id: string; name: string }) => {
    setWeeks((w) => {
      const next = [...w];
      const block = next[weekIdx].days[dayIdx].blocks[blockIdx];
      const alreadyEmpty = block.exercises.some(
        (e) => e.exerciseId === exercise.id && !e.sets.trim() && !e.reps.trim() && !e.notes.trim(),
      );
      if (alreadyEmpty) return w;
      if (block.type === "straight_sets" && block.exercises.length >= 1) return w;
      next[weekIdx].days[dayIdx].blocks[blockIdx] = {
        ...block,
        exercises: [...block.exercises, { exerciseId: exercise.id, exerciseName: exercise.name, sets: "", reps: "", notes: "" }],
      };
      return next;
    });
    setPickerTarget(null);
    setPickerOpen(false);
  };
  const updateExercise = (weekIdx: number, dayIdx: number, blockIdx: number, exIdx: number, field: keyof ProgramExercise, value: string) => {
    setWeeks((w) => {
      const next = [...w];
      const ex = next[weekIdx].days[dayIdx].blocks[blockIdx].exercises[exIdx];
      next[weekIdx].days[dayIdx].blocks[blockIdx].exercises[exIdx] = { ...ex, [field]: value };
      return next;
    });
  };
  const removeExercise = (weekIdx: number, dayIdx: number, blockIdx: number, exIdx: number) => {
    setWeeks((w) => {
      const next = [...w];
      next[weekIdx].days[dayIdx].blocks[blockIdx].exercises = next[weekIdx].days[dayIdx].blocks[blockIdx].exercises.filter((_, i) => i !== exIdx);
      return next;
    });
  };
  const moveExercise = (weekIdx: number, dayIdx: number, blockIdx: number, exIdx: number, dir: -1 | 1) => {
    const exs = weeks[weekIdx].days[dayIdx].blocks[blockIdx].exercises;
    const newIdx = exIdx + dir;
    if (newIdx < 0 || newIdx >= exs.length) return;
    setWeeks((w) => {
      const next = [...w];
      const arr = [...next[weekIdx].days[dayIdx].blocks[blockIdx].exercises];
      [arr[exIdx], arr[newIdx]] = [arr[newIdx], arr[exIdx]];
      next[weekIdx].days[dayIdx].blocks[blockIdx].exercises = arr;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Program name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        durationWeeks: typeof durationWeeks === "number" ? durationWeeks : undefined,
        phaseName: phaseName.trim() || undefined,
        weeks: weeks.map((w) => ({
          days: w.days.map((d) => ({
            name: d.name.trim() || undefined,
            blocks: d.blocks.map((b) => ({
              type: b.type,
              restSeconds: typeof b.restSeconds === "number" && b.restSeconds >= 0 ? b.restSeconds : undefined,
              exercises: b.exercises.map((ex, i) => ({
                exerciseId: ex.exerciseId,
                sets: ex.sets.trim() || undefined,
                reps: ex.reps.trim() || undefined,
                notes: ex.notes.trim() || undefined,
                order: i,
              })),
            })),
          })),
        })),
      };
      const res = await fetchWithAuth("/api/coach/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save program.");
        return;
      }
      router.push("/coach/programs");
    } catch {
      setError("Failed to save program.");
    } finally {
      setSaving(false);
    }
  };

  const excludeIds = pickerTarget
    ? (weeks[pickerTarget.weekIdx]?.days[pickerTarget.dayIdx]?.blocks[pickerTarget.blockIdx]?.exercises.map((e) => e.exerciseId) ?? [])
    : [];

  const blockLabel = (type: BlockType) =>
    type === "straight_sets" ? "Straight sets" : type === "superset" ? "Superset" : "Circuit";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/programs" className="text-sm text-[var(--color-primary)] hover:underline">← Programs</Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">New program</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Add weeks, days, and blocks (straight sets or supersets). Set sets×reps and rest between exercises.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Program details</h2>
          {error && <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder="e.g. 12-Week Strength" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder="Optional" />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Duration (weeks)</label>
              <input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value === "" ? "" : Number(e.target.value))} className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder="Optional" />
            </div>
            <div className="min-w-[160px]">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Phase name</label>
              <input type="text" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder="Optional" />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Weeks & days</h2>
            <Button type="button" variant="secondary" onClick={addWeek}>Add week</Button>
          </div>

          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--color-text)]">Week {weekIdx + 1}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => addDay(weekIdx)}>Add day</Button>
                  {weeks.length > 1 && <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0 text-[var(--color-error)]" onClick={() => removeWeek(weekIdx)}>Remove week</Button>}
                </div>
              </div>
              {week.days.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No days yet. Add a day, then add blocks (straight sets or supersets).</p>}
              {week.days.map((day, dayIdx) => (
                <div key={dayIdx} className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={day.name} onChange={(e) => setDayName(weekIdx, dayIdx, e.target.value)} className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm font-medium text-[var(--color-text)]" placeholder="Day name" />
                    {week.days.length > 1 && <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0 text-[var(--color-error)]" onClick={() => removeDay(weekIdx, dayIdx)}>Remove day</Button>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => addBlock(weekIdx, dayIdx, "straight_sets")}>+ Straight sets</Button>
                    <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => addBlock(weekIdx, dayIdx, "superset")}>+ Superset</Button>
                    <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => addBlock(weekIdx, dayIdx, "circuit")}>+ Circuit</Button>
                  </div>
                  {day.blocks.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Add a block above, then add exercises and optional rest.</p>}
                  {day.blocks.map((block, blockIdx) => (
                    <div key={blockIdx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={block.type}
                          onChange={(e) => setBlockType(weekIdx, dayIdx, blockIdx, e.target.value as BlockType)}
                          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-text)]"
                        >
                          <option value="straight_sets">Straight sets</option>
                          <option value="superset">Superset</option>
                          <option value="circuit">Circuit</option>
                        </select>
                        <span className="text-xs text-[var(--color-text-muted)]">Rest after:</span>
                        <select
                          value={block.restSeconds === "" ? "" : block.restSeconds}
                          onChange={(e) => setBlockRest(weekIdx, dayIdx, blockIdx, e.target.value === "" ? "" : Number(e.target.value))}
                          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text)]"
                        >
                          <option value="">None</option>
                          {REST_PRESETS.map((s) => (
                            <option key={s} value={s}>{s}s</option>
                          ))}
                        </select>
                        <Button type="button" variant="ghost" className="text-sm py-1 min-h-0 text-[var(--color-error)]" onClick={() => removeBlock(weekIdx, dayIdx, blockIdx)}>Remove block</Button>
                      </div>
                      {block.exercises.length === 0 || (block.type !== "straight_sets" && (block.type === "superset" ? block.exercises.length < 2 : block.exercises.length < 3)) ? (
                        <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => openPicker(weekIdx, dayIdx, blockIdx)}>
                          {block.type === "straight_sets" ? "Pick exercise" : `Add exercise${block.exercises.length > 0 ? "" : ` (${block.type === "superset" ? "2" : "3"}+ for ${blockLabel(block.type)})`}`}
                        </Button>
                      ) : block.type !== "straight_sets" ? (
                        <Button type="button" variant="ghost" className="text-sm py-1.5 min-h-0" onClick={() => openPicker(weekIdx, dayIdx, blockIdx)}>Add exercise</Button>
                      ) : null}
                      <ul className="space-y-2">
                        {block.exercises.map((ex, exIdx) => (
                          <li key={exIdx} className="flex flex-wrap items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 text-sm">
                            <span className="w-4 text-[var(--color-text-muted)]">{exIdx + 1}.</span>
                            <span className="min-w-[120px] font-medium text-[var(--color-text)]">{ex.exerciseName}</span>
                            <input type="text" value={ex.sets} onChange={(e) => updateExercise(weekIdx, dayIdx, blockIdx, exIdx, "sets", e.target.value)} placeholder="Sets" className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs" />
                            <span className="text-[var(--color-text-muted)]">×</span>
                            <input type="text" value={ex.reps} onChange={(e) => updateExercise(weekIdx, dayIdx, blockIdx, exIdx, "reps", e.target.value)} placeholder="Reps" className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs" />
                            <input type="text" value={ex.notes} onChange={(e) => updateExercise(weekIdx, dayIdx, blockIdx, exIdx, "notes", e.target.value)} placeholder="Notes" className="min-w-[80px] flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs" />
                            <div className="flex gap-0.5">
                              <button type="button" onClick={() => moveExercise(weekIdx, dayIdx, blockIdx, exIdx, -1)} disabled={exIdx === 0} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-50" aria-label="Move up">↑</button>
                              <button type="button" onClick={() => moveExercise(weekIdx, dayIdx, blockIdx, exIdx, 1)} disabled={exIdx === block.exercises.length - 1} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] disabled:opacity-50" aria-label="Move down">↓</button>
                              <button type="button" onClick={() => removeExercise(weekIdx, dayIdx, blockIdx, exIdx)} className="rounded p-1 text-[var(--color-error)] hover:bg-[var(--color-error)]/10" aria-label="Remove">✕</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save program"}</Button>
          <Button type="button" variant="ghost" asChild><Link href="/coach/programs">Cancel</Link></Button>
        </div>
      </form>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
        onSelect={(ex) => pickerTarget && addExerciseToBlock(pickerTarget.weekIdx, pickerTarget.dayIdx, pickerTarget.blockIdx, ex)}
        excludeIds={excludeIds}
      />
    </div>
  );
}
