import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  approvePendingAchievement,
  dismissPendingAchievement,
} from "@/lib/award-achievements";

/** POST: approve or dismiss a pending badge. Body: { action: "approve" | "dismiss" } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; achievementId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, achievementId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be approve or dismiss" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();

  if (action === "approve") {
    const granted = await approvePendingAchievement(db, coachId, clientId, achievementId);
    if (!granted) {
      return NextResponse.json({ error: "Pending badge not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, granted });
  }

  const dismissed = await dismissPendingAchievement(db, coachId, clientId, achievementId);
  if (!dismissed) {
    return NextResponse.json({ error: "Pending badge not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
