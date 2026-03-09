import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email-service";
import { buildReminderEmailContent } from "@/lib/check-in-reminders-cron";

/**
 * POST /api/coach/test-email
 * Body: { to: string, template?: "default" | "reminder-open" | "reminder-closing" }
 * Sends a test email. Coach-only. Use template to send the same content as reminder cron emails.
 */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

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

  const template = body.template === "reminder-open" || body.template === "reminder-closing" ? body.template : "default";

  let subject: string;
  let html: string;
  let text: string;

  if (template === "default") {
    subject = "CheckinHUB test email";
    html = `
      <p>This is a test email from CheckinHUB.</p>
      <p>If you received this, email (Mailgun) is configured correctly.</p>
      <p>Best,<br>CheckinHUB</p>
    `.trim();
    text = "This is a test email from CheckinHUB. If you received this, email (Mailgun) is configured correctly.\n\nBest,\nCheckinHUB";
  } else {
    const reminderType = template === "reminder-open" ? "open" : "closing";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const content = buildReminderEmailContent(reminderType, "there", appUrl || "https://example.com");
    subject = `[Test] ${content.subject}`;
    html = content.html;
    text = content.text;
  }

  const result = await sendEmail({ to, subject, html, text });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send test email" },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, message: "Test email sent" });
}
