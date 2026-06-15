import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";
import { updateProgressImageMetadata } from "@/lib/progress-photo-update-server";

async function assertCoachOwnsClient(coachId: string, clientId: string) {
  const db = getAdminDb();
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  if ((snap.data() as { coachId?: string }).coachId !== coachId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

/** PATCH: coach updates a client's photo angle (imageType) and/or date taken. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; imageId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, imageId } = await params;

  let body: { imageType?: string; photoDate?: string; caption?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, id: imageId });
  }

  const access = await assertCoachOwnsClient(coachId, clientId);
  if (access.error) return access.error;

  const db = getAdminDb();
  const snap = await db.collection("progress_images").doc(imageId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if ((snap.data()?.clientId as string) !== clientId) {
    return NextResponse.json({ error: "Photo not found for this client" }, { status: 404 });
  }

  const result = await updateProgressImageMetadata(db, imageId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const newlyEarned = await evaluateAndAwardAchievements(db, clientId);

  return NextResponse.json({ ok: true, ...result.photo, newlyEarned });
}
