"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApiClient } from "@/lib/api-client";
import { toLocalDateString } from "@/lib/format-date";

const LEGACY_IMAGE_TYPES = [
  { value: "before_front", label: "Before — front" },
  { value: "before_back", label: "Before — back" },
  { value: "before_side", label: "Before — side" },
  { value: "after_front", label: "Current — front" },
  { value: "after_back", label: "Current — back" },
  { value: "after_side", label: "Current — side" },
] as const;

interface Props {
  clientId: string;
  onUploaded?: () => void;
}

export function CoachLegacyProgressPhotoUpload({ clientId, onUploaded }: Props) {
  const { fetchWithAuth } = useApiClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageType, setImageType] = useState("before_front");
  const [photoDate, setPhotoDate] = useState("");
  const [caption, setCaption] = useState("Imported from before CheckinHUB");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = fileInputRef.current;
    if (!input?.files?.length) {
      setError("Choose a photo file.");
      return;
    }
    if (!photoDate) {
      setError("Set the date the photo was taken.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", input.files[0]!);
      formData.append("imageType", imageType);
      formData.append("photoDate", photoDate);
      if (caption.trim()) formData.append("caption", caption.trim());

      const res = await fetchWithAuth(`/api/coach/clients/${clientId}/progress-images`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Upload failed.");
        return;
      }

      input.value = "";
      setSuccess("Photo saved. Upload another or close this panel.");
      onUploaded?.();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-primary-muted)] bg-[var(--color-bg)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]"
      >
        <span>Import photos from before CheckinHUB</span>
        <span className="text-[var(--color-text-muted)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-[var(--color-border)] px-3 py-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Upload old baseline photos from your previous system. Set the date each photo was
            actually taken — it will slot into baseline, previous, and latest comparisons.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--color-text)]">Photo type</span>
              <select
                value={imageType}
                onChange={(e) => setImageType(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-2 text-sm text-[var(--color-text)]"
              >
                {LEGACY_IMAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Date photo was taken"
              type="date"
              required
              max={toLocalDateString(new Date())}
              value={photoDate}
              onChange={(e) => setPhotoDate(e.target.value)}
            />
          </div>

          <Input
            label="Note (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Baseline from old coaching app"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Photo file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required
              className="block w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:rounded file:border-0 file:bg-[var(--color-primary-subtle)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-text)]"
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
        </form>
      )}
    </div>
  );
}
