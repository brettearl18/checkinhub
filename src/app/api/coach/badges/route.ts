import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  evaluateAchievementsForCoachClients,
  getCoachBadgesOverview,
} from "@/lib/award-achievements";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements";

/** GET: coach badges hub — definitions, settings, allocations. */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      definitions: ACHIEVEMENT_DEFINITIONS,
      defaultBadgeAwardMode: "auto",
      badgeStats: Object.fromEntries(
        ACHIEVEMENT_DEFINITIONS.map((d) => [d.id, { earned: 0, pending: 0 }])
      ),
      totalEarned: 0,
      totalPending: 0,
      earned: [],
      pending: [],
      clients: [],
    });
  }

  try {
    const db = getAdminDb();
    await evaluateAchievementsForCoachClients(db, coachId);
    const overview = await getCoachBadgesOverview(db, coachId);
    return NextResponse.json(overview);
  } catch (err) {
    console.error("[coach/badges GET]", err);
    return NextResponse.json({ error: "Failed to load badges" }, { status: 500 });
  }
}
