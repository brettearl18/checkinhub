"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/clients", label: "Clients" },
  { href: "/coach/messages", label: "Messages" },
  { href: "/coach/notifications", label: "Notifications" },
  { href: "/coach/payments", label: "Payment" },
  { href: "/coach/gallery", label: "Gallery" },
  { href: "/coach/forms", label: "Forms" },
  { href: "/coach/questions", label: "Questions" },
] as const;

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
    <div className="flex min-h-screen">
      {/* Side menu */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:w-60">
        <div className="border-b border-[var(--color-border)] p-4">
          <Link href="/coach" className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
            CheckinHUB
          </Link>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Coach</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === "/coach"
                ? pathname === "/coach"
                : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </div>
      </aside>
      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
