"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { ProgressPhotoComparePanel } from "@/components/coach/ProgressPhotoComparePanel";
import { ProgressPhotoEditForm } from "@/components/coach/ProgressPhotoEditForm";
import { useApiClient } from "@/lib/api-client";
import { formatProgressPhotoDate } from "@/lib/progress-photo-dates";
import { todayPerth } from "@/lib/perth-date";
import {
  buildLegacyPoseAssignment,
  formatProgressImageTypeLabel,
  getProgressPhotoForMilestone,
  PROGRESS_PHOTO_POSES,
  sortProgressPhotosByPoseThenDate,
  type ProgressPhotoMilestone,
} from "@/lib/progress-comparison-photos";

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

const CURRENT_IMAGE_TYPES = [
  { value: "after_front", label: "Current (front)" },
  { value: "after_back", label: "Current (back)" },
  { value: "after_side", label: "Current (side)" },
  { value: "other", label: "Other" },
] as const;

const BASELINE_IMAGE_TYPES = [
  { value: "before_front", label: "Baseline — front" },
  { value: "before_back", label: "Baseline — back" },
  { value: "before_side", label: "Baseline — side" },
] as const;

const MILESTONES: ProgressPhotoMilestone[] = ["latest", "previous", "first_baseline"];

function countPosesWithPhotos(list: ProgressImage[]): number {
  const legacy = buildLegacyPoseAssignment(list);
  return PROGRESS_PHOTO_POSES.filter((pose) =>
    MILESTONES.some((milestone) => getProgressPhotoForMilestone(list, pose, milestone, legacy))
  ).length;
}

