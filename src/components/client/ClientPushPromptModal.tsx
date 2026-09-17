"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";
import {
  enableClientPushNotifications,
  isPushSupportedInBrowser,
} from "@/lib/client-push";

const SESSION_SKIP_KEY = "checkinhub.push-prompt.skipped";
const HEIGHT_SKIP_KEY = "checkinhub.height-prompt.skipped";

interface Props {
  /** When portal access is limited, do not show. */
  enabled?: boolean;
}

/**
 * Prompts clients who have not enabled push to turn on notifications after login.
 * "Later" skips for the browser session only; next login shows again.
 * Yields to the height prompt when that is also needed.
 */
export function ClientPushPromptModal({ enabled = true }: Props) {
  const { fetchWithAuth } = useApiClient();
  const [open, setOpen] = useState(false);
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
    if (!isPushSupportedInBrowser()) return;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      // Still show once so they know how to fix it — unless they already skipped.
    }

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
              . On iPhone, add the app to your Home Screen first.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
