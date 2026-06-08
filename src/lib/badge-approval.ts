import type { Firestore } from "firebase-admin/firestore";

/** How badges are awarded for a client. */
export type BadgeAwardMode = "auto" | "coach";

/** Per-client override; `default` inherits the coach's default. */
export type ClientBadgeAwardMode = "default" | BadgeAwardMode;

export const BADGE_AWARD_MODE_LABELS: Record<BadgeAwardMode, string> = {
  auto: "Award automatically",
  coach: "Coach approves first",
};

export const CLIENT_BADGE_AWARD_MODE_LABELS: Record<ClientBadgeAwardMode, string> = {
  default: "Use coach default",
  auto: "Award automatically",
  coach: "Coach approves first",
};

/** Resolve effective badge award mode for a client. */
export async function resolveBadgeAwardMode(
  db: Firestore,
  clientId: string
): Promise<BadgeAwardMode> {
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) return "auto";

  const data = clientSnap.data() as {
    badgeAwardMode?: ClientBadgeAwardMode;
    coachId?: string;
  };

  if (data.badgeAwardMode === "auto" || data.badgeAwardMode === "coach") {
    return data.badgeAwardMode;
  }

  const coachId = data.coachId;
  if (!coachId) return "auto";

  const coachSnap = await db.collection("coaches").doc(coachId).get();
  if (!coachSnap.exists) return "auto";

  const coachDefault = coachSnap.data()?.defaultBadgeAwardMode;
  return coachDefault === "coach" ? "coach" : "auto";
}

export async function getCoachDefaultBadgeAwardMode(
  db: Firestore,
  coachId: string
): Promise<BadgeAwardMode> {
  const snap = await db.collection("coaches").doc(coachId).get();
  if (!snap.exists) return "auto";
  return snap.data()?.defaultBadgeAwardMode === "coach" ? "coach" : "auto";
}
