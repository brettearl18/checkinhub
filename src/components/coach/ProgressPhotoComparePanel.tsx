"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { formatDateDisplay } from "@/lib/format-date";
import { useApiClient } from "@/lib/api-client";
import { downloadProgressPhotoFile } from "@/lib/progress-photo-social-export";
import {
  ProgressPhotoShareExportModal,
  type ShareExportPhoto,
} from "@/components/coach/ProgressPhotoShareExportModal";
import {
  buildLegacyPoseAssignment,
  formatProgressImageTypeLabel,
  getProgressPhotoForMilestone,
  progressPhotoMilestoneLabel,
  progressPhotoPoseTabLabel,
  PROGRESS_PHOTO_COMPARE_ROWS,
  PROGRESS_PHOTO_POSES,
  type ProgressPhotoMilestone,
  type ProgressPhotoPose,
} from "@/lib/progress-comparison-photos";
import {
  deriveSharePoseLabel,
  ProgressPhotoGalleryPickerModal,
} from "@/components/coach/ProgressPhotoGalleryPickerModal";
import {
  defaultComparePair,
  ProgressPhotoCompareModal,
  type ShareExportRequest,
} from "@/components/coach/ProgressPhotoCompareModal";
import type { PhotoSlotAlignment } from "@/lib/progress-photo-social-export";

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
  /** Coach: share export + Hall of Fame. Client: compare + download only. */
  variant?: "coach" | "client";
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

function clientMilestoneBadgeClass(milestone: ProgressPhotoMilestone): string {
  if (milestone === "latest") {
    return "border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]";
  }
  if (milestone === "first_baseline") {
    return "border border-stone-200 bg-stone-50 text-stone-500";
  }
  return "border border-stone-200 bg-white text-stone-600";
}

