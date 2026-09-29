"use client";

import { useEffect } from "react";
import { useApiClient } from "@/lib/api-client";
import {
  enableClientPushNotifications,
  isPushSupportedInBrowser,
  listenForForegroundPush,
} from "@/lib/client-push";

const SESSION_REFRESHED_KEY = "checkinhub.push-token.refreshed";

/**
 * For clients who already allowed notifications on this device:
 * re-saves the current push token once per session (tokens rotate) and shows
 * a system notification for pushes that arrive while the app is open.
 */
export function ClientPushForegroundListener({ enabled = true }: { enabled?: boolean }) {
  const { fetchWithAuth } = useApiClient();

  useEffect(() => {
    if (!enabled || !isPushSupportedInBrowser() || Notification.permission !== "granted") return;

    let unsubscribe: () => void = () => {};
    let cancelled = false;

    (async () => {
      let refreshed = false;
      try {
        refreshed = sessionStorage.getItem(SESSION_REFRESHED_KEY) === "1";
      } catch {
        /* ignore */
      }
      if (!refreshed) {
        const result = await enableClientPushNotifications(fetchWithAuth);
        if (result.ok) {
          try {
            sessionStorage.setItem(SESSION_REFRESHED_KEY, "1");
          } catch {
            /* ignore */
          }
        }
      }
      if (cancelled) return;
      unsubscribe = await listenForForegroundPush();
      if (cancelled) unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled, fetchWithAuth]);

  return null;
}
