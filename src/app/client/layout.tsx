"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/check-in/new", label: "New check-in" },
  { href: "/client/habits", label: "Habits" },
  { href: "/client/history", label: "History" },
  { href: "/client/progress", label: "Progress" },
  { href: "/client/notifications", label: "Notifications" },
  { href: "/client/messages", label: "Messages" },
  { href: "/client/measurements", label: "Measurements" },
  { href: "/client/goals", label: "Goals" },
  { href: "/client/progress-photos", label: "Photos" },
  { href: "/client/profile", label: "Profile" },
] as const;

const BOTTOM_NAV = [
  { href: "/client", label: "Home", short: "Home" },
  { href: "/client/check-in/new", label: "New check-in", short: "Check-in" },
  { href: "/client/progress", label: "Progress", short: "Progress" },
] as const;

const MORE_LINKS = NAV_LINKS.filter(
  (n) => !BOTTOM_NAV.some((b) => b.href === n.href)
);

function NavLink({
  href,
  label,
  active,
  onClick,
  className = "",
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] flex items-center ${
        active
          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
      } ${className}`}
    >
      {label}
    </Link>
  );
}

export default function ClientLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, identity, authReady, loading, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }
  if (!user) return null;

  const isActive = (href: string) =>
    href === "/client" ? pathname === "/client" : pathname?.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:w-60">
        <div className="p-4 border-b border-[var(--color-border)]">
          <Link href="/client" className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
            CheckinHUB
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          {NAV_LINKS.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} active={isActive(href)} />
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3 space-y-0.5">
          <NavLink href="/privacy" label="Privacy" active={pathname === "/privacy"} />
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] min-h-[44px]"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] safe-area-inset-top">
        <Link href="/client" className="font-semibold text-[var(--color-text)]">
          CheckinHUB
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
      </header>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] safe-area-inset-bottom"
        aria-label="Primary"
      >
        {BOTTOM_NAV.map(({ href, label, short }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center min-h-[56px] py-2 px-1 text-xs font-medium transition-colors ${
              isActive(href)
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] active:bg-[var(--color-bg)]"
            }`}
          >
            <span className="hidden">{label}</span>
            {short}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center min-h-[56px] py-2 px-1 text-xs font-medium transition-colors ${
            MORE_LINKS.some((l) => isActive(l.href))
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] active:bg-[var(--color-bg)]"
          }`}
        >
          More
        </button>
      </nav>

      {/* Mobile drawer (More menu) */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50"
            aria-hidden
            onClick={() => setDrawerOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 top-[60px] z-50 rounded-t-2xl bg-[var(--color-bg-elevated)] shadow-lg overflow-y-auto safe-area-inset-bottom">
            <div className="p-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Menu</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="space-y-0.5">
                {MORE_LINKS.map(({ href, label }) => (
                  <NavLink
                    key={href}
                    href={href}
                    label={label}
                    active={isActive(href)}
                    onClick={() => setDrawerOpen(false)}
                  />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-0.5">
                <NavLink
                  href="/privacy"
                  label="Privacy"
                  active={pathname === "/privacy"}
                  onClick={() => setDrawerOpen(false)}
                />
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[var(--color-text-secondary)] min-h-[48px]"
                  onClick={() => {
                    setDrawerOpen(false);
                    signOut();
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
