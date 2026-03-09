# Emails sent by CheckinHUB

Emails are sent via **Mailgun**. If Mailgun is not configured, no emails are sent (in-app and push notifications still work).

## Environment variables

Set these in production (e.g. Vercel) and in `.env.local` for local testing:

| Variable | Description |
|----------|-------------|
| `MAILGUN_API_KEY` | Mailgun API key (private) |
| `MAILGUN_DOMAIN` | Sending domain (e.g. `mg.yourdomain.com`) |
| `MAILGUN_FROM_EMAIL` | From address (e.g. `noreply@mg.yourdomain.com`) |
| `MAILGUN_FROM_NAME` | From display name (e.g. `CheckinHUB` or `Vana Health`) |
| `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` | Base URL for links in emails |
| `MAILGUN_TEST_EMAIL` | (Optional) If set, **all** emails go to this address and subject is prefixed with `[TEST]` |

## Emails sent

| Trigger | Recipient | Subject | When |
|--------|-----------|---------|------|
| **Check-in open** | Client | Your check-in is open | Vercel Cron GET `/api/cron/check-in-reminders/open` (Friday 02:00 UTC = 10am Perth). Clients with an assignment for next week get in-app + push + email. |
| **Check-in closing** | Client | Your check-in is closing today at 5pm | Vercel Cron GET `/api/cron/check-in-reminders/closing` (Monday 09:00 UTC = 5pm Perth). Same recipients as open. |
| **New client (with password)** | Client | Your CheckinHUB login details | When coach creates a client and sets a password. Contains login URL and email; coach shares password separately. |
| **New client (no password)** | Client | Complete your CheckinHUB onboarding | When coach creates a client without a password. Contains one-time onboarding link (7-day expiry). |
| **Meal plan updated** | Client | Your meal plan has been updated | When coach saves client settings with meal plan links and checks “Email client about meal plan when I save”. |

## Implementation

- **Send function:** `src/lib/email-service.ts` – `sendEmail({ to, subject, html, text? })`. No-op if Mailgun env vars are missing.
- **Cron:** `src/lib/check-in-reminders-cron.ts` (used by `/api/cron/check-in-reminders`, `/open`, `/closing`) – adds email send after in-app + push for each client with an email address. Schedule in `vercel.json`.
- **New client:** `src/app/api/coach/clients/route.ts` – sends credentials or onboarding email after creating the client.
- **Meal plan:** `src/app/api/coach/clients/[clientId]/profile/route.ts` – when `sendMealPlanEmail: true` in PATCH body and meal plan links are updated, sends one email with the first plan’s label and URL.

## Testing

Set `MAILGUN_TEST_EMAIL=your@email.com` so all emails go to you and subjects are prefixed with `[TEST]`.
