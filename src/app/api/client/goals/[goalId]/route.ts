import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { goalId } = await params;

  let body: { currentValue?: number; progress?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const ref = db.collection("clientGoals").doc(goalId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as { clientId?: string }).clientId !== clientId) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const data = snap.data() as {
    targetValue?: number;
    currentValue?: number;
    progress?: number;
  };

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.currentValue !== undefined) update.currentValue = body.currentValue;
  if (body.progress !== undefined) update.progress = body.progress;

  const nextProgress = body.progress ?? data.progress ?? 0;
  const nextCurrent = body.currentValue ?? data.currentValue ?? 0;
  const target = data.targetValue ?? 0;
  if (nextProgress >= 100 || (target > 0 && nextCurrent >= target)) {
    update.status = "completed";
  }

  await ref.update(update);
  const newlyEarned = await evaluateAndAwardAchievements(db, clientId);
  return NextResponse.json({ ok: true, newlyEarned });
}
