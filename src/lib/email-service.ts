/**
 * Email sending via Mailgun REST API.
 * Set MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL, MAILGUN_FROM_NAME.
 * Optional: MAILGUN_TEST_EMAIL — all emails go here and subject is prefixed with [TEST].
 */

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.MAILGUN_API_KEY &&
      process.env.MAILGUN_DOMAIN &&
      process.env.MAILGUN_FROM_EMAIL &&
      process.env.MAILGUN_FROM_NAME
  );
}

/**
 * Send an email. No-op if Mailgun is not configured.
 * If MAILGUN_TEST_EMAIL is set, all emails go to that address and subject is prefixed with [TEST].
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const { to, subject, html, text, replyTo } = options;
  const testEmail = process.env.MAILGUN_TEST_EMAIL?.trim();
  const actualTo = Array.isArray(to) ? to : [to];
  const toList = testEmail ? [testEmail] : actualTo;
  const finalSubject = testEmail ? `[TEST] ${subject}` : subject;

  const from = `${process.env.MAILGUN_FROM_NAME} <${process.env.MAILGUN_FROM_EMAIL}>`;
  const domain = process.env.MAILGUN_DOMAIN!;
  const apiKey = process.env.MAILGUN_API_KEY!;

  const form = new FormData();
  form.append("from", from);
  form.append("to", toList.join(", "));
  form.append("subject", finalSubject);
  form.append("html", html);
  if (text) form.append("text", text);
  if (replyTo) form.append("h:Reply-To", replyTo);

  const url = `https://api.mailgun.net/v3/${domain}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form as unknown as BodyInit,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email-service] Mailgun error:", res.status, body);
    return { ok: false, error: body || res.statusText };
  }
  return { ok: true };
}

export { isConfigured as isEmailConfigured };
