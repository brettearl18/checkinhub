"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { BADGE_AWARD_MODE_LABELS, type BadgeAwardMode } from "@/lib/badge-approval";

export default function CoachSettingsPage() {
  const { fetchWithAuth } = useApiClient();
  const [authError, setAuthError] = useState(false);
  const [badgeMode, setBadgeMode] = useState<BadgeAwardMode>("auto");
  const [badgeModeLoading, setBadgeModeLoading] = useState(true);
  const [badgeModeSaving, setBadgeModeSaving] = useState(false);
  const [badgeModeSaved, setBadgeModeSaved] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    testMode: boolean;
    coachDisplayName: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      setBadgeModeLoading(true);
      try {
        const [settingsRes, emailRes] = await Promise.all([
          fetchWithAuth("/api/coach/settings"),
          fetchWithAuth("/api/coach/email-status"),
        ]);
        if (settingsRes.status === 401 || emailRes.status === 401) {
          setAuthError(true);
          return;
        }
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data.defaultBadgeAwardMode === "coach" || data.defaultBadgeAwardMode === "auto") {
            setBadgeMode(data.defaultBadgeAwardMode);
          }
        }
        if (emailRes.ok) {
          const data = await emailRes.json();
          setEmailStatus({
            configured: Boolean(data.configured),
            testMode: Boolean(data.testMode),
            coachDisplayName:
              typeof data.coachDisplayName === "string" ? data.coachDisplayName : "Coach Silvi",
          });
        }
      } finally {
        setBadgeModeLoading(false);
      }
    })();
  }, [fetchWithAuth]);

  const saveBadgeMode = async () => {
    setBadgeModeSaving(true);
    setBadgeModeSaved(false);
    try {
      const res = await fetchWithAuth("/api/coach/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultBadgeAwardMode: badgeMode }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) setBadgeModeSaved(true);
    } finally {
      setBadgeModeSaving(false);
    }
  };

  const sendTest = async (
    template:
      | "default"
      | "reminder-open"
      | "reminder-closing"
      | "account-closed"
      | "account-reactivated"
      | "deletion-warning"
  ) => {
    if (!testEmailTo.trim()) return;
    setTestEmailMessage(null);
    setTestEmailLoading(true);
    try {
      const res = await fetchWithAuth("/api/coach/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmailTo.trim(),
          ...(template !== "default" ? { template } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const labels: Record<string, string> = {
          default: "Test email sent. Check the inbox (and spam).",
          "reminder-open": "Reminder (open) test sent.",
          "reminder-closing": "Reminder (closing) test sent.",
          "account-closed": "Account closed preview sent.",
          "account-reactivated": "Account reactivated preview sent.",
          "deletion-warning": "Deletion warning preview sent.",
        };
        setTestEmailMessage({ type: "success", text: labels[template] ?? "Test email sent." });
      } else {
        setTestEmailMessage({ type: "error", text: (data.error as string) || "Failed to send" });
      }
    } catch {
      setTestEmailMessage({ type: "error", text: "Request failed" });
    } finally {
      setTestEmailLoading(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Email and other coach-level options.
        </p>
      </div>

      {/* Badges */}
      <Card className="p-5 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Badges</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Default for new clients: badges are usually awarded automatically when earned. Switch to coach approval
          if you want to review badges before clients see them. Override per client in Client settings.
        </p>
        {badgeModeLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px]">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Default badge award mode
              </label>
              <select
                value={badgeMode}
                onChange={(e) => {
                  setBadgeMode(e.target.value as BadgeAwardMode);
                  setBadgeModeSaved(false);
                }}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {(Object.keys(BADGE_AWARD_MODE_LABELS) as BadgeAwardMode[]).map((key) => (
                  <option key={key} value={key}>
                    {BADGE_AWARD_MODE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="primary" disabled={badgeModeSaving} onClick={saveBadgeMode}>
              {badgeModeSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
        {badgeModeSaved && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400" role="status">
            Badge settings saved.
          </p>
        )}
      </Card>

      {/* Email */}
      <Card className="p-5 border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Email</h2>
        {emailStatus && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${
              !emailStatus.configured
                ? "border-red-200 bg-red-50 text-red-800"
                : emailStatus.testMode
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {!emailStatus.configured ? (
              <p>
                <strong>Not configured.</strong> Add Mailgun variables in Vercel (Production) and redeploy.
              </p>
            ) : emailStatus.testMode ? (
              <p>
                <strong>Test mode.</strong> All emails are redirected to one inbox (MAILGUN_TEST_EMAIL). Remove
                that variable in Vercel to send live emails to clients.
              </p>
            ) : (
              <p>
                <strong>Live.</strong> Clients receive emails at their registered address. Cancellation emails
                send from <strong>{emailStatus.coachDisplayName}</strong>.
              </p>
            )}
          </div>
        )}
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Emails are sent via Mailgun. Preview reminders and account emails below before they go to clients.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            placeholder="email@example.com"
            value={testEmailTo}
            onChange={(e) => {
              setTestEmailTo(e.target.value);
              setTestEmailMessage(null);
            }}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] w-64"
            aria-label="Email address for test"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("default")}
          >
            {testEmailLoading ? "Sending…" : "Send test email"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Reminder preview:</span>
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("reminder-open")}
          >
            Send “check-in open” test
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("reminder-closing")}
          >
            Send “closing” test
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">Account emails:</span>
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("account-closed")}
          >
            Account closed
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("account-reactivated")}
          >
            Account reactivated
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testEmailLoading || !testEmailTo.trim()}
            onClick={() => sendTest("deletion-warning")}
          >
            Deletion warning
          </Button>
        </div>
        {testEmailMessage && (
          <p
            className={`mt-3 text-sm ${testEmailMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-[var(--color-error)]"}`}
            role="alert"
          >
            {testEmailMessage.text}
          </p>
        )}
      </Card>
    </div>
  );
}
