import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  collectAwaitingCelebration,
  evaluateAndAwardAchievements,
  listClientAchievements,
} from "@/lib/award-achievements";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements";

/** GET: list badges (earned + locked). Evaluates and awards any newly eligible. */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    const list = ACHIEVEMENT_DEFINITIONS.map((def) => ({
      ...def,
      earned: false,
      earnedAt: null,
    }));
    return NextResponse.json({ achievements: list, newlyEarned: [], earnedCount: 0 });
  }

  try {
    const db = getAdminDb();
    const [evaluated, awaiting] = await Promise.all([
      evaluateAndAwardAchievements(db, clientId),
      collectAwaitingCelebration(db, clientId),
    ]);
    const newlyEarned = [...evaluated, ...awaiting];
    const achievements = await listClientAchievements(db, clientId);
    const earnedCount = achievements.filter((a) => a.earned).length;

    return NextResponse.json({
      achievements,
      newlyEarned,
      earnedCount,
      totalCount: achievements.length,
    });
  } catch (err) {
    console.error("[client/achievements GET]", err);
    return NextResponse.json({ error: "Failed to load achievements" }, { status: 500 });
  }
}
