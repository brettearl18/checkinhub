import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

/**
 * POST /api/coach/clients/[clientId]/resend-onboarding
 * Resend the onboarding invite email for a client who hasn't completed setup (status pending).
 * Generates a new token and 7-day expiry.
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
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
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
  if (data.status === "active" && data.authUid) {
    return NextResponse.json(
      { error: "This client has already completed onboarding." },
      { status: 400 }
    );
  }

  const email = (data.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Client has no email." },
      { status: 400 }
    );
  }

  const now = new Date();
  const onboardingToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await clientSnap.ref.update({
    onboardingToken,
    tokenExpiry: Timestamp.fromDate(tokenExpiry),
    updatedAt: Timestamp.fromDate(now),
  });

  let baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!baseUrl && typeof request.url === "string") {
    try {
      baseUrl = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }
  baseUrl = baseUrl.replace(/\/$/, "");

  const invitePath = `/client-onboarding?token=${encodeURIComponent(onboardingToken)}&email=${encodeURIComponent(email)}`;
  const inviteLink = baseUrl ? `${baseUrl}${invitePath}` : invitePath;

  const coachSnap = await db.collection("users").doc(coachId).get();
  const coachData = coachSnap.exists ? (coachSnap.data() as { firstName?: string; lastName?: string }) : null;
  const coachName = coachData
    ? [coachData.firstName, coachData.lastName].filter(Boolean).join(" ").trim() || "Your coach"
    : "Your coach";
  const firstName = data.firstName ?? "";

  await sendEmail({
    to: email,
    subject: "Complete your CheckinHUB onboarding",
    html: `
      <p>Hi ${firstName || "there"},</p>
      <p>${coachName} has invited you to join CheckinHUB. Click the link below to set your password and get started (link expires in 7 days):</p>
      <p><a href="${inviteLink}" style="display:inline-block;background:#c9a227;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Complete onboarding</a></p>
      <p><a href="${inviteLink}">${inviteLink}</a></p>
      <p>Best,<br>CheckinHUB</p>
    `.trim(),
    text: `Hi ${firstName || "there"},\n\n${coachName} has invited you to join CheckinHUB. Complete your onboarding (link expires in 7 days):\n\n${inviteLink}\n\nBest,\nCheckinHUB`,
  });

  return NextResponse.json({
    ok: true,
    inviteLink,
    tokenExpiresAt: tokenExpiry.toISOString(),
  });
}
