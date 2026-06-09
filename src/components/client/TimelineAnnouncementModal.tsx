"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const STORAGE_PREFIX = "checkinhub.timeline-announcement.v1";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function hasSeenAnnouncement(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markAnnouncementSeen(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

interface Props {
  userId: string | null | undefined;
}

/** One-time alert introducing the progress Timeline (per client account). */
export function TimelineAnnouncementModal({ userId }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (pathname?.startsWith("/client/timeline")) return;
    if (hasSeenAnnouncement(userId)) return;
    setOpen(true);
  }, [userId, pathname]);

  const dismiss = () => {
    if (userId) markAnnouncementSeen(userId);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeline-announcement-title"
    >
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
            <TimelineIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">New</p>
            <h2 id="timeline-announcement-title" className="mt-0.5 text-lg font-semibold text-[var(--color-text)]">
              Your progress timeline
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          See your check-in scores, measurements, habits, and photos week by week — all in one place. Tap any
          week to jump straight to the detail.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={dismiss} className="min-h-[44px]">
            Maybe later
          </Button>
          <Button asChild variant="primary" className="min-h-[44px]">
            <Link
              href="/client/timeline"
              className="inline-flex items-center justify-center gap-1.5"
              onClick={dismiss}
            >
              <TimelineIcon className="h-4 w-4" />
              View your timeline
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TimelineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v18" />
      <circle cx="12" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
