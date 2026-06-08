"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateDisplay } from "@/lib/format-date";
import {
  buildLegacyPoseAssignment,
  formatProgressImageTypeLabel,
  progressPhotoPoseTabLabel,
  PROGRESS_PHOTO_POSES,
  resolveProgressPhotoPose,
  type ProgressPhotoPose,
} from "@/lib/progress-comparison-photos";
import type { ProgressPhotoCompareItem } from "@/components/coach/ProgressPhotoComparePanel";

type PickSlot = "before" | "after";

interface Props {
  open: boolean;
  onClose: () => void;
  images: ProgressPhotoCompareItem[];
  onConfirm: (before: ProgressPhotoCompareItem, after: ProgressPhotoCompareItem) => void;
}

type PoseFilter = "all" | ProgressPhotoPose;

function sortNewestFirst(images: ProgressPhotoCompareItem[]): ProgressPhotoCompareItem[] {
  return [...images].sort((a, b) => {
    const c = (b.uploadedAt || "").localeCompare(a.uploadedAt || "");
    if (c !== 0) return c;
    return b.id.localeCompare(a.id);
  });
}

function photoPose(
  image: ProgressPhotoCompareItem,
  legacyAssignment: Map<string, ProgressPhotoPose>
): ProgressPhotoPose | null {
  return resolveProgressPhotoPose(image) ?? legacyAssignment.get(image.id) ?? null;
}

export function deriveSharePoseLabel(
  before: ProgressPhotoCompareItem,
  after: ProgressPhotoCompareItem,
  legacyAssignment: Map<string, ProgressPhotoPose>
): string {
  const poseBefore = photoPose(before, legacyAssignment);
  const poseAfter = photoPose(after, legacyAssignment);
  if (poseBefore && poseAfter && poseBefore === poseAfter) {
    return progressPhotoPoseTabLabel(poseBefore);
  }
  if (poseBefore) return progressPhotoPoseTabLabel(poseBefore);
  if (poseAfter) return progressPhotoPoseTabLabel(poseAfter);
  return "Comparison";
}

export function ProgressPhotoGalleryPickerModal({
  open,
  onClose,
  images,
  onConfirm,
}: Props) {
  const legacyAssignment = useMemo(() => buildLegacyPoseAssignment(images), [images]);
  const [poseFilter, setPoseFilter] = useState<PoseFilter>("all");
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<PickSlot>("before");

  useEffect(() => {
    if (!open) return;
    setPoseFilter("all");
    setBeforeId(null);
    setAfterId(null);
    setActiveSlot("before");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const sorted = sortNewestFirst(images);
    if (poseFilter === "all") return sorted;
    return sorted.filter((img) => photoPose(img, legacyAssignment) === poseFilter);
  }, [images, poseFilter, legacyAssignment]);

  const before = beforeId ? images.find((i) => i.id === beforeId) ?? null : null;
  const after = afterId ? images.find((i) => i.id === afterId) ?? null : null;
  const canConfirm = Boolean(before && after && before.id !== after.id);

  const handleSelect = (image: ProgressPhotoCompareItem) => {
    if (activeSlot === "before") {
      setBeforeId(image.id);
      if (afterId === image.id) setAfterId(null);
      setActiveSlot("after");
      return;
    }
    if (image.id === beforeId) return;
    setAfterId(image.id);
  };

  const slotLabel = (id: string | null, slot: PickSlot): string | null => {
    if (!id) return null;
    if (slot === "before" && beforeId === id) return "Before";
    if (slot === "after" && afterId === id) return "After";
    return null;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-picker-title"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div>
            <h2 id="gallery-picker-title" className="text-lg font-semibold text-[var(--color-text)]">
              Choose photos for 4:5 share
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              Pick any two from the full gallery — tap Before, then After
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5 sm:px-5">
          <span className="text-xs text-[var(--color-text-muted)]">Selecting:</span>
          <button
            type="button"
            onClick={() => setActiveSlot("before")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeSlot === "before"
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] text-[var(--color-text)]"
            }`}
          >
            Before {before?.uploadedAt && `· ${formatDateDisplay(before.uploadedAt.slice(0, 10))}`}
          </button>
          <button
            type="button"
            onClick={() => setActiveSlot("after")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeSlot === "after"
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] text-[var(--color-text)]"
            }`}
          >
            After {after?.uploadedAt && `· ${formatDateDisplay(after.uploadedAt.slice(0, 10))}`}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border)] px-4 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => setPoseFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              poseFilter === "all"
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            }`}
          >
            All ({images.length})
          </button>
          {PROGRESS_PHOTO_POSES.map((pose) => {
            const count = images.filter((img) => photoPose(img, legacyAssignment) === pose).length;
            return (
              <button
                key={pose}
                type="button"
                onClick={() => setPoseFilter(pose)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  poseFilter === pose
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                }`}
              >
                {progressPhotoPoseTabLabel(pose)} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              No photos for this filter.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
              {filtered.map((image) => {
                const isBefore = beforeId === image.id;
                const isAfter = afterId === image.id;
                const badge = slotLabel(image.id, "before") ?? slotLabel(image.id, "after");
                const disabled = activeSlot === "after" && beforeId === image.id;

                return (
                  <button
                    key={image.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelect(image)}
                    className={`group overflow-hidden rounded-lg border bg-[var(--color-bg-elevated)] text-left transition ${
                      isBefore || isAfter
                        ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-primary-muted)]"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <div className="relative aspect-[3/4] bg-[var(--color-bg)]">
                      <Image
                        src={image.imageUrl}
                        alt={formatProgressImageTypeLabel(image.imageType)}
                        fill
                        className="object-contain"
                        sizes="120px"
                        unoptimized
                      />
                      {badge && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className="border-t border-[var(--color-border)] px-1.5 py-1">
                      <p className="truncate text-[10px] font-medium text-[var(--color-text)]">
                        {formatProgressImageTypeLabel(image.imageType)}
                      </p>
                      {image.uploadedAt && (
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {formatDateDisplay(image.uploadedAt.slice(0, 10))}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => {
              if (before && after) onConfirm(before, after);
            }}
          >
            Continue to align
          </Button>
        </div>
      </Card>
    </div>
  );
}
