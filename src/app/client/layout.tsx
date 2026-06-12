"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TimelineAnnouncementModal } from "@/components/client/TimelineAnnouncementModal";
import { VanaBrandBar } from "@/components/client/VanaBrandBar";
import { useAuth } from "@/contexts/AuthContext";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";

/** Vana theme trial — entire client portal; dashboard is the primary preview surface */
const VANA_THEME_TRIAL = true;

type NavIcon = (props: { className?: string }) => ReactNode;

type NavLinkItem = { href: string; label: string; icon: NavIcon };

const NAV_SECTIONS: { label: string; links: NavLinkItem[] }[] = [
  {
    label: "Overview",
    links: [{ href: "/client", label: "Dashboard", icon: HomeIcon }],
  },
  {
    label: "Training",
    links: [{ href: "/client/program", label: "Program", icon: ProgramIcon }],
  },
  {
    label: "Check-ins",
    links: [
      { href: "/client/check-in/new", label: "New check-in", icon: CheckInIcon },
      { href: "/client/habits", label: "Habits", icon: HabitsIcon },
      { href: "/client/history", label: "History", icon: HistoryIcon },
    ],
  },
  {
    label: "Progress",
    links: [
      { href: "/client/progress", label: "Progress", icon: ProgressIcon },
      { href: "/client/timeline", label: "Timeline", icon: TimelineIcon },
      { href: "/client/measurements", label: "Measurements", icon: MeasurementsIcon },
      { href: "/client/goals", label: "Goals", icon: GoalsIcon },
      { href: "/client/progress-photos", label: "Photos", icon: PhotosIcon },
    ],
  },
  {
    label: "Connect",
    links: [
      { href: "/client/notifications", label: "Notifications", icon: NotificationsIcon },
      { href: "/client/messages", label: "Messages", icon: MessagesIcon },
    ],
  },
  {
    label: "Account",
    links: [{ href: "/client/profile", label: "Profile", icon: ProfileIcon }],
  },
];

const NAV_LINKS = NAV_SECTIONS.flatMap((section) => [...section.links]);

const BOTTOM_NAV: { href: string; label: string; short: string; icon: NavIcon }[] = [
  { href: "/client", label: "Home", short: "Home", icon: HomeIcon },
  { href: "/client/program", label: "Program", short: "Workouts", icon: ProgramIcon },
  { href: "/client/check-in/new", label: "New check-in", short: "Check-in", icon: CheckInIcon },
  { href: "/client/progress", label: "Progress", short: "Progress", icon: ProgressIcon },
];

const MORE_LINKS = NAV_LINKS.filter(
  (n) => !BOTTOM_NAV.some((b) => b.href === n.href)
);

