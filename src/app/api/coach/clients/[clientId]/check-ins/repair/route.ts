import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

/**
 * POST .../check-ins/repair
 * If the client doc is missing authUid but we can find a Firebase user by the client's email,
 * set authUid on the client doc so the check-ins GET merges assignments stored under that UID.
 * This fixes the case where the client completed check-ins (stored under her uid) but the coach
 * profile only queried by client doc id and showed none.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Not available without Firebase" }, { status: 503 });
  }

  const db = getAdminDb();
  const clientRef = db.collection("clients").doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const clientData = clientSnap.data() as { coachId?: string; authUid?: string; email?: string };
  if (clientData.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (clientData.authUid) {
    return NextResponse.json({
      ok: true,
      message: "Client already has authUid set. No change needed.",
      authUid: clientData.authUid,
    });
  }

  const email = (clientData.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({
      error: "Client has no email. Add their email in Settings, then run repair again.",
    }, { status: 400 });
  }

  let uid: string | null = null;
  try {
    const authUser = await getAdminAuth().getUserByEmail(email);
    uid = authUser?.uid ?? null;
  } catch {
    // User not in Firebase Auth
  }

  if (!uid) {
    const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!usersSnap.empty) uid = usersSnap.docs[0].id;
  }

  if (!uid) {
    return NextResponse.json({
      error: "No Firebase Auth or users record found for this email. The client may not have signed up yet.",
    }, { status: 400 });
  }

  await clientRef.update({
    authUid: uid,
    updatedAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    message: "Set authUid on client doc. Check-ins stored under this UID will now appear on the client profile. Ask the coach to refresh the Check-ins page.",
    authUid: uid,
  });
}
