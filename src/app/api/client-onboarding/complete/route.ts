import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const MIN_PASSWORD_LENGTH = 8;

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

/** POST: complete token onboarding – set password, create Auth user, activate client. */
export async function POST(request: Request) {
  let body: { token?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || !email || !password) {
    return NextResponse.json({ error: "Token, email, and password are required." }, { status: 400 });
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
  const clientsSnap = await db
    .collection("clients")
    .where("onboardingToken", "==", token)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (clientsSnap.empty) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const docRef = clientsSnap.docs[0].ref;
  const docSnap = await docRef.get();
  const data = docSnap.data()! as {
    status?: string;
    tokenExpiry?: unknown;
    coachId?: string;
    firstName?: string;
    lastName?: string;
  };

  if (data.status === "active") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 400 });
  }

  const expiry = toDate(data.tokenExpiry);
  if (expiry && expiry.getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 400 });
  }

  const coachId = data.coachId ?? null;
  const firstName = data.firstName ?? "";
  const lastName = data.lastName ?? "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || email;
  const clientId = docSnap.id;

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });
    const uid = userRecord.uid;
    await auth.setCustomUserClaims(uid, { role: "client", coachId: coachId ?? undefined });

    await db.collection("users").doc(uid).set(
      {
        uid,
        email,
        role: "client",
        profile: { firstName, lastName },
        metadata: { invitedBy: coachId },
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    await docRef.update({
      status: "active",
      authUid: uid,
      onboardingToken: null,
      tokenExpiry: null,
      onboardingStatus: "completed",
      canStartCheckIns: true,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, clientId });
  } catch (err) {
    console.error("[client-onboarding/complete]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete setup" },
      { status: 500 }
    );
  }
}
