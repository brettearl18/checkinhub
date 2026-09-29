"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";
import {
  enableClientPushNotifications,
  getPushPromptMode,
  type PushPromptMode,
} from "@/lib/client-push";

const SESSION_SKIP_KEY = "checkinhub.push-prompt.skipped";
const HEIGHT_SKIP_KEY = "checkinhub.height-prompt.skipped";

interface Props {
  /** When portal access is limited, do not show. */
  enabled?: boolean;
}

/**
 * Prompts clients who have not enabled push to turn on notifications after login.
 * On iPhone Safari it explains Add to Home Screen; when blocked it explains how to unblock.
 * "Later" skips for the browser session only; next login shows again.
 * Yields to the height prompt when that is also needed.
 */
export function ClientPushPromptModal({ enabled = true }: Props) {
  const { fetchWithAuth } = useApiClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PushPromptMode>("enable");
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_SKIP_KEY) === "1") {
        return;
      }
    } catch {
      /* ignore */
    }
    const promptMode = getPushPromptMode();
    if (promptMode === "none") return;

    try {
      const res = await fetchWithAuth("/api/client/setup-status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasPushEnabled === true) return;

      // Height first if still needed and not skipped this session
      let heightSkipped = false;
      try {
        heightSkipped = sessionStorage.getItem(HEIGHT_SKIP_KEY) === "1";
      } catch {
        /* ignore */
      }
      if (data.hasHeight !== true && !heightSkipped) return;

      setMode(promptMode);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [enabled, fetchWithAuth]);

  useEffect(() => {
    // Slight delay so height prompt can claim setup-status first on the same login.
    const t = window.setTimeout(() => {
      void check();
    }, 600);
    return () => window.clearTimeout(t);
  }, [check]);

  // Re-check when height is saved/skipped this session (storage event won't fire same tab).
  useEffect(() => {
    if (!enabled || open) return;
    const interval = window.setInterval(() => {
      try {
        if (sessionStorage.getItem(SESSION_SKIP_KEY) === "1") return;
      } catch {
        /* ignore */
      }
      void check();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [enabled, open, check]);

  const skipForSession = () => {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const handleEnable = async () => {
    setError(null);
    setDoneMessage(null);
    setEnabling(true);
    try {
      const result = await enableClientPushNotifications(fetchWithAuth);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      try {
        sessionStorage.removeItem(SESSION_SKIP_KEY);
      } catch {
        /* ignore */
      }
      setDoneMessage("Notifications are on. You’ll get morning weight and evening habit reminders.");
      window.setTimeout(() => setOpen(false), 1600);
    } finally {
      setEnabling(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl">
        {mode === "ios-install" ? (
          <>
            <h2 id="push-prompt-title" className="text-lg font-semibold text-[var(--color-text)]">
              Get reminders on your iPhone
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              iPhone only allows notifications from the CheckinHUB app on your Home Screen. It takes 30
              seconds:
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--color-text)]">
              <li>
                In Safari, tap the <strong>Share</strong> button (square with an up arrow).
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </li>
              <li>Open CheckinHUB from the new Home Screen icon and sign in.</li>
              <li>
                Tap <strong>Enable notifications</strong> when asked.
              </li>
            </ol>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              You’ll then get a morning body-weight nudge and an evening Habit Tracker reminder.
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="primary" onClick={skipForSession}>
                Got it
              </Button>
            </div>
          </>
        ) : mode === "denied" ? (
          <>
            <h2 id="push-prompt-title" className="text-lg font-semibold text-[var(--color-text)]">
              Notifications are blocked
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Notifications were turned off for CheckinHUB on this device, so you’re missing your morning
              weight and evening habit reminders. To turn them back on:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--color-text)]">
              <li>
                <strong>iPhone (Home Screen app):</strong> Settings → Notifications → CheckinHUB → Allow
                Notifications.
              </li>
              <li>
                <strong>Android / Chrome:</strong> tap the icon left of the web address → Permissions →
                Notifications → Allow.
              </li>
            </ul>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Then reopen the app and tap Enable in{" "}
              <Link href="/client/notifications" className="text-[var(--color-primary)] hover:underline" onClick={skipForSession}>
                Notifications
              </Link>
              .
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="primary" onClick={skipForSession}>
                Got it
              </Button>
            </div>
          </>
        ) : (
          <>
        <h2 id="push-prompt-title" className="text-lg font-semibold text-[var(--color-text)]">
          Enable notifications
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Turn on push so you get a morning body-weight nudge and an evening Habit Tracker reminder —
          even when the app is closed.
        </p>
        {doneMessage ? (
          <p className="mt-4 text-sm text-[var(--color-success)]">{doneMessage}</p>
        ) : (
          <>
            {error && (
              <p className="mt-4 text-sm text-[var(--color-error)]" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={skipForSession} disabled={enabling}>
                Later
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleEnable()} disabled={enabling}>
                {enabling ? "Enabling…" : "Enable notifications"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              You can also manage this anytime in{" "}
              <Link href="/client/notifications" className="text-[var(--color-primary)] hover:underline" onClick={skipForSession}>
                Notifications
              </Link>
              .
            </p>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
