import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { assignmentBelongsToClient } from "@/lib/client-assignment-ownership";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";
import { updateProgressImageMetadata } from "@/lib/progress-photo-update-server";

/** PATCH: client updates photo angle (imageType) and/or date taken. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;
  const { imageId } = await params;

  let body: { imageType?: string; photoDate?: string; caption?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, id: imageId });
  }

  const db = getAdminDb();
  const snap = await db.collection("progress_images").doc(imageId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const assignClientId = (snap.data()?.clientId as string) ?? "";
  const owns = await assignmentBelongsToClient(db, assignClientId, identity);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await updateProgressImageMetadata(db, imageId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const clientId = identity.clientId!;
  const newlyEarned = await evaluateAndAwardAchievements(db, clientId);

  return NextResponse.json({ ok: true, ...result.photo, newlyEarned });
}