export default function ProgressPhotosPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageType, setImageType] = useState("after_front");
  const [caption, setCaption] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [baselineType, setBaselineType] = useState("before_front");
  const [baselineDate, setBaselineDate] = useState("");
  const [baselineCaption, setBaselineCaption] = useState("Before CheckinHUB");
  const [baselineUploading, setBaselineUploading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [baselineSuccess, setBaselineSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baselineFileInputRef = useRef<HTMLInputElement>(null);

  const poseCount = useMemo(() => countPosesWithPhotos(list), [list]);
  const sortedList = useMemo(() => sortProgressPhotosByPoseThenDate(list), [list]);

  const missingBaselines = useMemo(
    () => BASELINE_IMAGE_TYPES.filter((t) => !list.some((img) => img.imageType === t.value)),
    [list]
  );
  const allBaselinesSaved = missingBaselines.length === 0;

  useEffect(() => {
    if (missingBaselines.length > 0) {
      setBaselineType(missingBaselines[0]!.value);
    }
  }, [missingBaselines]);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/client/progress-images");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        setError("Could not load photos.");
        return;
      }
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load photos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  const handleBaselineUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = baselineFileInputRef.current;
    if (!input?.files?.length) {
      setBaselineError("Choose a photo file.");
      return;
    }
    if (!baselineDate) {
      setBaselineError("Set the date this photo was taken.");
      return;
    }

    setBaselineUploading(true);
    setBaselineError(null);
    setBaselineSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", input.files[0]!);
      formData.append("imageType", baselineType);
      formData.append("photoDate", baselineDate);
      if (baselineCaption.trim()) formData.append("caption", baselineCaption.trim());

      const res = await fetchWithAuth("/api/client/progress-images", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBaselineError((body && body.error) || "Upload failed.");
        return;
      }

      input.value = "";
      setBaselineSuccess("Baseline saved. Add another angle or upload a current photo.");
      await load();
    } catch {
      setBaselineError("Upload failed.");
    } finally {
      setBaselineUploading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    const file = input.files[0];
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("imageType", imageType);
      if (caption.trim()) formData.append("caption", caption.trim());

      const res = await fetchWithAuth("/api/client/progress-images", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body && body.error) || "Upload failed.");
        return;
      }
      await res.json();
      setCaption("");
      input.value = "";
      setUploadOpen(false);
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/client/progress" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Progress
          </Link>
          <h1 className="vana-page-title mt-2">Photo gallery</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
            Your progress story in front, back, and side views. Tap any photo to compare before and after with the same swipe view your coach uses.
          </p>
        </div>
        <Button
          type="button"
          variant={uploadOpen ? "secondary" : "primary"}
          className="shrink-0"
          onClick={() => setUploadOpen((open) => !open)}
        >
          {uploadOpen ? "Close upload" : "Upload current"}
        </Button>
      </div>

      {!loading && (
        <div className="flex flex-wrap gap-2">
          {list.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
              {list.length} {list.length === 1 ? "photo" : "photos"}
            </span>
          )}
          {list.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
              {poseCount} of 3 poses
            </span>
          )}
          {BASELINE_IMAGE_TYPES.map((t) => {
            const saved = list.some((img) => img.imageType === t.value);
            return (
              <span
                key={t.value}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${
                  saved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {saved ? "✓" : "○"} {t.label.replace("Baseline — ", "")} baseline
              </span>
            );
          })}
        </div>
      )}

      {uploadOpen && (
        <Card className="vana-card p-6">
          <h2 className="text-base font-medium text-stone-800">Upload a current photo</h2>
          <p className="mt-1 text-sm text-stone-500">
            Add a new check-in or progress photo from today.
          </p>
          <form onSubmit={handleUpload} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary-subtle)] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Type</label>
              <select
                value={imageType}
                onChange={(e) => setImageType(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-800 shadow-sm"
              >
                {CURRENT_IMAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Week 4"
            />
            {error && (
              <p className="text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Save current photo"}
            </Button>
          </form>
        </Card>
      )}

      {loading && (
        <Card className="vana-card p-10 text-center">
          <p className="text-sm text-stone-500">Loading your gallery…</p>
        </Card>
      )}

      {!loading && list.length === 0 && (
        <EmptyState
          title="No photos yet"
          description="Upload a current photo above, or add older baseline shots at the bottom of this page."
          actionLabel="Upload current"
          onAction={() => setUploadOpen(true)}
        />
      )}

      {!loading && list.length > 0 && (
        <Card className="vana-card overflow-hidden p-4 sm:p-6">
          <div className="mb-5 border-b border-stone-200/80 pb-4">
            <h2 className="font-display text-lg font-medium text-stone-800">Your progress</h2>
            <p className="mt-1 text-sm text-stone-500">
              Latest row shows your most recent shots. Baseline row is where you started for each angle.
            </p>
          </div>
          <ProgressPhotoComparePanel
            variant="client"
            images={list.map((img) => ({
              id: img.id,
              imageUrl: img.imageUrl,
              imageType: img.imageType,
              caption: img.caption,
              uploadedAt: img.uploadedAt,
            }))}
          />
        </Card>
      )}

      {!loading && list.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="vana-section-label">All uploads</h2>
              <p className="mt-1 text-sm text-stone-500">Every photo you&apos;ve saved, newest first.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedList.map((img) => (
              <article
                key={img.id}
                className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:shadow-md"
              >
                <div className="relative aspect-[3/4] bg-stone-100">
                  <Image
                    src={img.imageUrl}
                    alt={img.caption || formatProgressImageTypeLabel(img.imageType) || "Progress photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-3 pt-10">
                    <p className="text-sm font-medium text-white">
                      {formatProgressImageTypeLabel(img.imageType)}
                    </p>
                    {img.uploadedAt && (
                      <p className="text-xs text-white/80">{formatProgressPhotoDate(img.uploadedAt)}</p>
                    )}
                  </div>
                </div>
                {img.caption && (
                  <div className="border-t border-stone-100 px-3 py-2.5">
                    <p className="text-sm text-stone-600">{img.caption}</p>
                  </div>
                )}
                <div className="border-t border-stone-100 px-3 py-2.5">
                  {editingId === img.id ? (
                    <ProgressPhotoEditForm
                      patchUrl={`/api/client/progress-images/${img.id}`}
                      initialImageType={img.imageType}
                      initialUploadedAt={img.uploadedAt}
                      initialCaption={img.caption}
                      compact
                      onSaved={() => {
                        setEditingId(null);
                        load();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 w-full py-1.5 text-xs"
                      onClick={() => setEditingId(img.id)}
                    >
                      Edit date & angle
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <section id="import-baseline" className="border-t border-stone-200/80 pt-6">
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50">
            <button
              type="button"
              onClick={() => setBaselineOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-stone-700">
                  {allBaselinesSaved ? "Add older baseline photos" : "Import baselines from before CheckinHUB"}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  One-time setup — upload old starting photos with the date they were taken.
                </p>
              </div>
              <span className="text-sm text-stone-400" aria-hidden>
                {baselineOpen ? "−" : "+"}
              </span>
            </button>

            {baselineOpen && (
              <form
                onSubmit={handleBaselineUpload}
                className="space-y-3 border-t border-stone-200/80 px-4 py-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">Angle</label>
                    <select
                      value={baselineType}
                      onChange={(e) => setBaselineType(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-800"
                    >
                      {BASELINE_IMAGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label.replace("Baseline — ", "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">Date taken</label>
                    <input
                      type="date"
                      required
                      max={todayPerth()}
                      value={baselineDate}
                      onChange={(e) => setBaselineDate(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-800"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-stone-600">Photo</label>
                    <input
                      ref={baselineFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      required
                      className="block w-full text-xs text-stone-600 file:mr-2 file:rounded file:border-0 file:bg-[var(--color-primary-subtle)] file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-[var(--color-primary)]"
                    />
                  </div>
                  <div className="flex items-end sm:col-span-2 lg:col-span-1">
                    <Button type="submit" className="w-full sm:w-auto" disabled={baselineUploading}>
                      {baselineUploading ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
                {baselineError && (
                  <p className="text-xs text-[var(--color-error)]" role="alert">
                    {baselineError}
                  </p>
                )}
                {baselineSuccess && (
                  <p className="text-xs text-emerald-600" role="status">
                    {baselineSuccess}
                  </p>
                )}
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