function NavSection({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  className = "",
}: {
  href: string;
  label: string;
  icon?: NavIcon;
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium min-h-[44px] flex items-center gap-2.5 transition-colors ${
        active
          ? "border-l-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] pl-[10px]"
          : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-800"
      } ${className}`}
    >
      {Icon ? (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? "text-[var(--color-primary)]" : "text-stone-400"
          }`}
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
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
      className={`rounded-xl border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--color-primary)] min-h-[44px] flex items-center justify-between gap-2 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 ${className}`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <RecipeHubIcon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">RecipeHUB</span>
      </span>
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
    if (href === "/client/progress") {
      return (
        pathname === "/client/progress" ||
        pathname?.startsWith("/client/progress-classic")
      );
    }
    return pathname?.startsWith(href);
  };

  const announcementUserId = identity?.clientId ?? user?.uid ?? null;

  return (
    <div
      className="flex min-h-screen flex-col md:flex-row bg-[var(--color-bg)]"
      {...(VANA_THEME_TRIAL ? { "data-theme": "vana" } : {})}
    >
      <TimelineAnnouncementModal userId={announcementUserId} />
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-stone-200/80 bg-[#faf7f2]">
        <VanaBrandBar />
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Check-in portal
        </p>
        <nav className="flex-1 space-y-4 p-3 overflow-y-auto">
          <RecipeHubNavLink />
          {NAV_SECTIONS.map((section) => (
            <NavSection key={section.label} label={section.label}>
              {section.links.map(({ href, label, icon }) => (
                <NavLink key={href} href={href} label={label} icon={icon} active={isActive(href)} />
              ))}
            </NavSection>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3 space-y-0.5">
          <NavLink href="/privacy" label="Privacy" icon={PrivacyIcon} active={pathname === "/privacy"} />
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
        {BOTTOM_NAV.map(({ href, label, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 px-1 text-[10px] font-medium transition-colors ${
              isActive(href)
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] active:bg-[var(--color-bg)]"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="hidden">{label}</span>
            {short}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 px-1 text-[10px] font-medium transition-colors ${
            MORE_LINKS.some((l) => isActive(l.href))
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] active:bg-[var(--color-bg)]"
          }`}
        >
          <MoreIcon className="h-5 w-5 shrink-0" aria-hidden />
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
              <div className="space-y-4">
                <RecipeHubNavLink onClick={() => setDrawerOpen(false)} />
                {NAV_SECTIONS.map((section) => (
                  <NavSection key={section.label} label={section.label}>
                    {section.links.map(({ href, label, icon }) => (
                      <NavLink
                        key={href}
                        href={href}
                        label={label}
                        icon={icon}
                        active={isActive(href)}
                        onClick={() => setDrawerOpen(false)}
                      />
                    ))}
                  </NavSection>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-0.5">
                <NavLink
                  href="/privacy"
                  label="Privacy"
                  icon={PrivacyIcon}
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

function NavSvg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1V9.5" />
    </NavSvg>
  );
}

function ProgramIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M6.5 7.5 4 10l2.5 2.5" />
      <path d="M17.5 7.5 20 10l-2.5 2.5" />
      <path d="M9 6.5h6" />
      <path d="M8.5 17.5h7" />
      <path d="M12 6.5v11" />
    </NavSvg>
  );
}

function CheckInIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6" />
      <path d="M9 13h4" />
      <path d="M16 17l2 2 4-4" />
    </NavSvg>
  );
}

function HabitsIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M12 20c3-2.5 5-5.2 5-8.5a5 5 0 0 0-10 0c0 3.3 2 6 5 8.5Z" />
      <path d="M12 20V10" />
    </NavSvg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </NavSvg>
  );
}

function ProgressIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M4 18V6" />
      <path d="M4 18h16" />
      <path d="M8 16V12" />
      <path d="M12 16V9" />
      <path d="M16 16V13" />
    </NavSvg>
  );
}

function TimelineIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M12 4v16" />
      <circle cx="12" cy="7" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="1.75" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

function MeasurementsIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M5 19 19 5" />
      <path d="M8 16l1.5-1.5" />
      <path d="M11.5 12.5 13 11" />
      <path d="M15 9l1.5-1.5" />
    </NavSvg>
  );
}

function GoalsIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </NavSvg>
  );
}

function PhotosIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <rect x="4" y="6" width="16" height="13" rx="2" />
      <circle cx="9" cy="11" r="1.5" />
      <path d="m4 16 4.5-4.5 3 3L15 11l5 5" />
    </NavSvg>
  );
}

function NotificationsIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M12 5a4 4 0 0 0-4 4v2.5L6.5 14v1h11v-1L16 11.5V9a4 4 0 0 0-4-4Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </NavSvg>
  );
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 3v-3H5a1.5 1.5 0 0 1-1.5-1.5V8a1.5 1.5 0 0 1 1.5-1.5Z" />
    </NavSvg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 19c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" />
    </NavSvg>
  );
}

function RecipeHubIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M8 4v4" />
      <path d="M16 4v4" />
      <path d="M6 8h12" />
      <path d="M7 8v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
      <path d="M10 13h4" />
    </NavSvg>
  );
}

function PrivacyIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <path d="M12 4 6 7v5c0 4 2.5 6.5 6 8 3.5-1.5 6-4 6-8V7l-6-3Z" />
    </NavSvg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </NavSvg>
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
