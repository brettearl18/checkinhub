# Emails sent by CheckinHUB

Emails are sent via **Mailgun**. If Mailgun is not configured, no emails are sent (in-app and push notifications still work).

## Go live (production)

1. In **Vercel → Settings → Environment Variables** (Production), set:
   - `MAILGUN_API_KEY`
   - `MAILGUN_DOMAIN`
   - `MAILGUN_FROM_EMAIL` (verified Mailgun sender, e.g. `noreply@mg.vanahealth.com.au`)
   - `MAILGUN_FROM_NAME` (fallback display name, e.g. `Vana Health`)
   - `NEXT_PUBLIC_APP_URL` = `https://checkin.vanahealth.com.au`
   - Optional: `CLIENT_EMAIL_COACH_NAME` = `Coach Silvi` (used on cancellation / reactivation emails)
   - Optional: `CLIENT_ACCOUNT_CLOSED_CC_EMAIL` = `info@vanahealth.com.au` (CC on account emails)
2. **Remove `MAILGUN_TEST_EMAIL`** from Production (or leave unset). While set, every email goes to that one address with `[TEST]` in the subject — clients never receive them.
3. **Redeploy** after changing env vars.
4. In the coach portal: **Settings → Email** — status should show **Live**. Send yourself previews with the test buttons.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MAILGUN_API_KEY` | Mailgun API key (private) |
| `MAILGUN_DOMAIN` | Sending domain (e.g. `mg.yourdomain.com`) |
| `MAILGUN_FROM_EMAIL` | From address on verified domain |
| `MAILGUN_FROM_NAME` | Default from display name |
| `CLIENT_EMAIL_COACH_NAME` | Optional — overrides coach name on account emails (default: Coach Silvi) |
| `CLIENT_EMAIL_REPLY_TO` | Optional — reply-to if coach user has no email |
| `CLIENT_ACCOUNT_CLOSED_CC_EMAIL` | Optional — CC on closure / reactivation emails |
| `NEXT_PUBLIC_APP_URL` | Base URL for sign-in and delete-my-data links |
| `MAILGUN_TEST_EMAIL` | **Testing only** — redirects all sends to this address |

## Emails sent

| Trigger | Recipient | Subject (approx.) | When |
|--------|-----------|-------------------|------|
| Check-in open | Client | Your check-in is open | Cron Friday 02:00 UTC |
| Check-in closing | Client | Your check-in is closing today at 5pm | Cron Monday 09:00 UTC |
| New client (password) | Client | Your CheckinHUB login details | Coach creates client with password |
| New client (invite) | Client | Complete your CheckinHUB onboarding | Coach creates client without password |
| Meal plan updated | Client | Your meal plan has been updated | Coach saves meal plan + “email client” |
| **Account closed** | Client (+ CC info@) | Your CheckinHUB account has been closed | Coach cancels, or Stripe grace ends (3 days) |
| **Account reactivated** | Client (+ CC info@) | Your CheckinHUB account has been reactivated | Coach sets Active, or Stripe resubscribes in grace |
| **Deletion warning** | Client (+ CC info@) | Your CheckinHUB data will be deleted in 30 days | Cron ~11 months after closure |
| Manual check-in nudge | Client | Quick reminder – your check-in is waiting | Coach sends from client page |

Account closed / reactivated / deletion emails use the branded template and send **from Coach Silvi** (or `CLIENT_EMAIL_COACH_NAME`).

## Testing

- Set `MAILGUN_TEST_EMAIL=your@email.com` in Vercel **Preview** or locally — not Production when you want live client emails.
- Coach **Settings → Email**: preview account-closed, reactivated, and deletion-warning templates.

## Implementation

- `src/lib/email-service.ts` — Mailgun send
- `src/lib/client-cancelled-email.ts` — account closed, reactivated, deletion warning
- `src/lib/client-account-closure.ts` — closure + reactivation triggers
- `src/app/api/coach/email-status/route.ts` — live vs test mode indicator for coach settings
