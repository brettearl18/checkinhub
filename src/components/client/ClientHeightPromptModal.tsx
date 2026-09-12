"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApiClient } from "@/lib/api-client";
import { HEIGHT_CM_MAX, HEIGHT_CM_MIN, normalizeHeightCmInput } from "@/lib/client-height";

const SESSION_SKIP_KEY = "checkinhub.height-prompt.skipped";

interface Props {
  /** When portal access is limited, do not show. */
  enabled?: boolean;
}

/**
 * Prompts clients who have not saved heightCm to submit it after login.
 * "Later" skips for the browser session only; next login shows again.
 */
export function ClientHeightPromptModal({ enabled = true }: Props) {
  const { fetchWithAuth } = useApiClient();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_SKIP_KEY) === "1") {
        return;
      }
    } catch {
      /* ignore */
    }
    try {
      const res = await fetchWithAuth("/api/client/setup-status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasHeight !== true) {
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, [enabled, fetchWithAuth]);

  useEffect(() => {
    void check();
  }, [check]);

  const skipForSession = () => {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeHeightCmInput(height);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm: normalized.heightCm }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Could not save height.");
        return;
      }
      try {
        sessionStorage.removeItem(SESSION_SKIP_KEY);
      } catch {
        /* ignore */
      }
      setOpen(false);
    } catch {
      setError("Could not save height. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="height-prompt-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl">
        <h2 id="height-prompt-title" className="text-lg font-semibold text-[var(--color-text)]">
          Add your height
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          We need your height so your coach can track progress accurately (BMI context and body
          composition insights). Enter it once — you can update it anytime in Profile.
        </p>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <Input
            label={`Height (cm) — ${HEIGHT_CM_MIN}–${HEIGHT_CM_MAX}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={HEIGHT_CM_MIN}
            max={HEIGHT_CM_MAX}
            required
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="e.g. 165"
            autoFocus
          />
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={skipForSession} disabled={saving}>
              Later
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save height"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
