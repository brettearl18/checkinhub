import { sendEmail } from "@/lib/email-service";

export const CLIENT_ACCOUNT_CLOSED_CC_EMAIL = "info@vanahealth.com.au";

function deleteDataEmailBlock(deletionLink: string): { html: string; text: string } {
  const html = `
    <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e7e5e4;">
      <strong>Delete your data now</strong><br>
      You are in control. You can permanently delete your account data at any time — no need to contact us.
    </p>
    <p>
      <a href="${deletionLink}" style="display:inline-block;background:#78716c;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Delete my data</a>
    </p>
    <p style="font-size:13px;color:#57534e;">Deletion is permanent and cannot be undone. You&apos;ll sign in and confirm your last name to complete it.</p>
  `.trim();
  const text = `

Delete your data now
You can permanently delete your account data at any time: ${deletionLink}
Deletion is permanent and cannot be undone. You'll sign in and confirm your last name to complete it.`;
  return { html, text };
}

export function buildClientAccountClosedEmail(
  firstName: string,
  retentionUntilDisplay: string,
  deletionLink?: string
): { subject: string; html: string; text: string } {
  const greeting = firstName.trim() || "there";
  const subject = "Your Vana Health account has been closed";
  const deleteBlock = deletionLink ? deleteDataEmailBlock(deletionLink) : { html: "", text: "" };
  const html = `
    <p>Hi ${greeting},</p>
    <p>Your Vana Health / CheckinHUB account has been <strong>closed</strong>. You no longer have access to the platform.</p>
    <p>We keep a copy of your check-ins, progress, and related data until <strong>${retentionUntilDisplay}</strong> (12 months) so we can reactivate your account if you return. After that date, your data is permanently deleted.</p>
    <p>If you would like to come back before then, contact us at <a href="mailto:${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}">${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}</a> and we can help reactivate your account.</p>
    ${deleteBlock.html}
    <p>Questions? Reply to this email or contact <a href="mailto:${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}">${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}</a>.</p>
    <p>Best wishes,<br>Vana Health</p>
  `.trim();
  const text = `Hi ${greeting},

Your Vana Health / CheckinHUB account has been closed. You no longer have access to the platform.

We keep a copy of your check-ins, progress, and related data until ${retentionUntilDisplay} (12 months) so we can reactivate your account if you return. After that date, your data is permanently deleted.

If you would like to come back before then, contact us at ${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}.${deleteBlock.text}

Questions? Contact ${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}.

Best wishes,
Vana Health`;
  return { subject, html, text };
}

export async function sendClientAccountClosedEmail(
  to: string,
  firstName: string,
  retentionUntilDisplay: string,
  deletionLink?: string
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildClientAccountClosedEmail(
    firstName,
    retentionUntilDisplay,
    deletionLink
  );
  const cc =
    process.env.CLIENT_ACCOUNT_CLOSED_CC_EMAIL?.trim() || CLIENT_ACCOUNT_CLOSED_CC_EMAIL;
  return sendEmail({ to, subject, html, text, cc });
}

export function buildClientDataDeletionWarningEmail(
  firstName: string,
  deletionDateDisplay: string,
  deletionLink?: string
): { subject: string; html: string; text: string } {
  const greeting = firstName.trim() || "there";
  const subject = "Your Vana Health data will be deleted in 30 days";
  const deleteBlock = deletionLink ? deleteDataEmailBlock(deletionLink) : { html: "", text: "" };
  const html = `
    <p>Hi ${greeting},</p>
    <p>Your Vana Health / CheckinHUB account was closed earlier. As we explained when your account closed, we have kept your check-in history, progress, and related data on file for reactivation.</p>
    <p>That retention period ends in <strong>30 days</strong> (around <strong>${deletionDateDisplay}</strong>). After that date, your data will be <strong>permanently deleted</strong> and cannot be recovered.</p>
    <p>To return before then, contact us at <a href="mailto:${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}">${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}</a> and we can help reactivate your account.</p>
    ${deleteBlock.html}
    <p>Best wishes,<br>Vana Health</p>
  `.trim();
  const text = `Hi ${greeting},

Your Vana Health / CheckinHUB account was closed earlier. We have kept your data on file for reactivation as explained when your account closed.

That retention period ends in 30 days (around ${deletionDateDisplay}). After that date, your data will be permanently deleted and cannot be recovered.

To return before then, contact us at ${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}.${deleteBlock.text}

Best wishes,
Vana Health`;
  return { subject, html, text };
}

export async function sendClientDataDeletionWarningEmail(
  to: string,
  firstName: string,
  deletionDateDisplay: string,
  deletionLink?: string
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildClientDataDeletionWarningEmail(
    firstName,
    deletionDateDisplay,
    deletionLink
  );
  const cc =
    process.env.CLIENT_ACCOUNT_CLOSED_CC_EMAIL?.trim() || CLIENT_ACCOUNT_CLOSED_CC_EMAIL;
  return sendEmail({ to, subject, html, text, cc });
}
