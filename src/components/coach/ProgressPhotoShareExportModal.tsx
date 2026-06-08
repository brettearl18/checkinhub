"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateDisplay } from "@/lib/format-date";
import {
  exportSlotToPreviewLayer,
  generateProgressSocialPostCanvas,
  getWeeksBetweenLabel,
  previewLayerToExportSlot,
  socialPostFilename,
  socialPostCanvasToPngBlob,
  SOCIAL_POST_PHOTO_WIDTH,
  SOCIAL_POST_PHOTO_SLOT_HEIGHT,
  type PhotoSlotAlignment,
  type ProgressSocialPostInput,
} from "@/lib/progress-photo-social-export";

export interface ShareExportPhoto {
  imageUrl: string;
  uploadedAt: string | null;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  poseLabel: string;
  before: ShareExportPhoto;
  after: ShareExportPhoto;
  fetchAuthenticated: (url: string, options?: RequestInit) => Promise<Response>;
  initialBeforeAlign?: PhotoSlotAlignment;
  initialAfterAlign?: PhotoSlotAlignment;
}

type SlotId = "before" | "after";

interface LayerState {
  zoom: number;
  pan: { x: number; y: number };
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const DEFAULT_LAYER: LayerState = { zoom: 1, pan: { x: 0, y: 0 } };

/** Preview slot matches export column aspect (half of 4:5). */
const PREVIEW_SLOT_WIDTH = 200;
const PREVIEW_SLOT_HEIGHT = Math.round(
  PREVIEW_SLOT_WIDTH * (SOCIAL_POST_PHOTO_SLOT_HEIGHT / SOCIAL_POST_PHOTO_WIDTH)
);

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function layerTransform(zoom: number, pan: { x: number; y: number }) {
  return `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

function ZoomControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <span className="w-12 shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => onChange(clampZoom(Number((value - ZOOM_STEP).toFixed(2))))}
        disabled={value <= MIN_ZOOM}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--color-border)] disabled:opacity-40"
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
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--color-border)] disabled:opacity-40"
        aria-label={`Zoom in ${label}`}
      >
        +
      </button>
    </label>
  );
}

function ShareSlotEditor({
  photo,
  side,
  layer,
  active,
  onActivate,
  onLayerChange,
}: {
  photo: ShareExportPhoto;
  side: SlotId;
  layer: LayerState;
  active: boolean;
  onActivate: () => void;
  onLayerChange: (next: LayerState) => void;
}) {
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    onActivate();
    dragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: layer.pan.x,
      panY: layer.pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onLayerChange({
      ...layer,
      pan: {
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
      },
    });
  };

  const endDrag = () => {
    dragging.current = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onActivate();
    onLayerChange({
      ...layer,
      zoom: clampZoom(layer.zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)),
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`relative overflow-hidden rounded-xl bg-[var(--color-bg-elevated)] touch-none select-none ${
          active ? "ring-2 ring-[var(--color-primary)]" : "ring-2 ring-[var(--color-primary)]/60"
        }`}
        style={{ width: PREVIEW_SLOT_WIDTH, height: PREVIEW_SLOT_HEIGHT }}
        onPointerDown={onActivate}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0 cursor-move"
          style={{
            transform: layerTransform(layer.zoom, layer.pan),
            transformOrigin: "center center",
          }}
          onPointerDown={startDrag}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={photo.imageUrl}
            alt={photo.label}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      </div>
      <p className="text-center text-xs font-medium text-[var(--color-text)]">
        {side === "before" ? "Before" : "After"}
      </p>
    </div>
  );
}

export function ProgressPhotoShareExportModal({
  open,
  onClose,
  clientId,
  clientName,
  poseLabel,
  before,
  after,
  fetchAuthenticated,
  initialBeforeAlign,
  initialAfterAlign,
}: Props) {
  const [beforeLayer, setBeforeLayer] = useState<LayerState>(DEFAULT_LAYER);
  const [afterLayer, setAfterLayer] = useState<LayerState>(DEFAULT_LAYER);
  const [activeSlot, setActiveSlot] = useState<SlotId>("before");
  const [saveToHallOfFame, setSaveToHallOfFame] = useState(true);
  const [showWeeksBetween, setShowWeeksBetween] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBeforeLayer(
      exportSlotToPreviewLayer(initialBeforeAlign, PREVIEW_SLOT_WIDTH, PREVIEW_SLOT_HEIGHT)
    );
    setAfterLayer(
      exportSlotToPreviewLayer(initialAfterAlign, PREVIEW_SLOT_WIDTH, PREVIEW_SLOT_HEIGHT)
    );
    setActiveSlot("before");
    setSaveToHallOfFame(true);
    setShowWeeksBetween(true);
    setError(null);
    setSuccess(null);
  }, [open, initialBeforeAlign, initialAfterAlign]);

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

  const buildInput = useCallback((): ProgressSocialPostInput => {
    return {
      clientName,
      poseLabel,
      beforeImageUrl: before.imageUrl,
      afterImageUrl: after.imageUrl,
      beforeDate: before.uploadedAt,
      afterDate: after.uploadedAt,
      beforeAlign: previewLayerToExportSlot(
        beforeLayer,
        PREVIEW_SLOT_WIDTH,
        PREVIEW_SLOT_HEIGHT
      ),
      afterAlign: previewLayerToExportSlot(afterLayer, PREVIEW_SLOT_WIDTH, PREVIEW_SLOT_HEIGHT),
      showWeeksBetween,
    };
  }, [clientName, poseLabel, before, after, beforeLayer, afterLayer, showWeeksBetween]);

  const resetLayers = () => {
    setBeforeLayer(DEFAULT_LAYER);
    setAfterLayer(DEFAULT_LAYER);
  };

  const handleExport = async (download: boolean, saveHall: boolean) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const input = buildInput();
      const canvas = await generateProgressSocialPostCanvas(input, {
        fetchAuthenticated,
      });
      const blob = await socialPostCanvasToPngBlob(canvas);

      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = socialPostFilename(input);
        a.click();
        URL.revokeObjectURL(url);
      }

      if (saveHall) {
        const formData = new FormData();
        formData.append("file", blob, socialPostFilename(input));
        formData.append("clientId", clientId);
        formData.append("clientName", clientName);
        formData.append("pose", poseLabel);
        if (before.uploadedAt) formData.append("beforeDate", before.uploadedAt.slice(0, 10));
        if (after.uploadedAt) formData.append("afterDate", after.uploadedAt.slice(0, 10));

        const res = await fetchAuthenticated("/api/coach/hall-of-fame", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? "Failed to save to Hall of Fame");
        }
      }

      const parts: string[] = [];
      if (download) parts.push("Downloaded");
      if (saveHall) parts.push("saved to Hall of Fame");
      setSuccess(parts.join(" and ") + ".");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const activeLayer = activeSlot === "before" ? beforeLayer : afterLayer;
  const setActiveLayer = activeSlot === "before" ? setBeforeLayer : setAfterLayer;
  const weeksLabel = getWeeksBetweenLabel(before.uploadedAt, after.uploadedAt);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-export-title"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div>
            <h2 id="share-export-title" className="text-lg font-semibold text-[var(--color-text)]">
              Create 4:5 share — {poseLabel}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              Drag to move · scroll to zoom · tap a photo to adjust it
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

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex justify-center gap-2 sm:gap-3">
            <ShareSlotEditor
              photo={before}
              side="before"
              layer={beforeLayer}
              active={activeSlot === "before"}
              onActivate={() => setActiveSlot("before")}
              onLayerChange={setBeforeLayer}
            />
            <ShareSlotEditor
              photo={after}
              side="after"
              layer={afterLayer}
              active={activeSlot === "after"}
              onActivate={() => setActiveSlot("after")}
              onLayerChange={setAfterLayer}
            />
          </div>

          <ZoomControl
            label={activeSlot === "before" ? "Before" : "After"}
            value={activeLayer.zoom}
            onChange={(zoom) => setActiveLayer((s) => ({ ...s, zoom }))}
          />

          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>
              {before.label}
              {before.uploadedAt && ` · ${formatDateDisplay(before.uploadedAt.slice(0, 10))}`}
            </span>
            <span>
              {after.label}
              {after.uploadedAt && ` · ${formatDateDisplay(after.uploadedAt.slice(0, 10))}`}
            </span>
          </div>

          <button
            type="button"
            onClick={resetLayers}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            Reset alignment
          </button>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={showWeeksBetween}
                onChange={(e) => setShowWeeksBetween(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Include weeks between on download
              {weeksLabel && showWeeksBetween && (
                <span className="text-xs text-[var(--color-primary)]">({weeksLabel})</span>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={saveToHallOfFame}
                onChange={(e) => setSaveToHallOfFame(e.target.checked)}
                className="accent-[var(--color-primary)]"
              />
              Save to Hall of Fame when downloading
            </label>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {saveToHallOfFame && (
            <Button variant="secondary" disabled={busy} onClick={() => handleExport(false, true)}>
              {busy ? "Saving…" : "Save to Hall of Fame"}
            </Button>
          )}
          <Button disabled={busy} onClick={() => handleExport(true, saveToHallOfFame)}>
            {busy ? "Creating…" : saveToHallOfFame ? "Download & save" : "Download 4:5"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
