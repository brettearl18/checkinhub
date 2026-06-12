import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import type admin from "firebase-admin";
import { requireCoach } from "@/lib/api-auth";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";

const MIN_PASSWORD_LENGTH = 8;

async function resolveClientAuthUid(
  clientId: string,
  data: { authUid?: string | null; email?: string },
  db: Firestore,
  auth: admin.auth.Auth
): Promise<string | null> {
  if (typeof data.authUid === "string" && data.authUid.trim()) {
    return data.authUid.trim();
  }

  try {
    await auth.getUser(clientId);
    return clientId;
  } catch {
    // Client doc id may differ from Firebase Auth uid
  }

  const email = (data.email ?? "").trim().toLowerCase();
  if (!email) return null;

  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch {
    // No Firebase Auth user for this email
  }

  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!usersSnap.empty) return usersSnap.docs[0].id;

  return null;
}

/** POST: coach sets a new password for an active client's login. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const clientRef = db.collection("clients").doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const data = clientSnap.data() as {
    coachId?: string;
    status?: string;
    authUid?: string | null;
    email?: string;
  };
  if (data.coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (data.status === "pending") {
    return NextResponse.json(
      {
        error:
          "This client has not finished onboarding yet. Resend the invite email so they can set their password, or set status to Active after they have an account.",
      },
      { status: 400 }
    );
  }

  const authUid = await resolveClientAuthUid(clientId, data, db, auth);
  if (!authUid) {
    return NextResponse.json(
      {
        error:
          "No login account found for this client. They may need to complete onboarding first.",
      },
      { status: 400 }
    );
  }

  try {
    await auth.updateUser(authUid, { password });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!data.authUid) {
    await clientRef.update({
      authUid,
      updatedAt: new Date(),
    });
  }

  return NextResponse.json({ ok: true });
}
