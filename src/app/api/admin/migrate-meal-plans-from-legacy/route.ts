import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function requireSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7) === secret;
  return request.headers.get("x-cron-secret") === secret;
}

/**
 * POST /api/admin/migrate-meal-plans-from-legacy
 *
 * One-time migration: for every client that has mealPlanName + mealPlanUrl but
 * no (or empty) mealPlanLinks, set mealPlanLinks = [{ label: mealPlanName, url: mealPlanUrl }].
 * So legacy data from the old project shows in the new UI and is stored in the new shape.
 *
 * Auth: CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
 */
export async function POST(request: Request) {
  if (!requireSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const db = getAdminDb();
  const snap = await db.collection("clients").get();

  let updated = 0;
  const errors: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as {
      mealPlanName?: string;
      mealPlanUrl?: string;
      mealPlanLinks?: unknown;
    };
    const name = data.mealPlanName?.trim();
    const url = data.mealPlanUrl?.trim();
    const links = Array.isArray(data.mealPlanLinks) ? data.mealPlanLinks : [];

    if (!name || !url || links.length > 0) continue;

    try {
      await doc.ref.update({
        mealPlanLinks: [{ label: name, url }],
        updatedAt: new Date(),
      });
      updated++;
    } catch (e) {
      errors.push(`${doc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    totalClients: snap.size,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}
