"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AuthErrorRetry } from "@/components/client/AuthErrorRetry";
import { useApiClient } from "@/lib/api-client";
import { BADGE_AWARD_MODE_LABELS, type BadgeAwardMode } from "@/lib/badge-approval";
import {
  BADGES_BY_DIFFICULTY,
  CATEGORY_LABELS,
  type AchievementDefinition,
  type CoachBadgesClientSummary,
  type CoachBadgesOverview,
} from "@/lib/achievements";
import { formatDateDisplay } from "@/lib/format-date";

const BADGE_COL_W = "2.75rem"; // 44px — keeps header + rows aligned
const CLIENT_COL_W = "13.5rem";

function clientDisplayName(client: CoachBadgesClientSummary): string {
  return [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || "Client";
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function allocationKey(clientId: string, achievementId: string): string {
  return `${clientId}_${achievementId}`;
}

type SlotStatus = "earned" | "pending" | "open";

export default function CoachBadgesPage() {
  const { fetchWithAuth } = useApiClient();
  const [data, setData] = useState<CoachBadgesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [badgeMode, setBadgeMode] = useState<BadgeAwardMode>("auto");
  const [badgeModeSaving, setBadgeModeSaving] = useState(false);
  const [badgeModeSaved, setBadgeModeSaved] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const res = await fetchWithAuth("/api/coach/badges");
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as CoachBadgesOverview;
        setData(json);
        setBadgeMode(json.defaultBadgeAwardMode);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const earnedAtByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.earned ?? []) {
      map.set(allocationKey(row.clientId, row.achievementId), row.date);
    }
    return map;
  }, [data?.earned]);

  const pendingAtByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.pending ?? []) {
      map.set(allocationKey(row.clientId, row.achievementId), row.date);
    }
    return map;
  }, [data?.pending]);

  const sortedClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return [...(data?.clients ?? [])]
      .filter((c) => !q || clientDisplayName(c).toLowerCase().includes(q))
      .sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)));
  }, [data?.clients, clientSearch]);

  const gridTemplate = useMemo(
    () => `${CLIENT_COL_W} repeat(${BADGES_BY_DIFFICULTY.length}, ${BADGE_COL_W})`,
    []
  );

  const handlePendingAction = async (
    clientId: string,
    achievementId: string,
    action: "approve" | "dismiss"
  ) => {
    const key = allocationKey(clientId, achievementId);
    setActingKey(key);
    try {
      const res = await fetchWithAuth(
        `/api/coach/clients/${clientId}/achievements/${achievementId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) await load();
    } finally {
      setActingKey(null);
    }
  };

  const saveBadgeMode = async () => {
    setBadgeModeSaving(true);
    setBadgeModeSaved(false);
    try {
      const res = await fetchWithAuth("/api/coach/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultBadgeAwardMode: badgeMode }),
      });
      if (res.status === 401) {
        setAuthError(true);
        return;
      }
      if (res.ok) {
        setBadgeModeSaved(true);
        await load();
      }
    } finally {
      setBadgeModeSaving(false);
    }
  };

  if (authError) {
    return <AuthErrorRetry onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/coach" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Badges</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-text-secondary)]">
            Each client row shows badge slots left to right — easiest to hardest. Hover any slot for the full definition.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          {settingsOpen ? "Hide settings" : "Award settings"}
        </button>
      </div>

      {settingsOpen && (
        <Card className="p-5 max-w-xl">
          <h2 className="text-base font-medium text-[var(--color-text)]">Default award mode</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Applies to all clients unless overridden in client settings.
          </p>
          <div className="mt-4">
            <select
              value={badgeMode}
              onChange={(e) => {
                setBadgeMode(e.target.value as BadgeAwardMode);
                setBadgeModeSaved(false);
              }}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              {(Object.keys(BADGE_AWARD_MODE_LABELS) as BadgeAwardMode[]).map((key) => (
                <option key={key} value={key}>
                  {BADGE_AWARD_MODE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="primary" disabled={badgeModeSaving} onClick={saveBadgeMode}>
              {badgeModeSaving ? "Saving…" : "Save"}
            </Button>
          </div>
          {badgeModeSaved && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">Settings saved.</p>
          )}
        </Card>
      )}

      {!loading && data && (
        <div className="flex flex-wrap items-center gap-3">
          <StatPill label="Earned" value={data.totalEarned} />
          <StatPill label="Pending" value={data.totalPending} highlight={data.totalPending > 0} />
          <StatPill label="Clients" value={data.clients.length} />
          <span className="hidden h-4 w-px bg-[var(--color-border)] sm:block" aria-hidden />
          <LegendSwatch status="earned" label="Earned" />
          <LegendSwatch status="pending" label="Pending" />
          <LegendSwatch status="open" label="Not yet" />
        </div>
      )}

      {loading && <p className="text-[var(--color-text-muted)]">Loading…</p>}

      {!loading && data && data.pending.length > 0 && (
        <Card className="border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)]/20 p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Pending approval ({data.pending.length})
          </h2>
          <ul className="mt-3 space-y-1.5">
            {data.pending.map((row) => {
              const key = allocationKey(row.clientId, row.achievementId);
              const acting = actingKey === key;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
                >
                  <span className="text-sm text-[var(--color-text)]">
                    <Link
                      href={`/coach/clients/${row.clientId}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {row.clientName}
                    </Link>
                    <span className="text-[var(--color-text-muted)]">
                      {" "}
                      · {row.emoji} {row.name} · {formatDateDisplay(row.date.slice(0, 10))}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => handlePendingAction(row.clientId, row.achievementId, "approve")}
                      className="rounded px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]"
                    >
                      {acting ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => handlePendingAction(row.clientId, row.achievementId, "dismiss")}
                      className="rounded px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]"
                    >
                      Dismiss
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {!loading && data && data.clients.length > 0 && (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Client badge board
            </p>
            <input
              type="search"
              placeholder="Search clients…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full max-w-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)]"
            />
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Sticky header — columns lock to client rows */}
              <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 pb-3 pt-2">
                <div
                  className="mb-1.5 grid gap-x-1.5"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div />
                  <div
                    className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]"
                    style={{ gridColumn: "2 / -1" }}
                  >
                    <span>Easier</span>
                    <span>Harder</span>
                  </div>
                </div>
                <div
                  className="grid items-end gap-x-1.5"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Client
                  </p>
                  {BADGES_BY_DIFFICULTY.map((badge, index) => (
                    <BadgeHeaderCell key={badge.id} badge={badge} rank={index + 1} />
                  ))}
                </div>
              </div>

              {/* Client rows */}
              <ul>
                {sortedClients.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    No clients match your search.
                  </li>
                ) : (
                  sortedClients.map((client) => (
                    <ClientBadgeRow
                      key={client.id}
                      client={client}
                      gridTemplate={gridTemplate}
                      earnedAtByKey={earnedAtByKey}
                      pendingAtByKey={pendingAtByKey}
                    />
                  ))
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {!loading && data && data.clients.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">No clients yet.</p>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-sm ${
        highlight
          ? "border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
      }`}
    >
      <strong className="text-[var(--color-text)]">{value}</strong> {label}
    </span>
  );
}

function LegendSwatch({ status, label }: { status: SlotStatus; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-sm ${
          status === "earned"
            ? "border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)]"
            : status === "pending"
              ? "border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/40"
              : "border border-dashed border-[var(--color-border)] opacity-40"
        }`}
      >
        ✅
      </span>
      {label}
    </span>
  );
}

