"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { VanaBrandBar } from "@/components/client/VanaBrandBar";
import { useAuth } from "@/contexts/AuthContext";

/** Vana theme trial — entire client portal; dashboard is the primary preview surface */
const VANA_THEME_TRIAL = true;

const NAV_LINKS = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/program", label: "Program" },
  { href: "/client/check-in/new", label: "New check-in" },
  { href: "/client/habits", label: "Habits" },
  { href: "/client/history", label: "History" },
  { href: "/client/progress2", label: "Progress" },
  { href: "/client/timeline", label: "Timeline" },
  { href: "/client/notifications", label: "Notifications" },
  { href: "/client/messages", label: "Messages" },
  { href: "/client/measurements", label: "Measurements" },
  { href: "/client/profile/meal-plan", label: "Meal plan" },
  { href: "/client/goals", label: "Goals" },
  { href: "/client/progress-photos", label: "Photos" },
  { href: "/client/profile", label: "Profile" },
] as const;

const RECIPE_HUB_URL = "https://meals.vanahealth.com.au";

const BOTTOM_NAV = [
  { href: "/client", label: "Home", short: "Home" },
  { href: "/client/program", label: "Program", short: "Workouts" },
  { href: "/client/check-in/new", label: "New check-in", short: "Check-in" },
  { href: "/client/progress2", label: "Progress", short: "Progress" },
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
      className={`block rounded-xl px-3 py-2 text-sm font-medium min-h-[44px] flex items-center transition-colors ${
        active
          ? "border-l-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] pl-[10px]"
          : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-800"
      } ${className}`}
    >
      {label}
    </Link>
  );
}

/** Cross-app link to Vana Recipe Hub — always highlighted per THEME_DESIGN */
function RecipeHubNavLink({ onClick, className = "" }: { onClick?: () => void; className?: string }) {
  return (
    <a
      href={RECIPE_HUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`mt-1 block rounded-xl border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--color-primary)] min-h-[44px] flex items-center justify-between gap-2 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 ${className}`}
    >
      <span>RecipeHUB</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80" aria-hidden>
        Open ↗
      </span>
    </a>
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

  const isActive = (href: string) => {
    if (href === "/client") return pathname === "/client";
    if (href === "/client/progress2") return pathname?.startsWith("/client/progress");
    return pathname?.startsWith(href);
  };

  return (
    <div
      className="flex min-h-screen flex-col md:flex-row bg-[var(--color-bg)]"
      {...(VANA_THEME_TRIAL ? { "data-theme": "vana" } : {})}
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-stone-200/80 bg-[#faf7f2]">
        <VanaBrandBar />
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Check-in portal
        </p>
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          {NAV_LINKS.map(({ href, label }) => (
            <NavLink key={href} href={href} label={label} active={isActive(href)} />
          ))}
          <RecipeHubNavLink />
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
      <header className="md:hidden sticky top-0 z-30 safe-area-inset-top">
        <VanaBrandBar />
        <div className="flex items-center justify-between border-b border-stone-200/80 bg-[#fffdf9] px-4 py-2">
          <span className="text-sm font-medium text-stone-600">Your portal</span>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8 flex flex-col">
        <div className="flex-1 min-h-0">
          {children}
        </div>
        <footer className="mt-auto pt-12 pb-8 md:pt-16 md:pb-10 border-t border-[var(--color-border)] flex-shrink-0">
          <div className="text-center text-xs text-[var(--color-text-muted)]">
            CheckinHUB
          </div>
        </footer>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-stone-200/80 bg-[#fffdf9]/95 backdrop-blur-sm safe-area-inset-bottom"
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
          <div className="md:hidden fixed inset-x-0 bottom-0 top-[108px] z-50 rounded-t-2xl bg-[#fffdf9] shadow-lg overflow-y-auto safe-area-inset-bottom">
            <div className="p-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-medium text-stone-800">Menu</h2>
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
                <RecipeHubNavLink onClick={() => setDrawerOpen(false)} />
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
