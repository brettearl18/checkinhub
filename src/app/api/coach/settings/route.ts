import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import {
  getCoachDefaultBadgeAwardMode,
  type BadgeAwardMode,
} from "@/lib/badge-approval";

/** GET: coach-level settings. */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ defaultBadgeAwardMode: "auto" as BadgeAwardMode });
  }

  const db = getAdminDb();
  const mode = await getCoachDefaultBadgeAwardMode(db, coachId);
  return NextResponse.json({ defaultBadgeAwardMode: mode });
}

/** PATCH: update coach-level settings. */
export async function PATCH(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const mode = body.defaultBadgeAwardMode;
  if (mode !== "auto" && mode !== "coach") {
    return NextResponse.json({ error: "Invalid defaultBadgeAwardMode" }, { status: 400 });
  }

  const db = getAdminDb();
  await db.collection("coaches").doc(coachId).set(
    { defaultBadgeAwardMode: mode, updatedAt: new Date() },
    { merge: true }
  );

  return NextResponse.json({ ok: true, defaultBadgeAwardMode: mode });
}
