import type { Firestore } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/email-service";
import {
  DEFAULT_CLIENT_EMAIL_COACH_NAME,
  emailButton,
  emailInfoBox,
  resolveClientEmailCoachName,
  wrapClientEmail,
} from "@/lib/client-email-layout";

export const CLIENT_ACCOUNT_CLOSED_CC_EMAIL = "info@vanahealth.com.au";

export interface CoachEmailContext {
  coachName: string;
  replyTo?: string;
}

export async function resolveCoachEmailContext(
  db: Firestore,
  coachId?: string
): Promise<CoachEmailContext> {
  if (coachId) {
    const snap = await db.collection("users").doc(coachId).get();
    if (snap.exists) {
      const data = snap.data() as { firstName?: string; lastName?: string; email?: string };
      const replyTo = typeof data.email === "string" ? data.email.trim() : undefined;
      return {
        coachName: resolveClientEmailCoachName(data),
        replyTo: replyTo || undefined,
      };
    }
  }
  const replyTo = process.env.CLIENT_EMAIL_REPLY_TO?.trim();
  return {
    coachName: resolveClientEmailCoachName(null),
    replyTo: replyTo || CLIENT_ACCOUNT_CLOSED_CC_EMAIL,
  };
}

function deleteDataEmailBlock(deletionLink: string): { html: string; text: string } {
  const html = `
    ${emailInfoBox(`
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#2c2825;">Delete your data now</p>
      <p style="margin:0 0 16px;">You are in control. You can permanently delete your account data at any time — no need to contact us.</p>
      <p style="margin:0 0 12px;">${emailButton(deletionLink, "Delete my data", "secondary")}</p>
      <p style="margin:0;font-size:13px;color:#78716c;">Deletion is permanent and cannot be undone. You&apos;ll sign in and confirm your last name to complete it.</p>
    `)}
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
  deletionLink: string | undefined,
  coach: CoachEmailContext
): { subject: string; html: string; text: string } {
  const greeting = firstName.trim() || "there";
  const coachName = coach.coachName || DEFAULT_CLIENT_EMAIL_COACH_NAME;
  const subject = "Your CheckinHUB account has been closed";
  const deleteBlock = deletionLink ? deleteDataEmailBlock(deletionLink) : { html: "", text: "" };

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#2c2825;">Hi ${greeting},</p>
    <p style="margin:0 0 16px;">Your CheckinHUB account has been <strong>closed</strong>. You no longer have access to coaching features in the portal.</p>
    ${emailInfoBox(`
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#78716c;">Your data</p>
      <p style="margin:0;">We keep a copy of your check-ins, progress, and related data until <strong style="color:#2c2825;">${retentionUntilDisplay}</strong> (12 months) so we can reactivate your account if you return. After that date, your data is permanently deleted.</p>
    `)}
    <p style="margin:0 0 16px;">If you would like to come back before then, just reply to this email or contact us at <a href="mailto:${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}" style="color:#b8862e;text-decoration:none;font-weight:600;">${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}</a> and we can help reactivate your account.</p>
    ${deleteBlock.html}
    <p style="margin:0;font-size:14px;color:#57534e;">Questions? Reply to this email — I&apos;m happy to help.</p>
  `.trim();

  const html = wrapClientEmail({
    preheader: `Your account is closed. Data kept until ${retentionUntilDisplay}.`,
    bodyHtml,
    coachName,
  });

  const text = `Hi ${greeting},

Your CheckinHUB account has been closed. You no longer have access to coaching features in the portal.

Your data
We keep a copy of your check-ins, progress, and related data until ${retentionUntilDisplay} (12 months) so we can reactivate your account if you return. After that date, your data is permanently deleted.

If you would like to come back before then, contact us at ${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}.${deleteBlock.text}

Questions? Reply to this email.

With care,
${coachName}
Vana Health`;

  return { subject, html, text };
}

export async function sendClientAccountClosedEmail(
  to: string,
  firstName: string,
  retentionUntilDisplay: string,
  deletionLink: string | undefined,
  coach: CoachEmailContext
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildClientAccountClosedEmail(
    firstName,
    retentionUntilDisplay,
    deletionLink,
    coach
  );
  const cc =
    process.env.CLIENT_ACCOUNT_CLOSED_CC_EMAIL?.trim() || CLIENT_ACCOUNT_CLOSED_CC_EMAIL;
  return sendEmail({
    to,
    subject,
    html,
    text,
    cc,
    fromName: coach.coachName,
    replyTo: coach.replyTo || CLIENT_ACCOUNT_CLOSED_CC_EMAIL,
  });
}

export function buildClientDataDeletionWarningEmail(
  firstName: string,
  deletionDateDisplay: string,
  deletionLink: string | undefined,
  coach: CoachEmailContext
): { subject: string; html: string; text: string } {
  const greeting = firstName.trim() || "there";
  const coachName = coach.coachName || DEFAULT_CLIENT_EMAIL_COACH_NAME;
  const subject = "Your CheckinHUB data will be deleted in 30 days";
  const deleteBlock = deletionLink ? deleteDataEmailBlock(deletionLink) : { html: "", text: "" };

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#2c2825;">Hi ${greeting},</p>
    <p style="margin:0 0 16px;">Your CheckinHUB account was closed earlier. As we explained when your account closed, I have kept your check-in history, progress, and related data on file in case you wanted to return.</p>
    ${emailInfoBox(`
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#78716c;">Deletion reminder</p>
      <p style="margin:0;">That retention period ends in <strong style="color:#2c2825;">30 days</strong> (around <strong style="color:#2c2825;">${deletionDateDisplay}</strong>). After that date, your data will be <strong>permanently deleted</strong> and cannot be recovered.</p>
    `)}
    <p style="margin:0 0 16px;">To return before then, reply to this email or contact us at <a href="mailto:${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}" style="color:#b8862e;text-decoration:none;font-weight:600;">${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}</a> and we can help reactivate your account.</p>
    ${deleteBlock.html}
  `.trim();

  const html = wrapClientEmail({
    preheader: `Your data will be permanently deleted around ${deletionDateDisplay}.`,
    bodyHtml,
    coachName,
  });

  const text = `Hi ${greeting},

Your CheckinHUB account was closed earlier. I have kept your data on file in case you wanted to return.

Deletion reminder
That retention period ends in 30 days (around ${deletionDateDisplay}). After that date, your data will be permanently deleted and cannot be recovered.

To return before then, contact us at ${CLIENT_ACCOUNT_CLOSED_CC_EMAIL}.${deleteBlock.text}

With care,
${coachName}
Vana Health`;

  return { subject, html, text };
}

export async function sendClientDataDeletionWarningEmail(
  to: string,
  firstName: string,
  deletionDateDisplay: string,
  deletionLink: string | undefined,
  coach: CoachEmailContext
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = buildClientDataDeletionWarningEmail(
    firstName,
    deletionDateDisplay,
    deletionLink,
    coach
  );
  const cc =
    process.env.CLIENT_ACCOUNT_CLOSED_CC_EMAIL?.trim() || CLIENT_ACCOUNT_CLOSED_CC_EMAIL;
  return sendEmail({
    to,
    subject,
    html,
    text,
    cc,
    fromName: coach.coachName,
    replyTo: coach.replyTo || CLIENT_ACCOUNT_CLOSED_CC_EMAIL,
  });
}
