"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { formatDateTimeDisplay } from "@/lib/format-date";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string | null;
}

export default function CoachNotificationsPage() {
  const { fetchWithAuth } = useApiClient();
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const load = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/notifications");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/coach/notifications/${id}`, { method: "PATCH" });
      if (res.ok) {
        setList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, [fetchWithAuth]);

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  const unreadCount = list.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Notifications</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up."}
        </p>
      </div>

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}
      {!loading && list.length === 0 && (
        <Card className="p-6">
          <p className="text-[var(--color-text-muted)]">No notifications yet.</p>
        </Card>
      )}
      {!loading && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Card className={`p-4 ${!n.isRead ? "border-l-4 border-l-[var(--color-primary)]" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-text)]">{n.title}</p>
                    {n.message && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{n.message}</p>}
                    {n.createdAt && (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTimeDisplay(n.createdAt)}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="touch-manipulation py-2 px-2 -my-1 text-sm text-[var(--color-primary)] hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                    {n.actionUrl && (
                      <Link href={n.actionUrl} className="touch-manipulation py-2 px-2 -my-1 inline-block text-sm text-[var(--color-primary)] hover:underline" onClick={() => markRead(n.id)}>
                        View
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
