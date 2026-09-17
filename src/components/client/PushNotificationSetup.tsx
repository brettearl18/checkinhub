"use client";

import { useCallback, useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { enableClientPushNotifications, isPushSupportedInBrowser } from "@/lib/client-push";

type Status = "idle" | "checking" | "prompt" | "enabling" | "enabled" | "unsupported" | "denied" | "error";

export function PushNotificationSetup() {
  const { fetchWithAuth } = useApiClient();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerAndSendToken = useCallback(async () => {
    setStatus("enabling");
    setErrorMessage(null);
    const result = await enableClientPushNotifications(fetchWithAuth);
    if (result.ok) {
      setStatus("enabled");
      return;
    }
    setErrorMessage(result.message);
    setStatus(result.status === "denied" ? "denied" : result.status === "unsupported" ? "unsupported" : result.status === "error" ? "error" : "prompt");
  }, [fetchWithAuth]);

  useEffect(() => {
    if (status !== "idle" || typeof window === "undefined") return;
    if (!isPushSupportedInBrowser()) {
      setStatus("unsupported");
      return;
    }
    setStatus("checking");
    if (Notification.permission === "granted") {
      void registerAndSendToken();
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
        Push notifications are on. You’ll get weight and habit reminders on this device.
      </p>
    );
  }
  if (status === "prompt" || status === "error" || status === "enabling") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Get morning weight and evening habit reminders on your phone or browser (even when the app is
          closed).
        </p>
        {errorMessage && status !== "enabling" && (
          <p className="text-sm text-[var(--color-error)]">{errorMessage}</p>
        )}
        <Button variant="secondary" onClick={() => void registerAndSendToken()} disabled={status === "enabling"}>
          {status === "enabling" ? "Enabling…" : "Enable push notifications"}
        </Button>
      </div>
    );
  }
  return null;
}
