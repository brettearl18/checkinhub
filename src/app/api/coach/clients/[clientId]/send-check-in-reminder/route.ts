import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { buildManualReminderEmailContent } from "@/lib/check-in-reminders-cron";

/**
 * POST /api/coach/clients/[clientId]/send-check-in-reminder
 * Coach-only. Sends a one-off "complete your check-in" email to this client (e.g. when they're late).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const data = clientSnap.data() as { coachId?: string; email?: string; firstName?: string };
  if (authResult.identity.coachId && data.coachId !== authResult.identity.coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (!email) {
    return NextResponse.json(
      { error: "This client has no email address. Add one in Profile and save, then try again." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const firstName = (data.firstName && typeof data.firstName === "string" ? data.firstName.trim() : "") || "there";
  // Use coach's first name from users doc if available, otherwise "Coach Silvi"
  let coachName = "Coach Silvi";
  const coachSnap = await db.collection("users").doc(authResult.identity.coachId!).get();
  const coachFirstName = (coachSnap.data() as { firstName?: string } | undefined)?.firstName?.trim();
  if (coachFirstName) coachName = `Coach ${coachFirstName.charAt(0).toUpperCase() + coachFirstName.slice(1).toLowerCase()}`;
  const { subject, html, text } = buildManualReminderEmailContent(firstName, appUrl || "https://example.com", coachName);

  const result = await sendEmail({ to: email, subject, html, text });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "Reminder email sent" });
}
