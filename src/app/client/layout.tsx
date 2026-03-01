"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/check-in/new", label: "New check-in" },
  { href: "/client/history", label: "History" },
  { href: "/client/messages", label: "Messages" },
  { href: "/client/measurements", label: "Measurements" },
  { href: "/client/goals", label: "Goals" },
  { href: "/client/progress-photos", label: "Photos" },
  { href: "/client/profile", label: "Profile" },
] as const;

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
    <div className="flex min-h-screen">
      {/* Side menu */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:w-60">
        <div className="p-4 border-b border-[var(--color-border)]">
          <Link href="/client" className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
            CheckinHUB
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_LINKS.map(({ href, label }) => {
            const active =
              href === "/client"
                ? pathname === "/client"
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
