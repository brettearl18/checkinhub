"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateDisplay } from "@/lib/format-date";
import {
  getProgressPhotoForMilestone,
  progressPhotoMilestoneLabel,
  progressPhotoPoseTabLabel,
  PROGRESS_PHOTO_COMPARE_ROWS,
  type ProgressPhotoMilestone,
  type ProgressPhotoPose,
} from "@/lib/progress-comparison-photos";
import type { ProgressPhotoCompareItem } from "@/components/coach/ProgressPhotoComparePanel";

type Phase = "align" | "compare";
type Layer = "a" | "b";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function layerTransform(zoom: number, pan: { x: number; y: number }) {
  return `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pose: ProgressPhotoPose;
  images: ProgressPhotoCompareItem[];
  legacyAssignment: Map<string, ProgressPhotoPose>;
  initialMilestoneA: ProgressPhotoMilestone;
  initialMilestoneB: ProgressPhotoMilestone;
}

function defaultComparePair(clicked: ProgressPhotoMilestone): {
  a: ProgressPhotoMilestone;
  b: ProgressPhotoMilestone;
} {
  if (clicked === "first_baseline") {
    return { a: "first_baseline", b: "latest" };
  }
  if (clicked === "latest") {
    return { a: "first_baseline", b: "latest" };
  }
  return { a: "previous", b: "latest" };
}

function MilestoneSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ProgressPhotoMilestone;
  onChange: (m: ProgressPhotoMilestone) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[var(--color-text-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProgressPhotoMilestone)}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
      >
        {PROGRESS_PHOTO_COMPARE_ROWS.map((m) => (
          <option key={m} value={m}>
            {progressPhotoMilestoneLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

function LayerZoomControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex min-w-[14rem] flex-1 items-center gap-2 text-sm text-[var(--color-text-muted)]">
      <span className="w-16 shrink-0 truncate">{label}</span>
      <button
        type="button"
        onClick={() => onChange(clampZoom(Number((value - ZOOM_STEP).toFixed(2))))}
        disabled={value <= MIN_ZOOM}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-40"
        aria-label={`Zoom out ${label}`}
      >
        −
      </button>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.05}
        value={value}
        onChange={(e) => onChange(clampZoom(Number(e.target.value)))}
        className="w-full accent-[var(--color-primary)]"
      />
      <button
        type="button"
        onClick={() => onChange(clampZoom(Number((value + ZOOM_STEP).toFixed(2))))}
        disabled={value >= MAX_ZOOM}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-40"
        aria-label={`Zoom in ${label}`}
      >
        +
      </button>
      <span className="w-11 shrink-0 text-right text-xs tabular-nums">{Math.round(value * 100)}%</span>
    </label>
  );
}

const DEFAULT_LAYER = { zoom: 1, pan: { x: 0, y: 0 } };

export function ProgressPhotoCompareModal({
  open,
  onClose,
  pose,
  images,
  legacyAssignment,
  initialMilestoneA,
  initialMilestoneB,
}: Props) {
  const [phase, setPhase] = useState<Phase>("align");
  const [milestoneA, setMilestoneA] = useState<ProgressPhotoMilestone>(initialMilestoneA);
  const [milestoneB, setMilestoneB] = useState<ProgressPhotoMilestone>(initialMilestoneB);
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [layerA, setLayerA] = useState(DEFAULT_LAYER);
  const [layerB, setLayerB] = useState(DEFAULT_LAYER);
  const [lockedA, setLockedA] = useState(DEFAULT_LAYER);
  const [lockedB, setLockedB] = useState(DEFAULT_LAYER);
  const [sliderPct, setSliderPct] = useState(50);
  const [draggingLayer, setDraggingLayer] = useState<Layer | null>(null);
  const [draggingSlider, setDraggingSlider] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("align");
    setMilestoneA(initialMilestoneA);
    setMilestoneB(initialMilestoneB);
    setLayerA(DEFAULT_LAYER);
    setLayerB(DEFAULT_LAYER);
    setLockedA(DEFAULT_LAYER);
    setLockedB(DEFAULT_LAYER);
    setSliderPct(50);
    setOverlayOpacity(0.45);
  }, [open, initialMilestoneA, initialMilestoneB, pose]);

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

  const photoA = getProgressPhotoForMilestone(images, pose, milestoneA, legacyAssignment);
  const photoB = getProgressPhotoForMilestone(images, pose, milestoneB, legacyAssignment);

  const resetAlignment = useCallback(() => {
    setLayerA(DEFAULT_LAYER);
    setLayerB(DEFAULT_LAYER);
    setLockedA(DEFAULT_LAYER);
    setLockedB(DEFAULT_LAYER);
    setPhase("align");
    setSliderPct(50);
  }, []);

  const handleMilestoneA = (m: ProgressPhotoMilestone) => {
    setMilestoneA(m);
    resetAlignment();
  };

  const handleMilestoneB = (m: ProgressPhotoMilestone) => {
    setMilestoneB(m);
    resetAlignment();
  };

  const lockAlignment = () => {
    setLockedA(layerA);
    setLockedB(layerB);
    setPhase("compare");
    setSliderPct(50);
  };

  const setLayerZoom = useCallback(
    (layer: Layer, zoom: number) => {
      const next = clampZoom(zoom);
      if (phase === "compare") {
        if (layer === "a") setLockedA((s) => ({ ...s, zoom: next }));
        else setLockedB((s) => ({ ...s, zoom: next }));
      } else if (layer === "a") {
        setLayerA((s) => ({ ...s, zoom: next }));
      } else {
        setLayerB((s) => ({ ...s, zoom: next }));
      }
    },
    [phase]
  );

  const adjustLayerZoom = useCallback(
    (layer: Layer, delta: number) => {
      const source = phase === "compare" ? (layer === "a" ? lockedA : lockedB) : layer === "a" ? layerA : layerB;
      setLayerZoom(layer, Number((source.zoom + delta).toFixed(2)));
    },
    [phase, layerA, layerB, lockedA, lockedB, setLayerZoom]
  );

  const updateSliderFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPct(Math.min(100, Math.max(0, pct)));
  }, []);

  useEffect(() => {
    if (!draggingLayer && !draggingSlider) return;

    const onMove = (e: PointerEvent) => {
      if (draggingLayer === "a") {
        const next = {
          x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
          y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
        };
        if (phase === "compare") setLockedA((s) => ({ ...s, pan: next }));
        else setLayerA((s) => ({ ...s, pan: next }));
      }
      if (draggingLayer === "b") {
        const next = {
          x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
          y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
        };
        if (phase === "compare") setLockedB((s) => ({ ...s, pan: next }));
        else setLayerB((s) => ({ ...s, pan: next }));
      }
      if (draggingSlider) {
        updateSliderFromClientX(e.clientX);
      }
    };

    const onUp = () => {
      setDraggingLayer(null);
      setDraggingSlider(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingLayer, draggingSlider, phase, updateSliderFromClientX]);

  const startLayerDrag = (layer: Layer, e: React.PointerEvent, pan: { x: number; y: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingLayer(layer);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: pan.x,
      offsetY: pan.y,
    };
  };

  const handleLayerWheel = (layer: Layer, e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    adjustLayerZoom(layer, e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  if (!open) return null;

  const activeA = phase === "compare" ? lockedA : layerA;
  const activeB = phase === "compare" ? lockedB : layerB;
  const canCompare = photoA && photoB && photoA.id !== photoB.id;

  const setActiveZoom = (layer: Layer, zoom: number) => setLayerZoom(layer, zoom);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-compare-title"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div>
            <h2 id="photo-compare-title" className="text-lg font-semibold text-[var(--color-text)]">
              Compare {progressPhotoPoseTabLabel(pose)} photos
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              {phase === "align"
                ? "Zoom each layer separately · drag each photo to position · scroll over a photo to zoom it"
                : "Drag the slider to swipe between aligned photos"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MilestoneSelect label="Photo A (under)" value={milestoneA} onChange={handleMilestoneA} />
            <MilestoneSelect label="Photo B (over)" value={milestoneB} onChange={handleMilestoneB} />
          </div>

          {!canCompare ? (
            <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-6 text-center text-sm text-[var(--color-text-muted)]">
              Pick two different photos for this pose to compare.
            </div>
          ) : (
            <>
              <div
                ref={containerRef}
                className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-lg bg-[var(--color-bg)] touch-none select-none"
                onPointerDown={(e) => {
                  if (phase !== "compare") return;
                  if ((e.target as HTMLElement).closest("[data-slider-handle]")) return;
                  updateSliderFromClientX(e.clientX);
                }}
              >
                <img
                  src={photoA!.imageUrl}
                  alt={progressPhotoMilestoneLabel(milestoneA)}
                  className="absolute inset-0 h-full w-full origin-center cursor-move object-contain"
                  style={{ transform: layerTransform(activeA.zoom, activeA.pan) }}
                  draggable={false}
                  onWheel={(e) => handleLayerWheel("a", e)}
                  onPointerDown={(e) => startLayerDrag("a", e, activeA.pan)}
                />

                {phase === "align" ? (
                  <img
                    src={photoB!.imageUrl}
                    alt={progressPhotoMilestoneLabel(milestoneB)}
                    className="absolute inset-0 h-full w-full origin-center cursor-move object-contain"
                    style={{
                      opacity: overlayOpacity,
                      transform: layerTransform(activeB.zoom, activeB.pan),
                    }}
                    draggable={false}
                    onWheel={(e) => handleLayerWheel("b", e)}
                    onPointerDown={(e) => startLayerDrag("b", e, activeB.pan)}
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${sliderPct}%)` }}
                    >
                      <img
                        src={photoB!.imageUrl}
                        alt={progressPhotoMilestoneLabel(milestoneB)}
                        className="absolute inset-0 h-full w-full origin-center object-contain"
                        style={{ transform: layerTransform(activeB.zoom, activeB.pan) }}
                        draggable={false}
                      />
                    </div>
                    <div
                      data-slider-handle
                      className="absolute bottom-0 top-0 z-10 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center"
                      style={{ left: `${sliderPct}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggingSlider(true);
                      }}
                    >
                      <div className="flex h-full w-1 rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.45)]" />
                      <div className="absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[var(--color-primary)] text-white shadow-lg">
                        ↔
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                <span>
                  {progressPhotoMilestoneLabel(milestoneA)}
                  {photoA!.uploadedAt && ` · ${formatDateDisplay(photoA!.uploadedAt.slice(0, 10))}`}
                </span>
                <span>
                  {progressPhotoMilestoneLabel(milestoneB)}
                  {photoB!.uploadedAt && ` · ${formatDateDisplay(photoB!.uploadedAt.slice(0, 10))}`}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          {canCompare && (
            <div className="flex flex-col gap-2">
              <LayerZoomControl
                label="Photo A"
                value={activeA.zoom}
                onChange={(z) => setActiveZoom("a", z)}
              />
              <LayerZoomControl
                label="Photo B"
                value={activeB.zoom}
                onChange={(z) => setActiveZoom("b", z)}
              />

              {phase === "align" && (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span className="w-16 shrink-0">Overlay</span>
                  <input
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </label>
              )}

              {(activeA.zoom !== 1 ||
                activeB.zoom !== 1 ||
                activeA.pan.x !== 0 ||
                activeA.pan.y !== 0 ||
                activeB.pan.x !== 0 ||
                activeB.pan.y !== 0) &&
                phase === "align" && (
                  <button
                    type="button"
                    onClick={resetAlignment}
                    className="self-start text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Reset layers
                  </button>
                )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {phase === "compare" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setLayerA(lockedA);
                  setLayerB(lockedB);
                  setPhase("align");
                }}
              >
                Re-align
              </Button>
            )}
            {phase === "align" && canCompare && (
              <Button onClick={lockAlignment}>Lock alignment & compare</Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export { defaultComparePair };
