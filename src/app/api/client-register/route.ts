import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { DEFAULT_PROFILE, SCORING_PROFILES } from "@/lib/scoring-utils";

const MIN_PASSWORD_LENGTH = 8;
const REGISTRATION_CODE = process.env.CLIENT_REGISTRATION_CODE ?? "VANA1118";

async function emailAvailable(email: string): Promise<boolean> {
  const db = getAdminDb();
  const auth = getAdminAuth();
  const normalized = email.trim().toLowerCase();

  const clientSnap = await db.collection("clients").where("email", "==", normalized).limit(1).get();
  if (!clientSnap.empty) return false;

  try {
    await auth.getUserByEmail(normalized);
    return false;
  } catch {
    return true;
  }
}

/** Public self-registration for new clients using invite code. */
export async function POST(request: Request) {
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

  if (!firstName || !lastName || !email || !password || !inviteCode) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (inviteCode !== REGISTRATION_CODE) {
    return NextResponse.json({ error: "Invalid registration code." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const available = await emailAvailable(email);
  if (!available) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const now = Timestamp.now();
  const displayName = `${firstName} ${lastName}`.trim() || email;

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    const uid = userRecord.uid;
    await auth.setCustomUserClaims(uid, { role: "client" });

    await db.collection("users").doc(uid).set(
      {
        uid,
        email,
        role: "client",
        profile: { firstName, lastName },
        metadata: {
          selfRegistered: true,
          dailyHabitsApproved: true,
          registrationCodeUsed: inviteCode,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    await db.collection("clients").doc(uid).set({
      firstName,
      lastName,
      email,
      status: "active",
      authUid: uid,
      createdAt: now,
      updatedAt: now,
      canStartCheckIns: true,
      onboardingStatus: "completed",
      dailyHabitsApproved: true,
      dailyHabitsApprovedAt: now,
    });

    const profileDef = SCORING_PROFILES[DEFAULT_PROFILE];
    await db.collection("clientScoring").doc(uid).set({
      clientId: uid,
      thresholds: {
        red: [0, profileDef.redMax],
        orange: [profileDef.redMax + 1, profileDef.orangeMax],
        green: [profileDef.orangeMax + 1, 100],
        redMax: profileDef.redMax,
        orangeMax: profileDef.orangeMax,
      },
      scoringProfile: DEFAULT_PROFILE,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    console.error("[client-register] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed." },
      { status: 500 }
    );
  }
}
