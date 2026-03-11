"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import {
  CATEGORY_OPTIONS,
  EQUIPMENT_OPTIONS,
  DIFFICULTY_OPTIONS,
  MOVEMENT_PATTERN_OPTIONS,
  BODY_REGION_OPTIONS,
} from "@/lib/exercise-options";

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  equipment: string;
  primaryMuscleGroups: string[];
  secondaryMuscleGroups: string[];
  videoUrl: string | null;
  imageUrl: string | null;
  difficulty: string;
  movementPattern: string;
  bodyRegion: string;
  isCustom: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

function muscleGroupsDisplay(primary: string[], secondary: string[]): string {
  const p = primary.length ? `Primary: ${primary.join(", ")}` : "";
  const s = secondary.length ? `Secondary: ${secondary.join(", ")}` : "";
  return [p, s].filter(Boolean).join(" · ") || "—";
}

export default function CoachExercisesPage() {
  const { fetchWithAuth } = useApiClient();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterMovementPattern, setFilterMovementPattern] = useState("");
  const [filterBodyRegion, setFilterBodyRegion] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(typeof window !== "undefined" && window.location.hostname === "localhost");
  }, []);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterEquipment) params.set("equipment", filterEquipment);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterMovementPattern) params.set("movementPattern", filterMovementPattern);
      if (filterBodyRegion) params.set("bodyRegion", filterBodyRegion);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetchWithAuth(`/api/coach/exercises?${params.toString()}`);
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setExercises(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth, filterCategory, filterEquipment, filterDifficulty, filterMovementPattern, filterBodyRegion]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exercise? It will be removed from your library.")) return;
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/coach/exercises/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setDeletingId(null);
    }
  };

  const SEED_SOURCES = [
    "Part 1 - Upper",
    "Part 2 Upper",
    "Part 3 Upper",
    "Part 4 Upper",
  ] as const;

  const handleSeed = async (source: string) => {
    if (!confirm(`Seed exercises from ${source}.json into your library? (Dev only)`)) return;
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetchWithAuth("/api/seed/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSeedMessage(data.message ?? `Seeded ${data.seeded ?? 0} exercises.`);
        await load();
      } else {
        setSeedMessage(data.error ?? "Seed failed.");
      }
    } catch {
      setSeedMessage("Seed request failed.");
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedAll = async () => {
    if (!confirm("Seed all Part 1–4 Upper JSON files into your library? (Dev only) This may take a moment.")) return;
    setSeeding(true);
    setSeedMessage(null);
    try {
      let total = 0;
      const errors: string[] = [];
      for (const source of SEED_SOURCES) {
        const res = await fetchWithAuth("/api/seed/exercises", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          total += data.seeded ?? 0;
        } else {
          errors.push(`${source}: ${data.error ?? "failed"}`);
        }
      }
      if (errors.length === 0) {
        setSeedMessage(`Seeded ${total} exercises from all 4 parts.`);
        await load();
      } else {
        setSeedMessage(errors.length === SEED_SOURCES.length ? "Seed failed for all parts." : `Seeded ${total} exercises. Errors: ${errors.join("; ")}`);
      }
    } catch {
      setSeedMessage("Seed request failed.");
    } finally {
      setSeeding(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Exercise library</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add and manage exercises. Use them when building programs for clients.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link href="/coach/exercises/new">Add exercise</Link>
          </Button>
          {isLocalhost && (
            <>
              <Button
                type="button"
                variant="primary"
                onClick={handleSeedAll}
                disabled={seeding}
                title="Seed Part 1–4 Upper into your library (dev only)"
              >
                {seeding ? "Seeding…" : "Seed all (Part 1–4)"}
              </Button>
              {SEED_SOURCES.map((source) => (
                <Button
                  key={source}
                  type="button"
                  variant="ghost"
                  className="text-sm"
                  onClick={() => handleSeed(source)}
                  disabled={seeding}
                  title={`Seed ${source}.json`}
                >
                  {source}
                </Button>
              ))}
            </>
          )}
        </div>
      </div>

      {seedMessage && (
        <p className={`text-sm ${seedMessage.startsWith("Seeded") ? "text-[var(--color-primary)]" : "text-[var(--color-error)]"}`} role="status">
          {seedMessage}
        </p>
      )}

      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or description"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">All</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Equipment</label>
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">All</option>
              {EQUIPMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Difficulty</label>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">All</option>
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Movement</label>
            <select
              value={filterMovementPattern}
              onChange={(e) => setFilterMovementPattern(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">All</option>
              {MOVEMENT_PATTERN_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Region</label>
            <select
              value={filterBodyRegion}
              onChange={(e) => setFilterBodyRegion(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="">All</option>
              {BODY_REGION_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && exercises.length === 0 && (
        <EmptyState
          title="No exercises yet"
          description="Add your first exercise to build your library. You can use it when creating programs for clients."
          actionLabel="Add exercise"
          actionHref="/coach/exercises/new"
        />
      )}

      {!loading && exercises.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Category</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Equipment</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Difficulty</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Muscle groups</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text)]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-elevated)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{ex.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{ex.category || "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{ex.equipment || "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{ex.difficulty || "—"}</td>
                  <td className="max-w-[180px] px-4 py-3 text-sm text-[var(--color-text-muted)]" title={muscleGroupsDisplay(ex.primaryMuscleGroups ?? [], ex.secondaryMuscleGroups ?? [])}>
                    {muscleGroupsDisplay(ex.primaryMuscleGroups ?? [], ex.secondaryMuscleGroups ?? [])}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[var(--color-text-muted)]" title={ex.description || undefined}>
                    {ex.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="ghost" className="min-h-[36px]">
                        <Link href={`/coach/exercises/${ex.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-[36px] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                        onClick={() => handleDelete(ex.id)}
                        disabled={deletingId === ex.id}
                      >
                        {deletingId === ex.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
