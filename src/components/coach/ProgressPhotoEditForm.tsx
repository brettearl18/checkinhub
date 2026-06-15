"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";
import { progressPhotoDateInputFromStored } from "@/lib/progress-photo-dates";
import { todayPerth } from "@/lib/perth-date";
import { PROGRESS_PHOTO_TYPE_OPTIONS } from "@/lib/progress-photo-types";

interface Props {
  patchUrl: string;
  initialImageType: string | null;
  initialUploadedAt: string | null;
  initialCaption?: string | null;
  onSaved: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function ProgressPhotoEditForm({
  patchUrl,
  initialImageType,
  initialUploadedAt,
  initialCaption = "",
  onSaved,
  onCancel,
  compact = false,
}: Props) {
  const { fetchWithAuth } = useApiClient();
  const [imageType, setImageType] = useState(initialImageType ?? "other");
  const [photoDate, setPhotoDate] = useState(
    () => progressPhotoDateInputFromStored(initialUploadedAt) || todayPerth()
  );
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageType,
          photoDate,
          caption: caption.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Could not save changes.");
        return;
      }
      onSaved();
    } catch {
      setError("Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const labelClass = compact
    ? "mb-1 block text-[10px] font-medium text-stone-500"
    : "mb-1 block text-xs font-medium text-stone-600";
  const inputClass = compact
    ? "w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-800"
    : "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800";

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <label className={labelClass}>Angle</label>
          <select
            value={imageType}
            onChange={(e) => setImageType(e.target.value)}
            className={inputClass}
          >
            {PROGRESS_PHOTO_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date taken</label>
          <input
            type="date"
            required
            max={todayPerth()}
            value={photoDate}
            onChange={(e) => setPhotoDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {!compact && (
        <div>
          <label className={labelClass}>Caption (optional)</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={inputClass}
            placeholder="e.g. Week 4 check-in"
          />
        </div>
      )}
      {error && (
        <p className="text-xs text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving} className={compact ? "min-h-9 py-1.5 text-xs" : undefined}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className={compact ? "min-h-9 py-1.5 text-xs" : undefined}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
