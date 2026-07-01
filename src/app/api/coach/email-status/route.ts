import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { isEmailConfigured } from "@/lib/email-service";

/** GET: whether Mailgun is configured and if test-mode redirect is active. */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const testEmail = process.env.MAILGUN_TEST_EMAIL?.trim() || null;
  return NextResponse.json({
    configured: isEmailConfigured(),
    testMode: Boolean(testEmail),
    testEmail: testEmail ? testEmail.replace(/(.{2}).+(@.+)/, "$1…$2") : null,
    fromName: process.env.MAILGUN_FROM_NAME?.trim() || null,
    coachDisplayName: process.env.CLIENT_EMAIL_COACH_NAME?.trim() || "Coach Silvi",
  });
}
