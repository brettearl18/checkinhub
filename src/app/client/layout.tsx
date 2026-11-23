"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TimelineAnnouncementModal } from "@/components/client/TimelineAnnouncementModal";
import { ClientHeightPromptModal } from "@/components/client/ClientHeightPromptModal";
import { ClientPushPromptModal } from "@/components/client/ClientPushPromptModal";
import { ClientPushForegroundListener } from "@/components/client/ClientPushForegroundListener";
import { useAuth } from "@/contexts/AuthContext";
import { useApiClient } from "@/lib/api-client";
import { RECIPE_HUB_URL } from "@/lib/recipe-hub";

/** Vana theme trial — entire client portal; dashboard is the primary preview surface */
const VANA_THEME_TRIAL = true;

type NavIcon = (props: { className?: string }) => ReactNode;

type NavLinkItem = { href: string; label: string; icon: NavIcon };

const NAV_SECTIONS: { label: string; links: NavLinkItem[] }[] = [
  {
    label: "Today",
    links: [{ href: "/client", label: "Today", icon: HomeIcon }],
  },
  {
    label: "Check-in",
    links: [
      { href: "/client/check-in/new", label: "Check-in", icon: CheckInIcon },
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
      { href: "/client/cycle", label: "Cycle", icon: CycleIcon },
      { href: "/client/progress-photos", label: "Photos", icon: PhotosIcon },
      { href: "/client/program", label: "Program", icon: ProgramIcon },
    ],
  },
  {
    label: "More",
    links: [
      { href: "/client/notifications", label: "Notifications", icon: NotificationsIcon },
      { href: "/client/messages", label: "Messages", icon: MessagesIcon },
      { href: "/client/profile", label: "Profile", icon: ProfileIcon },
    ],
  },
];

const NAV_LINKS = NAV_SECTIONS.flatMap((section) => [...section.links]);

function navSectionsForClient(cycleTrackingEnabled: boolean) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => link.href !== "/client/cycle" || cycleTrackingEnabled),
  })).filter((section) => section.links.length > 0);
}

/** Primary tabs — design brief: Today · Check-in · Progress · More */
const BOTTOM_NAV: { href: string; label: string; short: string; icon: NavIcon }[] = [
  { href: "/client", label: "Today", short: "Today", icon: HomeIcon },
  { href: "/client/check-in/new", label: "Check-in", short: "Check-in", icon: CheckInIcon },
  { href: "/client/progress", label: "Progress", short: "Progress", icon: ProgressIcon },
];

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
      className={`rounded-[12px] px-3 py-2 text-[15px] font-medium min-h-[44px] flex items-center gap-2.5 transition-colors ${
        active
          ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text)]"
      } ${className}`}
    >
      {Icon ? (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
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
  const { fetchWithAuth } = useApiClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [portalAccessLimited, setPortalAccessLimited] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadAccountStatus = async () => {
      try {
        const res = await fetchWithAuth("/api/client/profile");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setPortalAccessLimited(Boolean(json.portalAccessLimited));
        }
      } catch {
        // non-fatal
      }
    };
    loadAccountStatus();
    return () => {
      cancelled = true;
    };
  }, [user, fetchWithAuth, pathname]);

  useEffect(() => {
    if (!portalAccessLimited) return;
    if (pathname !== "/client/profile") {
      router.replace("/client/profile");
    }
  }, [portalAccessLimited, pathname, router]);

  useEffect(() => {
    if (!user || portalAccessLimited) return;
    let cancelled = false;
    const loadCycleNav = async () => {
      try {
        const res = await fetchWithAuth("/api/client/cycle");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setCycleTrackingEnabled(Boolean(json.profile?.trackingEnabled));
        }
      } catch {
        // non-fatal
      }
    };
    loadCycleNav();
    const onCycleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setCycleTrackingEnabled(detail.enabled);
      } else {
        loadCycleNav();
      }
    };
    window.addEventListener("cycle-tracking-updated", onCycleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("cycle-tracking-updated", onCycleUpdate);
    };
  }, [user, fetchWithAuth, pathname]);

  const navSections = portalAccessLimited
    ? [{ label: "Account", links: [{ href: "/client/profile", label: "Profile", icon: ProfileIcon }] }]
    : navSectionsForClient(cycleTrackingEnabled);
  const navLinks = navSections.flatMap((section) => [...section.links]);
  const moreLinks = navLinks.filter((n) => !BOTTOM_NAV.some((b) => b.href === n.href));

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
      <ClientHeightPromptModal enabled={Boolean(user) && !portalAccessLimited} />
      <ClientPushPromptModal enabled={Boolean(user) && !portalAccessLimited} />
      <ClientPushForegroundListener enabled={Boolean(user) && !portalAccessLimited} />
      {/* Desktop sidebar — quiet wordmark, no gold strip */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="px-5 pt-6 pb-2">
          <Link href="/client" className="inline-flex items-center">
            <span className="text-[13px] font-semibold tracking-[0.18em] text-[var(--color-text)]">
              VANA
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-4 p-3 overflow-y-auto">
          <RecipeHubNavLink />
          {navSections.map((section) => (
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

      {/* Mobile: no sticky chrome — titles live on the page; safe-area spacer only */}
      <div className="md:hidden safe-area-inset-top" aria-hidden />

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto px-4 pt-3 pb-24 md:p-8 md:pb-8 flex flex-col">
        <div className="flex-1 min-h-0 max-w-3xl mx-auto w-full md:max-w-none md:mx-0">
          {children}
        </div>
        <footer className="mt-auto pt-10 pb-4 md:pt-16 md:pb-10 flex-shrink-0">
          <div className="text-center text-xs text-[var(--color-text-muted)]">Vana</div>
        </footer>
      </main>

      {/* Mobile bottom nav */}
      {!portalAccessLimited && (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-[var(--color-border)] vana-tab-bar safe-area-inset-bottom"
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
            moreLinks.some((l) => isActive(l.href))
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-text-muted)] active:bg-[var(--color-bg)]"
          }`}
        >
          <MoreIcon className="h-5 w-5 shrink-0" aria-hidden />
          More
        </button>
      </nav>
      )}

      {/* Mobile drawer (More menu) */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            aria-hidden
            onClick={() => setDrawerOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 top-12 z-50 rounded-t-[20px] bg-[var(--color-bg-elevated)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] overflow-y-auto safe-area-inset-bottom">
            <div className="p-4 pb-8">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--color-border)]" aria-hidden />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[22px] font-semibold text-[var(--color-text)]">More</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="space-y-4">
                <RecipeHubNavLink onClick={() => setDrawerOpen(false)} />
                {navSections.map((section) => (
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

function CycleIcon({ className }: { className?: string }) {
  return (
    <NavSvg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a4 4 0 0 1 0 8" />
      <path d="M12 12a4 4 0 0 1 0 8" />
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
