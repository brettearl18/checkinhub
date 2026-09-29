"use client";

import { getToken, getMessaging, onMessage, isSupported } from "firebase/messaging";
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

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS reports as Mac; touch support distinguishes it.
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/**
 * What the login prompt should show for a client without push:
 * - enable: browser supports push; show the Enable button
 * - ios-install: iPhone/iPad in Safari; push only works from the Home Screen app
 * - denied: permission blocked; explain how to unblock
 * - none: no path to push on this browser (e.g. some in-app browsers)
 */
export type PushPromptMode = "enable" | "ios-install" | "denied" | "none";

export function getPushPromptMode(): PushPromptMode {
  if (typeof window === "undefined" || !VAPID_KEY) return "none";
  if (isIosDevice() && !isStandaloneApp()) return "ios-install";
  if (!isPushSupportedInBrowser()) return "none";
  if (Notification.permission === "denied") return "denied";
  return "enable";
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
      body: JSON.stringify({ token, standalone: isStandaloneApp() }),
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

/**
 * FCM hands pushes to the page (not the service worker) while the app is open,
 * and nothing is displayed unless we show it ourselves.
 * Returns an unsubscribe function.
 */
export async function listenForForegroundPush(): Promise<() => void> {
  if (!isPushSupportedInBrowser() || Notification.permission !== "granted") return () => {};
  if (!(await isSupported().catch(() => false))) return () => {};
  const messaging = getMessaging(getFirebaseApp());
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || "CheckinHUB";
    const body = payload.notification?.body || payload.data?.body || "";
    const data = payload.data ?? {};
    void navigator.serviceWorker.ready
      .then((reg) =>
        reg.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/badge-96.png",
          tag: data.tag || "checkinhub",
          data,
        })
      )
      .catch(() => {
        /* no registration — in-app notification list still has it */
      });
  });
}
