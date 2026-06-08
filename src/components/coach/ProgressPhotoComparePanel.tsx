"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { formatDateDisplay } from "@/lib/format-date";
import {
  buildLegacyPoseAssignment,
  getProgressPhotoForMilestone,
  progressPhotoMilestoneLabel,
  progressPhotoPoseTabLabel,
  PROGRESS_PHOTO_COMPARE_ROWS,
  PROGRESS_PHOTO_POSES,
  type ProgressPhotoMilestone,
  type ProgressPhotoPose,
} from "@/lib/progress-comparison-photos";
import {
  defaultComparePair,
  ProgressPhotoCompareModal,
} from "@/components/coach/ProgressPhotoCompareModal";

export interface ProgressPhotoCompareItem {
  id: string;
  imageUrl: string;
  imageType: string | null;
  orientation?: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

interface Props {
  images: ProgressPhotoCompareItem[];
}

function PhotoThumb({
  image,
  pose,
  onCompare,
}: {
  image: ProgressPhotoCompareItem | null;
  pose: ProgressPhotoPose;
  onCompare?: () => void;
}) {
  const clickable = Boolean(image && onCompare);

  const inner = (
    <>
      <div className="relative aspect-[3/4] w-full bg-[var(--color-bg)]">
        {image ? (
          <Image
            src={image.imageUrl}
            alt={`${progressPhotoPoseTabLabel(pose)} progress photo`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 33vw, 200px"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--color-text-muted)]">
            —
          </div>
        )}
        {clickable && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
              Compare
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-[var(--color-border)] px-2 py-1.5 text-center">
        <p className="text-xs font-semibold text-[var(--color-text)]">
          {progressPhotoPoseTabLabel(pose)}
        </p>
        {image?.uploadedAt && (
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {formatDateDisplay(image.uploadedAt.slice(0, 10))}
          </p>
        )}
      </div>
    </>
  );

  if (!clickable) {
    return (
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCompare}
      className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-left transition-shadow hover:border-[var(--color-primary-muted)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      {inner}
    </button>
  );
}

function CompareRow({
  images,
  milestone,
  legacyAssignment,
  onOpenCompare,
}: {
  images: ProgressPhotoCompareItem[];
  milestone: ProgressPhotoMilestone;
  legacyAssignment: Map<string, ProgressPhotoPose>;
  onOpenCompare: (pose: ProgressPhotoPose, clicked: ProgressPhotoMilestone) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(5rem,7rem)_1fr] items-start gap-3 sm:gap-4">
      <p className="pt-2 text-sm font-semibold text-[var(--color-text)]">
        {progressPhotoMilestoneLabel(milestone)}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {PROGRESS_PHOTO_POSES.map((pose) => (
          <PhotoThumb
            key={pose}
            pose={pose}
            image={getProgressPhotoForMilestone(images, pose, milestone, legacyAssignment)}
            onCompare={() => onOpenCompare(pose, milestone)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressPhotoComparePanel({ images }: Props) {
  const legacyAssignment = useMemo(() => buildLegacyPoseAssignment(images), [images]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparePose, setComparePose] = useState<ProgressPhotoPose>("front");
  const [compareMilestoneA, setCompareMilestoneA] = useState<ProgressPhotoMilestone>("first_baseline");
  const [compareMilestoneB, setCompareMilestoneB] = useState<ProgressPhotoMilestone>("latest");

  const openCompare = (pose: ProgressPhotoPose, clicked: ProgressPhotoMilestone) => {
    const pair = defaultComparePair(clicked);
    setComparePose(pose);
    setCompareMilestoneA(pair.a);
    setCompareMilestoneB(pair.b);
    setCompareOpen(true);
  };

  if (images.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No progress photos uploaded.</p>;
  }

  return (
    <>
      <div className="space-y-5">
        <div className="hidden grid-cols-[minmax(5rem,7rem)_1fr] gap-3 sm:grid sm:gap-4">
          <span />
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] sm:gap-3">
            {PROGRESS_PHOTO_POSES.map((pose) => (
              <span key={pose}>{progressPhotoPoseTabLabel(pose)}</span>
            ))}
          </div>
        </div>

        {PROGRESS_PHOTO_COMPARE_ROWS.map((milestone) => (
          <CompareRow
            key={milestone}
            images={images}
            milestone={milestone}
            legacyAssignment={legacyAssignment}
            onOpenCompare={openCompare}
          />
        ))}

        <p className="text-xs text-[var(--color-text-muted)]">
          Click any photo to compare — align with overlay, then swipe with the vertical slider.
          Latest = most recent upload. Previous = upload before that. Baseline = first upload for
          that pose.
        </p>
      </div>

      <ProgressPhotoCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        pose={comparePose}
        images={images}
        legacyAssignment={legacyAssignment}
        initialMilestoneA={compareMilestoneA}
        initialMilestoneB={compareMilestoneB}
      />
    </>
  );
}
