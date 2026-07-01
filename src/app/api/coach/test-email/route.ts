import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-service";
import { buildReminderEmailContent } from "@/lib/check-in-reminders-cron";
import {
  buildClientAccountClosedEmail,
  buildClientAccountReactivatedEmail,
  buildClientDataDeletionWarningEmail,
  resolveCoachEmailContext,
  type CoachEmailContext,
} from "@/lib/client-cancelled-email";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { formatDateDisplay } from "@/lib/format-date";

const TEMPLATES = [
  "default",
  "reminder-open",
  "reminder-closing",
  "account-closed",
  "account-reactivated",
  "deletion-warning",
] as const;

type TestTemplate = (typeof TEMPLATES)[number];

function isTestTemplate(value: string): value is TestTemplate {
  return (TEMPLATES as readonly string[]).includes(value);
}

/**
 * POST /api/coach/test-email
 * Body: { to: string, template?: TestTemplate }
 * Sends a test email. Coach-only.
 */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: { to?: string; template?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to) {
    return NextResponse.json({ error: "Email address (to) is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  const template: TestTemplate =
    body.template && isTestTemplate(body.template) ? body.template : "default";

  const appUrl = resolveAppBaseUrl(request.url);
  const loginUrl = `${appUrl.replace(/\/$/, "")}/sign-in`;
  const deletionLink = `${appUrl.replace(/\/$/, "")}/delete-my-data?token=preview&email=${encodeURIComponent(to)}`;

  let coach: CoachEmailContext = { coachName: "Coach Silvi", replyTo: "info@vanahealth.com.au" };
  if (isAdminConfigured()) {
    coach = await resolveCoachEmailContext(getAdminDb(), coachId);
  }

  let subject: string;
  let html: string;
  let text: string;
  let fromName: string | undefined;

  if (template === "default") {
    subject = "CheckinHUB test email";
    html = `
      <p>This is a test email from CheckinHUB.</p>
      <p>If you received this, email (Mailgun) is configured correctly.</p>
      <p>Best,<br>CheckinHUB</p>
    `.trim();
    text =
      "This is a test email from CheckinHUB. If you received this, email (Mailgun) is configured correctly.\n\nBest,\nCheckinHUB";
  } else if (template === "reminder-open" || template === "reminder-closing") {
    const reminderType = template === "reminder-open" ? "open" : "closing";
    const content = buildReminderEmailContent(reminderType, "there", appUrl || "https://example.com");
    subject = `[Test] ${content.subject}`;
    html = content.html;
    text = content.text;
  } else if (template === "account-closed") {
    const retentionUntil = formatDateDisplay(
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
        timeZone: "Australia/Perth",
      })
    );
    const content = buildClientAccountClosedEmail("there", retentionUntil, deletionLink, coach);
    subject = `[Test] ${content.subject}`;
    html = content.html;
    text = content.text;
    fromName = coach.coachName;
  } else if (template === "account-reactivated") {
    const content = buildClientAccountReactivatedEmail("there", loginUrl, coach);
    subject = `[Test] ${content.subject}`;
    html = content.html;
    text = content.text;
    fromName = coach.coachName;
  } else {
    const deletionDate = formatDateDisplay(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
        timeZone: "Australia/Perth",
      })
    );
    const content = buildClientDataDeletionWarningEmail("there", deletionDate, deletionLink, coach);
    subject = `[Test] ${content.subject}`;
    html = content.html;
    text = content.text;
    fromName = coach.coachName;
  }

  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    fromName,
    replyTo: coach.replyTo,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send test email" },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, message: "Test email sent", template });
}
