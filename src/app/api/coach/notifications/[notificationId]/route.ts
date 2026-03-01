import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

// PATCH: mark notification as read.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { notificationId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const ref = db.collection("notifications").doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((snap.data() as { userId?: string }).userId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ref.update({ isRead: true, updatedAt: new Date() });
  return NextResponse.json({ ok: true });
}
