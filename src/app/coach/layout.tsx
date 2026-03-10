"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/check-ins", label: "Check ins" },
  { href: "/coach/clients", label: "Clients" },
  { href: "/coach/habits", label: "Habits" },
  { href: "/coach/messages", label: "Messages" },
  { href: "/coach/notifications", label: "Notifications" },
  { href: "/coach/payments", label: "Payment" },
  { href: "/coach/gallery", label: "Gallery" },
  { href: "/coach/forms", label: "Forms" },
  { href: "/coach/questions", label: "Questions" },
  { href: "/coach/settings", label: "Settings" },
] as const;

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export default function CoachLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, identity, authReady, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }
  if (!user) return null;

  const navContent = (
    <>
      <div className="border-b border-[var(--color-border)] p-4">
        <Link href="/coach" className="font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]" onClick={() => setMenuOpen(false)}>
          CheckinHUB
        </Link>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Coach</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-auto p-3">
        {NAV_LINKS.map(({ href, label }) => {
          const active =
            href === "/coach"
              ? pathname === "/coach"
              : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium touch-manipulation ${
                active
                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--color-border)] p-3">
        <Button
          variant="ghost"
          className="min-h-[44px] w-full justify-start text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] touch-manipulation"
          onClick={() => {
            setMenuOpen(false);
            signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile: top bar + hamburger */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 safe-area-inset-top md:hidden">
        <Link href="/coach" className="font-semibold text-[var(--color-text)]">
          CheckinHUB
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-11 min-w-[44px] items-center justify-center rounded-lg text-[var(--color-text)] hover:bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] touch-manipulation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </header>

      {/* Mobile: overlay when menu open */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl md:hidden">
            {navContent}
          </aside>
        </>
      )}

      {/* Desktop: always-visible sidebar */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:flex md:w-60">
        {navContent}
      </aside>

      {/* Main content: offset on mobile for fixed header (incl. safe area) */}
      <main className="min-w-0 flex-1 overflow-auto p-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:p-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
