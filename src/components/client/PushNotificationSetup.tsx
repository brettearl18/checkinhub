"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "firebase/messaging";
import { getMessaging } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebase";
import { useApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Status = "idle" | "checking" | "prompt" | "enabling" | "enabled" | "unsupported" | "denied" | "error";

export function PushNotificationSetup() {
  const { fetchWithAuth } = useApiClient();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerAndSendToken = useCallback(async () => {
    if (!VAPID_KEY || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("enabling");
    setErrorMessage(null);
    try {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "prompt");
          setErrorMessage(permission === "denied" ? "Notifications were blocked." : "Permission not granted.");
          return;
        }
      }
      const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await reg.update();
      const app = getFirebaseApp();
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) {
        setStatus("prompt");
        setErrorMessage("Could not get notification token. Check that notifications are allowed.");
        return;
      }
      const res = await fetchWithAuth("/api/client/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage((err as { error?: string }).error || "Failed to save");
        return;
      }
      setStatus("enabled");
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong");
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (status !== "idle" || typeof window === "undefined") return;
    if (!VAPID_KEY || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("checking");
    if (Notification.permission === "granted") {
      registerAndSendToken();
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    setStatus("prompt");
  }, [status, registerAndSendToken]);

  if (status === "idle" || status === "checking" || status === "unsupported" || status === "denied") {
    return null;
  }
  if (status === "enabled") {
    return (
      <p className="text-sm text-[var(--color-success)]">
        Push notifications are on. You’ll get check-in reminders on this device.
      </p>
    );
  }
  if (status === "prompt" || status === "error" || status === "enabling") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Get check-in reminders on your phone or browser (even when the app is closed).
        </p>
        {errorMessage && status !== "enabling" && <p className="text-sm text-[var(--color-error)]">{errorMessage}</p>}
        <Button variant="secondary" onClick={registerAndSendToken} disabled={status === "enabling"}>
          {status === "enabling" ? "Enabling…" : "Enable push notifications"}
        </Button>
      </div>
    );
  }
  return null;
}
