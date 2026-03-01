"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

export default function CoachLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, identity, authReady, loading, signOut } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/sign-in?next=/coach");
      return;
    }
    if (identity && identity.role !== "coach") {
      router.replace("/");
      return;
    }
  }, [authReady, user, identity, router]);

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/coach"
              className={`text-sm font-medium ${pathname === "/coach" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Dashboard
            </Link>
            <Link
              href="/coach/messages"
              className={`text-sm font-medium ${pathname?.startsWith("/coach/messages") ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Messages
            </Link>
            <Link
              href="/coach/notifications"
              className={`text-sm font-medium ${pathname === "/coach/notifications" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Notifications
            </Link>
            <Link
              href="/coach/forms"
              className={`text-sm font-medium ${pathname?.startsWith("/coach/forms") ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Forms
            </Link>
            <Link
              href="/coach/questions"
              className={`text-sm font-medium ${pathname === "/coach/questions" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Questions
            </Link>
            <span className="text-[var(--color-border)]">|</span>
            <span className="text-sm text-[var(--color-text-muted)]">Coach</span>
          </div>
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
