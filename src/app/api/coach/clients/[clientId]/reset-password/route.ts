import { NextResponse } from "next/server";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import type admin from "firebase-admin";
import { requireCoach } from "@/lib/api-auth";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";

const MIN_PASSWORD_LENGTH = 8;

function firebaseErrorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
}

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
    // No Firebase Auth user for this email yet
  }

  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!usersSnap.empty) return usersSnap.docs[0].id;

  const clientsByEmail = await db.collection("clients").where("email", "==", email).limit(5).get();
  for (const doc of clientsByEmail.docs) {
    const linkedUid = doc.data().authUid;
    if (typeof linkedUid === "string" && linkedUid.trim()) {
      return linkedUid.trim();
    }
  }

  return null;
}

async function linkAuthUidToClient(
  clientRef: DocumentReference,
  authUid: string
): Promise<void> {
  await clientRef.update({
    authUid,
    status: "active",
    canStartCheckIns: true,
    onboardingStatus: "completed",
    onboardingToken: null,
    tokenExpiry: null,
    updatedAt: new Date(),
  });
}

/** POST: coach sets a new password for a client's login (creates account if needed). */
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
    firstName?: string;
    lastName?: string;
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

  const email = (data.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Client has no email. Add an email in Profile first." },
      { status: 400 }
    );
  }

  let authUid = await resolveClientAuthUid(clientId, data, db, auth);
  let created = false;

  if (!authUid) {
    const firstName = data.firstName ?? "";
    const lastName = data.lastName ?? "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || email;

    try {
      const userRecord = await auth.createUser({ email, password, displayName });
      authUid = userRecord.uid;
      created = true;

      await auth.setCustomUserClaims(authUid, { role: "client", coachId });

      await db.collection("users").doc(authUid).set(
        {
          uid: authUid,
          email,
          role: "client",
          profile: { firstName, lastName },
          metadata: { invitedBy: coachId },
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (err) {
      if (firebaseErrorCode(err) === "auth/email-already-exists") {
        try {
          const existing = await auth.getUserByEmail(email);
          authUid = existing.uid;
          await auth.updateUser(authUid, { password });
        } catch (linkErr) {
          const message = linkErr instanceof Error ? linkErr.message : "Failed to update password";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      } else {
        const message = err instanceof Error ? err.message : "Failed to create login account";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  } else {
    try {
      await auth.updateUser(authUid, { password });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!data.authUid || data.authUid !== authUid) {
    await linkAuthUidToClient(clientRef, authUid);
  }

  return NextResponse.json({ ok: true, created });
}
