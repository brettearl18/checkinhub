/** Vana / CheckinHUB branded wrapper for client-facing emails. */

export const VANA_EMAIL_GOLD = "#daa450";
export const DEFAULT_CLIENT_EMAIL_COACH_NAME = "Coach Silvi";

export function resolveClientEmailCoachName(
  coach?: { firstName?: string; lastName?: string } | null
): string {
  const fromEnv = process.env.CLIENT_EMAIL_COACH_NAME?.trim();
  if (fromEnv) return fromEnv;
  if (coach?.firstName?.trim()) {
    return `Coach ${coach.firstName.trim()}`;
  }
  return DEFAULT_CLIENT_EMAIL_COACH_NAME;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailButton(href: string, label: string, variant: "primary" | "secondary" = "primary"): string {
  const bg = variant === "primary" ? VANA_EMAIL_GOLD : "#78716c";
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:system-ui,-apple-system,sans-serif;">${escapeHtml(label)}</a>`;
}

export function emailInfoBox(html: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="background:#faf7f2;border:1px solid #e7e5e4;border-radius:10px;padding:16px 18px;color:#44403c;font-size:14px;line-height:1.55;font-family:system-ui,-apple-system,sans-serif;">
          ${html}
        </td>
      </tr>
    </table>
  `.trim();
}

export function wrapClientEmail(options: {
  preheader?: string;
  bodyHtml: string;
  coachName: string;
}): string {
  const { preheader, bodyHtml, coachName } = options;
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vana Health</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate;border-spacing:0;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(44,40,37,0.08);">
          <tr>
            <td style="background:${VANA_EMAIL_GOLD};padding:22px 28px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.92);font-family:system-ui,-apple-system,sans-serif;">Vana Health</p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">CheckinHUB</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;color:#2c2825;font-size:15px;line-height:1.65;font-family:system-ui,-apple-system,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:system-ui,-apple-system,sans-serif;">
              <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e7e5e4;color:#57534e;font-size:15px;line-height:1.5;">
                With care,<br />
                <strong style="color:#2c2825;font-size:16px;">${escapeHtml(coachName)}</strong><br />
                <span style="font-size:13px;color:#78716c;">Vana Health</span>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#a8a29e;font-family:system-ui,-apple-system,sans-serif;">
          Vana Health · Perth, Australia
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
