"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

export default function ClientLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, identity, authReady, loading, signOut } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/sign-in?next=/client");
      return;
    }
    if (identity && identity.role !== "client") {
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
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/client"
              className={`text-sm font-medium ${pathname === "/client" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Dashboard
            </Link>
            <Link
              href="/client/check-in/new"
              className={`text-sm font-medium ${pathname?.startsWith("/client/check-in") ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              New check-in
            </Link>
            <Link
              href="/client/history"
              className={`text-sm font-medium ${pathname === "/client/history" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              History
            </Link>
            <Link
              href="/client/messages"
              className={`text-sm font-medium ${pathname === "/client/messages" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Messages
            </Link>
            <Link
              href="/client/measurements"
              className={`text-sm font-medium ${pathname === "/client/measurements" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Measurements
            </Link>
            <Link
              href="/client/goals"
              className={`text-sm font-medium ${pathname === "/client/goals" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Goals
            </Link>
            <Link
              href="/client/profile"
              className={`text-sm font-medium ${pathname === "/client/profile" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
            >
              Profile
            </Link>
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
