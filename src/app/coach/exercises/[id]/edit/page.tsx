"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ExercisePreview } from "@/components/coach/ExercisePreview";
import { useApiClient } from "@/lib/api-client";
import {
  CATEGORY_OPTIONS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  DIFFICULTY_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
  BODY_REGION_OPTIONS,
  textToLines,
  linesToText,
} from "@/lib/exercise-options";

export default function CoachEditExercisePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { fetchWithAuth } = useApiClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [primaryMuscleGroups, setPrimaryMuscleGroups] = useState<string[]>([]);
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [movementPattern, setMovementPattern] = useState("");
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [isCompound, setIsCompound] = useState(false);
  const [bodyRegion, setBodyRegion] = useState("");
  const [coachingCuesText, setCoachingCuesText] = useState("");
  const [commonMistakesText, setCommonMistakesText] = useState("");
  const [regressionOptionsText, setRegressionOptionsText] = useState("");
  const [progressionOptionsText, setProgressionOptionsText] = useState("");
  const [startingPosition, setStartingPosition] = useState("");
  const [tempo, setTempo] = useState("");
  const [rangeOfMotionNotes, setRangeOfMotionNotes] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMuscle = (group: "primary" | "secondary", muscle: string) => {
    if (group === "primary") {
      setPrimaryMuscleGroups((prev) =>
        prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
      );
    } else {
      setSecondaryMuscleGroups((prev) =>
        prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
      );
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setAuthError(false);
      setError(null);
      try {
        const res = await fetchWithAuth(`/api/coach/exercises/${id}`);
        if (res.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (res.status === 404 || res.status === 403) {
          if (!cancelled) setError("Exercise not found.");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setName(data.name ?? "");
            setDescription(data.description ?? "");
            setCategory(data.category ?? "");
            setEquipment(data.equipment ?? "");
            setPrimaryMuscleGroups(Array.isArray(data.primaryMuscleGroups) ? data.primaryMuscleGroups : []);
            setSecondaryMuscleGroups(Array.isArray(data.secondaryMuscleGroups) ? data.secondaryMuscleGroups : []);
            setVideoUrl(data.videoUrl ?? "");
            setImageUrl(data.imageUrl ?? "");
            setDifficulty(data.difficulty ?? "");
            setMovementPattern(data.movementPattern ?? "");
            setIsUnilateral(data.isUnilateral === true);
            setIsCompound(data.isCompound === true);
            setBodyRegion(data.bodyRegion ?? "");
            setCoachingCuesText(linesToText(data.coachingCues ?? []));
            setCommonMistakesText(linesToText(data.commonMistakes ?? []));
            setRegressionOptionsText(linesToText(data.regressionOptions ?? []));
            setProgressionOptionsText(linesToText(data.progressionOptions ?? []));
            setStartingPosition(data.startingPosition ?? "");
            setTempo(data.tempo ?? "");
            setRangeOfMotionNotes(data.rangeOfMotionNotes ?? "");
            setSafetyNotes(data.safetyNotes ?? "");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/coach/exercises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          equipment: equipment.trim() || undefined,
          primaryMuscleGroups,
          secondaryMuscleGroups,
          videoUrl: videoUrl.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          difficulty: difficulty.trim() || undefined,
          movementPattern: movementPattern.trim() || undefined,
          isUnilateral,
          isCompound,
          bodyRegion: bodyRegion.trim() || undefined,
          coachingCues: textToLines(coachingCuesText),
          commonMistakes: textToLines(commonMistakesText),
          regressionOptions: textToLines(regressionOptionsText),
          progressionOptions: textToLines(progressionOptionsText),
          startingPosition: startingPosition.trim() || undefined,
          tempo: tempo.trim() || undefined,
          rangeOfMotionNotes: rangeOfMotionNotes.trim() || undefined,
          safetyNotes: safetyNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save exercise.");
        return;
      }
      router.push("/coach/exercises");
    } catch {
      setError("Failed to save exercise.");
    } finally {
      setSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/coach/exercises" className="text-sm text-[var(--color-primary)] hover:underline">← Exercise library</Link>
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="space-y-6">
        <Link href="/coach/exercises" className="text-sm text-[var(--color-primary)] hover:underline">← Exercise library</Link>
        <p className="text-[var(--color-error)]">{error}</p>
        <Button asChild variant="secondary"><Link href="/coach/exercises">Back to library</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/exercises" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Exercise library
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Edit exercise</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Update the exercise details.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,minmax(320px,380px)]">
        <Card className="p-6 h-fit">
          <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              placeholder="e.g. Goblet squat"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              placeholder="Instructions or notes"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="">Select</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Equipment</label>
              <select
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="">Select</option>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Primary muscle groups</label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUP_OPTIONS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-subtle)]">
                    <input
                      type="checkbox"
                      checked={primaryMuscleGroups.includes(m)}
                      onChange={() => toggleMuscle("primary", m)}
                      className="rounded border-[var(--color-border)]"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Secondary muscle groups</label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUP_OPTIONS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-primary-subtle)]">
                    <input
                      type="checkbox"
                      checked={secondaryMuscleGroups.includes(m)}
                      onChange={() => toggleMuscle("secondary", m)}
                      className="rounded border-[var(--color-border)]"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="">Select</option>
                {DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Movement pattern</label>
              <select
                value={movementPattern}
                onChange={(e) => setMovementPattern(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="">Select</option>
                {MOVEMENT_PATTERN_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Body region</label>
              <select
                value={bodyRegion}
                onChange={(e) => setBodyRegion(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                <option value="">Select</option>
                {BODY_REGION_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={isUnilateral}
                  onChange={(e) => setIsUnilateral(e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                Unilateral (one limb)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={isCompound}
                  onChange={(e) => setIsCompound(e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                Compound (multi-joint)
              </label>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Coaching & scaling</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Coaching cues (one per line)</label>
                <textarea
                  value={coachingCuesText}
                  onChange={(e) => setCoachingCuesText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  placeholder="e.g. Drive knees out&#10;Squeeze glutes at top"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Common mistakes (one per line)</label>
                <textarea
                  value={commonMistakesText}
                  onChange={(e) => setCommonMistakesText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  placeholder="e.g. Rounding lower back&#10;Knees caving in"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Regression options (one per line)</label>
                <textarea
                  value={regressionOptionsText}
                  onChange={(e) => setRegressionOptionsText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  placeholder="e.g. Box squat&#10;Goblet squat"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Progression options (one per line)</label>
                <textarea
                  value={progressionOptionsText}
                  onChange={(e) => setProgressionOptionsText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                  placeholder="e.g. Add weight&#10;Pistol squat"
                />
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Starting position</label>
              <input
                type="text"
                value={startingPosition}
                onChange={(e) => setStartingPosition(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="e.g. Standing, Seated, Prone"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Tempo</label>
              <input
                type="text"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="e.g. 3-1-2-0 or Controlled, Explosive"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Range of motion notes</label>
              <textarea
                value={rangeOfMotionNotes}
                onChange={(e) => setRangeOfMotionNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="e.g. Thighs at least parallel, full lockout"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Safety notes</label>
              <textarea
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                placeholder="e.g. Avoid if knee pain, do not round spine"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              placeholder="https://..."
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/coach/exercises">Cancel</Link>
            </Button>
          </div>
        </form>
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ExercisePreview
            name={name}
            description={description}
            category={category}
            equipment={equipment}
            primaryMuscleGroups={primaryMuscleGroups}
            secondaryMuscleGroups={secondaryMuscleGroups}
            videoUrl={videoUrl}
            imageUrl={imageUrl}
            difficulty={difficulty || undefined}
            movementPattern={movementPattern || undefined}
            bodyRegion={bodyRegion || undefined}
            isUnilateral={isUnilateral}
            isCompound={isCompound}
            coachingCues={textToLines(coachingCuesText)}
            commonMistakes={textToLines(commonMistakesText)}
            regressionOptions={textToLines(regressionOptionsText)}
            progressionOptions={textToLines(progressionOptionsText)}
            startingPosition={startingPosition || undefined}
            tempo={tempo || undefined}
            rangeOfMotionNotes={rangeOfMotionNotes || undefined}
            safetyNotes={safetyNotes || undefined}
          />
        </div>
      </div>
    </div>
  );
}
