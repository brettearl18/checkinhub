import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { SCORING_PROFILES, DEFAULT_PROFILE } from "@/lib/scoring-utils";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

const MIN_PASSWORD_LENGTH = 8;

/** GET: list clients for this coach. */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "mock-client-1", firstName: "Test", lastName: "Client", email: "client@example.com" },
    ]);
  }

  const db = getAdminDb();
  const snap = await db.collection("clients").where("coachId", "==", coachId).get();
  const clients = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      email: data.email ?? "",
      status: data.status ?? "",
    };
  });
  return NextResponse.json(clients);
}

/** Check if email is already used by a client or Auth user. */
async function checkEmailAvailable(
  db: ReturnType<typeof getAdminDb>,
  auth: ReturnType<typeof getAdminAuth>,
  email: string
): Promise<{ available: boolean; existingClient?: { id: string; status: string }; message?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { available: false, message: "Email is required." };

  const clientsSnap = await db.collection("clients").where("email", "==", normalized).limit(1).get();
  if (!clientsSnap.empty) {
    const doc = clientsSnap.docs[0];
    const data = doc.data() as { status?: string };
    const status = data?.status ?? "active";
    return {
      available: false,
      existingClient: { id: doc.id, status },
      message: status === "pending" ? "An invitation has already been sent to this email. Ask them to use the link, or wait for it to expire." : "A client with this email already exists.",
    };
  }

  try {
    const authUser = await auth.getUserByEmail(normalized);
    if (authUser) {
      return { available: false, message: "An account with this email already exists. They can sign in." };
    }
  } catch {
    // getUserByEmail throws when not found in Firebase Auth - that's what we want
  }
  return { available: true };
}

/** POST: coach creates a new client (with or without password). */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: { firstName?: string; lastName?: string; email?: string; phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required." },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (password !== undefined && password !== "" && password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const hasPassword = Boolean(password && password.length >= MIN_PASSWORD_LENGTH);

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured for creating clients." },
      { status: 503 }
    );
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const emailCheck = await checkEmailAvailable(db, auth, email);
  if (!emailCheck.available) {
    return NextResponse.json(
      { error: emailCheck.message ?? "This email is already in use." },
      { status: 409 }
    );
  }

  const now = new Date();
  const ts = Timestamp.fromDate(now);
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || email;

  try {
    if (hasPassword) {
      const userRecord = await auth.createUser({
        email: email.trim().toLowerCase(),
        password: password!,
        displayName,
      });
      const uid = userRecord.uid;
      await auth.setCustomUserClaims(uid, { role: "client", coachId });

      await db.collection("users").doc(uid).set(
        {
          uid,
          email: email.trim().toLowerCase(),
          role: "client",
          profile: { firstName, lastName },
          metadata: { invitedBy: coachId },
          updatedAt: ts,
        },
        { merge: true }
      );

      const clientData: Record<string, unknown> = {
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        coachId,
        status: "active",
        authUid: uid,
        phone: phone || null,
        timezone: "",
        createdAt: ts,
        updatedAt: ts,
        canStartCheckIns: true,
        onboardingStatus: "completed",
      };
      await db.collection("clients").doc(uid).set(clientData);

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
        updatedAt: ts,
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      const loginUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/sign-in` : "/sign-in";
      const coachSnap = await db.collection("users").doc(coachId).get();
      const coachData = coachSnap.exists ? (coachSnap.data() as { firstName?: string; lastName?: string }) : null;
      const coachName = coachData
        ? [coachData.firstName, coachData.lastName].filter(Boolean).join(" ").trim() || "Your coach"
        : "Your coach";
      await sendEmail({
        to: email.trim().toLowerCase(),
        subject: "Your CheckinHUB login details",
        html: `
          <p>Hi ${firstName},</p>
          <p>${coachName} has set up your CheckinHUB account. Here are your login details:</p>
          <ul>
            <li><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
            <li><strong>Email:</strong> ${email.trim().toLowerCase()}</li>
            <li><strong>Password:</strong> (the password your coach shared with you)</li>
          </ul>
          <p>Use the link above to sign in and complete your check-ins.</p>
          <p>Best,<br>CheckinHUB</p>
        `.trim(),
        text: `Hi ${firstName},\n\n${coachName} has set up your CheckinHUB account.\n\nLogin URL: ${loginUrl}\nEmail: ${email.trim().toLowerCase()}\nPassword: (the password your coach shared with you)\n\nBest,\nCheckinHUB`,
      });

      return NextResponse.json({ clientId: uid, createdWithPassword: true });
    } else {
      const clientId = `client-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const onboardingToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.collection("clients").doc(clientId).set({
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        coachId,
        status: "pending",
        authUid: null,
        phone: phone || null,
        timezone: "",
        onboardingToken,
        tokenExpiry: Timestamp.fromDate(tokenExpiry),
        createdAt: ts,
        updatedAt: ts,
        canStartCheckIns: false,
        onboardingStatus: "not_started",
      });

      await db.collection("clientScoring").doc(clientId).set({
        clientId,
        thresholds: {
          red: [0, SCORING_PROFILES[DEFAULT_PROFILE].redMax],
          orange: [SCORING_PROFILES[DEFAULT_PROFILE].redMax + 1, SCORING_PROFILES[DEFAULT_PROFILE].orangeMax],
          green: [SCORING_PROFILES[DEFAULT_PROFILE].orangeMax + 1, 100],
          redMax: SCORING_PROFILES[DEFAULT_PROFILE].redMax,
          orangeMax: SCORING_PROFILES[DEFAULT_PROFILE].orangeMax,
        },
        scoringProfile: DEFAULT_PROFILE,
        updatedAt: ts,
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      const invitePath = `/client-onboarding?token=${encodeURIComponent(onboardingToken)}&email=${encodeURIComponent(email.trim().toLowerCase())}`;
      const inviteLink = baseUrl ? `${baseUrl.replace(/\/$/, "")}${invitePath}` : invitePath;

      const coachSnap = await db.collection("users").doc(coachId).get();
      const coachData = coachSnap.exists ? (coachSnap.data() as { firstName?: string; lastName?: string }) : null;
      const coachName = coachData
        ? [coachData.firstName, coachData.lastName].filter(Boolean).join(" ").trim() || "Your coach"
        : "Your coach";
      await sendEmail({
        to: email.trim().toLowerCase(),
        subject: "Complete your CheckinHUB onboarding",
        html: `
          <p>Hi ${firstName},</p>
          <p>${coachName} has invited you to join CheckinHUB. Click the link below to set your password and get started (link expires in 7 days):</p>
          <p><a href="${inviteLink}" style="display:inline-block;background:#c9a227;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Complete onboarding</a></p>
          <p><a href="${inviteLink}">${inviteLink}</a></p>
          <p>Best,<br>CheckinHUB</p>
        `.trim(),
        text: `Hi ${firstName},\n\n${coachName} has invited you to join CheckinHUB. Complete your onboarding (link expires in 7 days):\n\n${inviteLink}\n\nBest,\nCheckinHUB`,
      });

      return NextResponse.json({
        clientId,
        createdWithPassword: false,
        inviteLink,
        invitePath: baseUrl ? undefined : invitePath,
        tokenExpiresAt: tokenExpiry.toISOString(),
      });
    }
  } catch (err) {
    console.error("[coach/clients] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create client" },
      { status: 500 }
    );
  }
}
