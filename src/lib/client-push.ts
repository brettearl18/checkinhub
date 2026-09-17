"use client";

import { getToken, getMessaging } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebase";

const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushEnableResult =
  | { ok: true }
  | { ok: false; status: "unsupported" | "denied" | "prompt" | "error"; message: string };

export function isPushSupportedInBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(VAPID_KEY) &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/**
 * Request permission (if needed), register the messaging SW, and save the FCM token.
 */
export async function enableClientPushNotifications(
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
): Promise<PushEnableResult> {
  if (!isPushSupportedInBrowser()) {
    return {
      ok: false,
      status: "unsupported",
      message:
        "Push notifications aren’t available on this device. On iPhone, add CheckinHUB to your Home Screen first.",
    };
  }

  try {
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return {
          ok: false,
          status: permission === "denied" ? "denied" : "prompt",
          message:
            permission === "denied"
              ? "Notifications were blocked. You can enable them later in browser settings or Notifications."
              : "Permission not granted.",
        };
      }
    } else if (Notification.permission === "denied") {
      return {
        ok: false,
        status: "denied",
        message:
          "Notifications are blocked for this site. Enable them in your browser settings, then try again from Notifications.",
      };
    }

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await reg.update();
    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      return {
        ok: false,
        status: "prompt",
        message: "Could not get a notification token. Check that notifications are allowed.",
      };
    }

    const res = await fetchWithAuth("/api/client/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: "error",
        message: (err as { error?: string }).error || "Failed to save notification setup.",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      message: e instanceof Error ? e.message : "Something went wrong",
    };
  }
}
