"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatDateDisplay } from "@/lib/format-date";
import { useApiClient } from "@/lib/api-client";
import {
  downloadProgressPhotoFile,
  downloadProgressSocialPost,
} from "@/lib/progress-photo-social-export";
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
  clientName?: string;
  clientId?: string;
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function canDownloadSocialPost(
  images: ProgressPhotoCompareItem[],
  pose: ProgressPhotoPose,
  legacyAssignment: Map<string, ProgressPhotoPose>
): boolean {
  const before = getProgressPhotoForMilestone(images, pose, "first_baseline", legacyAssignment);
  const after = getProgressPhotoForMilestone(images, pose, "latest", legacyAssignment);
  return Boolean(before && after && before.id !== after.id);
}

async function downloadSocialPostForPose(
  images: ProgressPhotoCompareItem[],
  pose: ProgressPhotoPose,
  legacyAssignment: Map<string, ProgressPhotoPose>,
  clientName: string,
  fetchAuthenticated: (url: string) => Promise<Response>
) {
  const before = getProgressPhotoForMilestone(images, pose, "first_baseline", legacyAssignment)!;
  const after = getProgressPhotoForMilestone(images, pose, "latest", legacyAssignment)!;
  await downloadProgressSocialPost(
    {
      clientName,
      poseLabel: progressPhotoPoseTabLabel(pose),
      beforeImageUrl: before.imageUrl,
      afterImageUrl: after.imageUrl,
      beforeDate: before.uploadedAt,
      afterDate: after.uploadedAt,
    },
    { fetchAuthenticated }
  );
}

function PhotoThumb({
  image,
  pose,
  milestone,
  onCompare,
  onDownload,
  downloading,
}: {
  image: ProgressPhotoCompareItem | null;
  pose: ProgressPhotoPose;
  milestone: ProgressPhotoMilestone;
  onCompare?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const hasImage = Boolean(image);
  const canCompare = Boolean(image && onCompare);

  return (
    <div className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="relative aspect-[3/4] w-full bg-[var(--color-bg)]">
        {hasImage ? (
          canCompare ? (
            <button
              type="button"
              onClick={onCompare}
              className="absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
              aria-label={`Compare ${progressPhotoPoseTabLabel(pose)} ${progressPhotoMilestoneLabel(milestone)}`}
            >
              <Image
                src={image!.imageUrl}
                alt={`${progressPhotoPoseTabLabel(pose)} progress photo`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 33vw, 200px"
                unoptimized
              />
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                  Compare
                </span>
              </div>
            </button>
          ) : (
            <Image
              src={image!.imageUrl}
              alt={`${progressPhotoPoseTabLabel(pose)} progress photo`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 33vw, 200px"
              unoptimized
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--color-text-muted)]">
            —
          </div>
        )}

        {hasImage && onDownload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={downloading}
            title="Download photo"
            aria-label={`Download ${progressPhotoPoseTabLabel(pose)} photo`}
            className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
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
    </div>
  );
}

function CompareRow({
  images,
  milestone,
  legacyAssignment,
  onOpenCompare,
  onDownloadPhoto,
  downloadingImageId,
}: {
  images: ProgressPhotoCompareItem[];
  milestone: ProgressPhotoMilestone;
  legacyAssignment: Map<string, ProgressPhotoPose>;
  onOpenCompare: (pose: ProgressPhotoPose, clicked: ProgressPhotoMilestone) => void;
  onDownloadPhoto: (image: ProgressPhotoCompareItem, pose: ProgressPhotoPose, milestone: ProgressPhotoMilestone) => void;
  downloadingImageId: string | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(5rem,7rem)_1fr] items-start gap-3 sm:gap-4">
      <p className="pt-2 text-sm font-semibold text-[var(--color-text)]">
        {progressPhotoMilestoneLabel(milestone)}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {PROGRESS_PHOTO_POSES.map((pose) => {
          const image = getProgressPhotoForMilestone(images, pose, milestone, legacyAssignment);
          return (
            <PhotoThumb
              key={pose}
              pose={pose}
              milestone={milestone}
              image={image}
              onCompare={image ? () => onOpenCompare(pose, milestone) : undefined}
              onDownload={image ? () => onDownloadPhoto(image, pose, milestone) : undefined}
              downloading={image ? downloadingImageId === image.id : false}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ProgressPhotoComparePanel({
  images,
  clientName = "Client",
  clientId,
}: Props) {
  const { fetchWithAuth } = useApiClient();
  const legacyAssignment = useMemo(() => buildLegacyPoseAssignment(images), [images]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [downloadingPose, setDownloadingPose] = useState<ProgressPhotoPose | null>(null);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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

  const handlePhotoDownload = async (
    image: ProgressPhotoCompareItem,
    pose: ProgressPhotoPose,
    milestone: ProgressPhotoMilestone
  ) => {
    setDownloadError(null);
    setDownloadingImageId(image.id);
    try {
      const datePart = image.uploadedAt?.slice(0, 10) ?? "photo";
      const filename = [
        sanitizeFilenamePart(clientName),
        sanitizeFilenamePart(pose),
        sanitizeFilenamePart(milestone),
        datePart,
      ].join("-");
      await downloadProgressPhotoFile(image.imageUrl, filename, fetchWithAuth);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingImageId(null);
    }
  };

  const handleSocialDownload = async (pose: ProgressPhotoPose) => {
    setDownloadError(null);
    setDownloadingPose(pose);
    try {
      await downloadSocialPostForPose(images, pose, legacyAssignment, clientName, fetchWithAuth);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingPose(null);
    }
  };

  if (images.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-muted)]">No progress photos uploaded.</p>
        {clientId && (
          <Link
            href={`/coach/gallery?client=${clientId}`}
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View client gallery →
          </Link>
        )}
      </div>
    );
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
            onDownloadPhoto={handlePhotoDownload}
            downloadingImageId={downloadingImageId}
          />
        ))}

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-medium text-[var(--color-text)]">Social post download (4:5)</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Before & after with client name, dates, and Vana branding — ready for Instagram.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROGRESS_PHOTO_POSES.map((pose) => {
              const ready = canDownloadSocialPost(images, pose, legacyAssignment);
              return (
                <Button
                  key={pose}
                  variant="secondary"
                  disabled={!ready || downloadingPose !== null}
                  onClick={() => handleSocialDownload(pose)}
                  className="min-h-9 py-1.5 text-xs"
                >
                  {downloadingPose === pose
                    ? "Creating…"
                    : `Download ${progressPhotoPoseTabLabel(pose)}`}
                </Button>
              );
            })}
          </div>
          {downloadError && (
            <p className="mt-2 text-xs text-rose-600">{downloadError}</p>
          )}
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          Click a photo to compare, or use the download icon on each thumbnail. Latest = most recent
          upload. Previous = upload before that. Baseline = first upload for that pose.
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
        clientName={clientName}
      />
    </>
  );
}