function BadgeHoverTip({
  badge,
  rank,
  status,
  clientName,
  dateLabel,
  children,
}: {
  badge: AchievementDefinition;
  rank?: number;
  status?: SlotStatus;
  clientName?: string;
  dateLabel?: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: false });

  const statusLine =
    status === "earned" && clientName && dateLabel
      ? `${clientName} earned this ${dateLabel}`
      : status === "pending" && clientName
        ? `${clientName} — awaiting your approval`
        : status === "open" && clientName
          ? `${clientName} — not earned yet`
          : null;

  const showTip = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120);
    const belowY = rect.bottom + 10;
    const aboveY = rect.top - 10;
    const y = belowY + 160 > window.innerHeight ? aboveY : belowY;
    setPos({ x, y, above: belowY + 160 > window.innerHeight });
    setVisible(true);
  };

  const hideTip = () => setVisible(false);

  const tipTitle = `${badge.name}: ${badge.description}`;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative flex justify-center"
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        title={tipTitle}
      >
        {children}
      </div>
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-left shadow-xl"
            style={{
              left: pos.x,
              top: pos.y,
              transform: `translateX(-50%)${pos.above ? " translateY(-100%)" : ""}`,
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none" aria-hidden>
                {badge.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text)]">{badge.name}</p>
                {rank != null && (
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    #{rank} · {CATEGORY_LABELS[badge.category]}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {badge.description}
            </p>
            {statusLine && (
              <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-[10px] text-[var(--color-text-muted)]">
                {statusLine}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

function BadgeHeaderCell({ badge, rank }: { badge: AchievementDefinition; rank: number }) {
  return (
    <BadgeHoverTip badge={badge} rank={rank}>
      <div className="flex w-full flex-col items-center gap-0.5 rounded-md px-0.5 py-1 transition-colors hover:bg-[var(--color-bg)]">
        <span className="text-lg leading-none" aria-hidden>
          {badge.emoji}
        </span>
        <span className="w-full truncate text-center text-[9px] font-medium text-[var(--color-text-muted)]">
          {badge.name.split(" ")[0]}
        </span>
      </div>
    </BadgeHoverTip>
  );
}

function ClientBadgeRow({
  client,
  gridTemplate,
  earnedAtByKey,
  pendingAtByKey,
}: {
  client: CoachBadgesClientSummary;
  gridTemplate: string;
  earnedAtByKey: Map<string, string>;
  pendingAtByKey: Map<string, string>;
}) {
  const name = clientDisplayName(client);
  const initials = clientInitials(name);
  const totalBadges = BADGES_BY_DIFFICULTY.length;

  return (
    <li
      className="grid items-center gap-x-1.5 border-b border-[var(--color-border)] px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--color-bg-elevated)]/40"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <Link
        href={`/coach/clients/${client.id}`}
        className="flex min-w-0 items-center gap-2.5"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-text-secondary)]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {client.earnedCount}/{totalBadges}
            {client.pendingCount > 0 && (
              <span className="text-[var(--color-primary)]"> · {client.pendingCount} pending</span>
            )}
          </p>
        </div>
      </Link>

      {BADGES_BY_DIFFICULTY.map((badge, index) => {
        const key = allocationKey(client.id, badge.id);
        const earnedAt = earnedAtByKey.get(key);
        const pendingAt = pendingAtByKey.get(key);
        const status: SlotStatus = earnedAt ? "earned" : pendingAt ? "pending" : "open";
        const dateLabel = earnedAt
          ? formatDateDisplay(earnedAt.slice(0, 10))
          : pendingAt
            ? formatDateDisplay(pendingAt.slice(0, 10))
            : undefined;

        return (
          <BadgeSlot
            key={badge.id}
            badge={badge}
            rank={index + 1}
            clientName={name}
            status={status}
            dateLabel={dateLabel}
          />
        );
      })}
    </li>
  );
}

function BadgeSlot({
  badge,
  rank,
  clientName,
  status,
  dateLabel,
}: {
  badge: AchievementDefinition;
  rank: number;
  clientName: string;
  status: SlotStatus;
  dateLabel?: string;
}) {
  const base =
    "flex h-11 w-11 items-center justify-center rounded-lg text-lg transition-transform hover:scale-105";

  const className =
    status === "earned"
      ? `${base} border border-[var(--color-primary-muted)] bg-[var(--color-primary-subtle)] shadow-sm`
      : status === "pending"
        ? `${base} border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/30`
        : `${base} border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60`;

  const emojiClass =
    status === "earned"
      ? ""
      : status === "pending"
        ? "opacity-90"
        : "opacity-[0.38] grayscale-[0.6]";

  return (
    <BadgeHoverTip
      badge={badge}
      rank={rank}
      status={status}
      clientName={clientName}
      dateLabel={dateLabel}
    >
      <div className={className}>
        <span className={emojiClass} aria-hidden>
          {badge.emoji}
        </span>
      </div>
    </BadgeHoverTip>
  );
}