function PhotoThumb({
  image,
  pose,
  milestone,
  onCompare,
  onDownload,
  downloading,
  variant = "coach",
}: {
  image: ProgressPhotoCompareItem | null;
  pose: ProgressPhotoPose;
  milestone: ProgressPhotoMilestone;
  onCompare?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  variant?: "coach" | "client";
}) {
  const isClient = variant === "client";
  const hasImage = Boolean(image);
  const canCompare = Boolean(image && onCompare);
  const imageFit = isClient ? "object-cover" : "object-contain";

  if (isClient) {
    return (
      <div className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm ring-1 ring-black/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-[var(--color-primary-muted)]">
        <div className="relative aspect-[3/4] w-full bg-stone-100">
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
                  className={imageFit}
                  sizes="(max-width: 768px) 33vw, 220px"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-3 pt-12 text-left">
                  <p className="text-sm font-medium text-white">{progressPhotoPoseTabLabel(pose)}</p>
                  {image?.uploadedAt && (
                    <p className="text-xs text-white/80">
                      {formatDateDisplay(image.uploadedAt.slice(0, 10))}
                    </p>
                  )}
                  <span className="mt-2 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-stone-800 shadow-sm">
                    Compare
                  </span>
                </div>
              </button>
            ) : (
              <>
                <Image
                  src={image!.imageUrl}
                  alt={`${progressPhotoPoseTabLabel(pose)} progress photo`}
                  fill
                  className={imageFit}
                  sizes="(max-width: 768px) 33vw, 220px"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-10 text-left">
                  <p className="text-sm font-medium text-white">{progressPhotoPoseTabLabel(pose)}</p>
                  {image?.uploadedAt && (
                    <p className="text-xs text-white/80">
                      {formatDateDisplay(image.uploadedAt.slice(0, 10))}
                    </p>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
              <span className="text-2xl text-stone-300" aria-hidden>
                —
              </span>
              <p className="text-[11px] text-stone-400">No {progressPhotoPoseTabLabel(pose).toLowerCase()} photo</p>
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
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-60"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

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
                className={imageFit}
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
              className={imageFit}
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
  variant = "coach",
}: {
  images: ProgressPhotoCompareItem[];
  milestone: ProgressPhotoMilestone;
  legacyAssignment: Map<string, ProgressPhotoPose>;
  onOpenCompare: (pose: ProgressPhotoPose, clicked: ProgressPhotoMilestone) => void;
  onDownloadPhoto: (image: ProgressPhotoCompareItem, pose: ProgressPhotoPose, milestone: ProgressPhotoMilestone) => void;
  downloadingImageId: string | null;
  variant?: "coach" | "client";
}) {
  const isClient = variant === "client";

  return (
    <div
      className={
        isClient
          ? "grid grid-cols-[minmax(4.5rem,5.5rem)_1fr] items-start gap-3 sm:grid-cols-[minmax(5.5rem,6.5rem)_1fr] sm:gap-5"
          : "grid grid-cols-[minmax(5rem,7rem)_1fr] items-start gap-3 sm:gap-4"
      }
    >
      <div className={isClient ? "pt-3 sm:pt-4" : "pt-2"}>
        {isClient ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${clientMilestoneBadgeClass(milestone)}`}
          >
            {progressPhotoMilestoneLabel(milestone)}
          </span>
        ) : (
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {progressPhotoMilestoneLabel(milestone)}
          </p>
        )}
      </div>
      <div className={`grid grid-cols-3 ${isClient ? "gap-2.5 sm:gap-4" : "gap-2 sm:gap-3"}`}>
        {PROGRESS_PHOTO_POSES.map((pose) => {
          const image = getProgressPhotoForMilestone(images, pose, milestone, legacyAssignment);
          return (
            <PhotoThumb
              key={pose}
              pose={pose}
              milestone={milestone}
              image={image}
              variant={variant}
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
  variant = "coach",
}: Props) {
  const isCoach = variant === "coach";
  const { fetchWithAuth } = useApiClient();
  const legacyAssignment = useMemo(() => buildLegacyPoseAssignment(images), [images]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [comparePose, setComparePose] = useState<ProgressPhotoPose>("front");
  const [compareMilestoneA, setCompareMilestoneA] = useState<ProgressPhotoMilestone>("first_baseline");
  const [compareMilestoneB, setCompareMilestoneB] = useState<ProgressPhotoMilestone>("latest");
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [shareExportOpen, setShareExportOpen] = useState(false);
  const [shareExportPoseLabel, setShareExportPoseLabel] = useState("Front");
  const [shareBefore, setShareBefore] = useState<ShareExportPhoto | null>(null);
  const [shareAfter, setShareAfter] = useState<ShareExportPhoto | null>(null);
  const [shareBeforeAlign, setShareBeforeAlign] = useState<PhotoSlotAlignment | undefined>();
  const [shareAfterAlign, setShareAfterAlign] = useState<PhotoSlotAlignment | undefined>();

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

  const openShareExport = (
    poseLabel: string,
    before: ProgressPhotoCompareItem,
    after: ProgressPhotoCompareItem,
    beforeLabel: string,
    afterLabel: string,
    beforeAlign?: PhotoSlotAlignment,
    afterAlign?: PhotoSlotAlignment
  ) => {
    if (!clientId) {
      setDownloadError("Client ID required to save highlights.");
      return;
    }
    setDownloadError(null);
    setShareExportPoseLabel(poseLabel);
    setShareBefore({
      imageUrl: before.imageUrl,
      uploadedAt: before.uploadedAt,
      label: beforeLabel,
    });
    setShareAfter({
      imageUrl: after.imageUrl,
      uploadedAt: after.uploadedAt,
      label: afterLabel,
    });
    setShareBeforeAlign(beforeAlign);
    setShareAfterAlign(afterAlign);
    setShareExportOpen(true);
  };

  const openShareFromCompare = (request: ShareExportRequest) => {
    const milestoneFor = (photo: ProgressPhotoCompareItem): ProgressPhotoMilestone => {
      const a = getProgressPhotoForMilestone(images, comparePose, compareMilestoneA, legacyAssignment);
      const b = getProgressPhotoForMilestone(images, comparePose, compareMilestoneB, legacyAssignment);
      if (a?.id === photo.id) return compareMilestoneA;
      if (b?.id === photo.id) return compareMilestoneB;
      return "latest";
    };
    openShareExport(
      progressPhotoPoseTabLabel(comparePose),
      request.before,
      request.after,
      progressPhotoMilestoneLabel(milestoneFor(request.before)),
      progressPhotoMilestoneLabel(milestoneFor(request.after)),
      request.beforeAlign,
      request.afterAlign
    );
  };

  const openShareForPose = (pose: ProgressPhotoPose) => {
    const before = getProgressPhotoForMilestone(images, pose, "first_baseline", legacyAssignment);
    const after = getProgressPhotoForMilestone(images, pose, "latest", legacyAssignment);
    if (!before || !after || before.id === after.id) return;
    openShareExport(
      progressPhotoPoseTabLabel(pose),
      before,
      after,
      "Baseline",
      "Latest"
    );
  };

  const openShareFromGallery = (before: ProgressPhotoCompareItem, after: ProgressPhotoCompareItem) => {
    setGalleryPickerOpen(false);
    openShareExport(
      deriveSharePoseLabel(before, after, legacyAssignment),
      before,
      after,
      formatProgressImageTypeLabel(before.imageType),
      formatProgressImageTypeLabel(after.imageType)
    );
  };

  if (images.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-muted)]">No progress photos uploaded.</p>
        {isCoach && clientId && (
          <Link
            href={`/coach/gallery?client=${clientId}`}
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            View client gallery →
          </Link>
        )}
        {!isCoach && (
          <Link
            href="/client/progress-photos"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Upload photos →
          </Link>
        )}
      </div>
    );
  }

  const isClient = variant === "client";

  return (
    <>
      <div className={isClient ? "space-y-6 sm:space-y-7" : "space-y-5"}>
        <div
          className={
            isClient
              ? "grid grid-cols-[minmax(4.5rem,5.5rem)_1fr] gap-3 sm:grid-cols-[minmax(5.5rem,6.5rem)_1fr] sm:gap-5"
              : "hidden grid-cols-[minmax(5rem,7rem)_1fr] gap-3 sm:grid sm:gap-4"
          }
        >
          <span />
          <div
            className={
              isClient
                ? "grid grid-cols-3 gap-2.5 sm:gap-4"
                : "grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] sm:gap-3"
            }
          >
            {PROGRESS_PHOTO_POSES.map((pose) => (
              <span
                key={pose}
                className={
                  isClient
                    ? "text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400"
                    : undefined
                }
              >
                {progressPhotoPoseTabLabel(pose)}
              </span>
            ))}
          </div>
        </div>

        {PROGRESS_PHOTO_COMPARE_ROWS.map((milestone, index) => (
          <div
            key={milestone}
            className={isClient && index > 0 ? "border-t border-stone-200/70 pt-6 sm:pt-7" : undefined}
          >
            <CompareRow
              images={images}
              milestone={milestone}
              legacyAssignment={legacyAssignment}
              onOpenCompare={openCompare}
              onDownloadPhoto={handlePhotoDownload}
              downloadingImageId={downloadingImageId}
              variant={variant}
            />
          </div>
        ))}

        {isCoach && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-sm font-medium text-[var(--color-text)]">Create 4:5 share</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Quick baseline vs latest per pose, or pick any two photos from the full gallery.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={images.length < 2 || !clientId}
                onClick={() => setGalleryPickerOpen(true)}
                className="min-h-9 py-1.5 text-xs"
              >
                Choose from gallery
              </Button>
              {PROGRESS_PHOTO_POSES.map((pose) => {
                const ready = canDownloadSocialPost(images, pose, legacyAssignment);
                return (
                  <Button
                    key={pose}
                    variant="secondary"
                    disabled={!ready || !clientId}
                    onClick={() => openShareForPose(pose)}
                    className="min-h-9 py-1.5 text-xs"
                  >
                    {progressPhotoPoseTabLabel(pose)}
                  </Button>
                );
              })}
            </div>
            {clientId && (
              <Link
                href="/coach/hall-of-fame"
                className="mt-2 inline-block text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                View Hall of Fame →
              </Link>
            )}
            {downloadError && (
              <p className="mt-2 text-xs text-rose-600">{downloadError}</p>
            )}
          </div>
        )}

        {!isCoach && downloadError && (
          <p className="text-xs text-rose-600">{downloadError}</p>
        )}

        {!isClient && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Click a photo to compare, or use the download icon on each thumbnail. Latest = most recent upload. Previous = upload before that. Baseline = first upload for that pose.
          </p>
        )}
      </div>

      {isCoach && (
        <ProgressPhotoGalleryPickerModal
          open={galleryPickerOpen}
          onClose={() => setGalleryPickerOpen(false)}
          images={images}
          onConfirm={openShareFromGallery}
        />
      )}

      <ProgressPhotoCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        pose={comparePose}
        images={images}
        legacyAssignment={legacyAssignment}
        initialMilestoneA={compareMilestoneA}
        initialMilestoneB={compareMilestoneB}
        clientName={clientName}
        onCreateShare={isCoach && clientId ? openShareFromCompare : undefined}
      />

      {isCoach && clientId && shareBefore && shareAfter && (
        <ProgressPhotoShareExportModal
          open={shareExportOpen}
          onClose={() => setShareExportOpen(false)}
          clientId={clientId}
          clientName={clientName}
          poseLabel={shareExportPoseLabel}
          before={shareBefore}
          after={shareAfter}
          fetchAuthenticated={fetchWithAuth}
          initialBeforeAlign={shareBeforeAlign}
          initialAfterAlign={shareAfterAlign}
        />
      )}
    </>
  );
}
