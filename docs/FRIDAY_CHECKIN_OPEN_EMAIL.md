# Friday 10am Perth – “Your Check-in Is Open” Email

This document describes how to design and send **one weekly email** to clients: **every Friday at 10:00 AM Perth time**, telling them their check-in is open. It is written so a **new project** can implement the feature from scratch (Mailgun, template, API route, scheduler).

---

## 1. Requirement

- **When:** Every **Friday at 10:00 AM** in **Australia/Perth**.
- **Who:** Everyone who should see the message – typically **all active clients** who have completed onboarding and have at least one **open** (e.g. pending/active) check-in for the current week. Optionally you can send to “all active clients with check-in access” if you prefer a single weekly nudge regardless of assignment state.
- **Message:** One short email: **“Your check-in is open”** (or similar), with a clear call-to-action to log in and complete their check-in.
- **Send mechanism:** Mailgun. No built-in cron; a **scheduler** (e.g. Google Cloud Scheduler) calls your API once per week.

---

## 2. Mailgun Setup

### 2.1 Environment variables

Set these in your deployment (e.g. Cloud Run, Vercel) and in `.env.local` for local runs:

| Variable | Description | Where to get it |
|----------|-------------|------------------|
| `MAILGUN_API_KEY` | Mailgun API key (private) | Mailgun Dashboard → Settings → API Keys |
| `MAILGUN_DOMAIN` | Sending domain (e.g. `mg.yourdomain.com`) | Mailgun Dashboard → Sending → Domain |
| `MAILGUN_FROM_EMAIL` | From address (e.g. `noreply@mg.yourdomain.com`) | Your choice; must be on verified domain |
| `MAILGUN_FROM_NAME` | From display name (e.g. `Vana Health` or `Check-In`) | Your choice |
| `NEXT_PUBLIC_BASE_URL` | Base URL of the app (for links in email) | e.g. `https://yourapp.web.app` |
| `MAILGUN_TEST_EMAIL` | (Optional) If set, **all** emails go to this address instead of real recipients | Use for testing |

Do **not** commit API keys. Use a `.env.template` with variable names only.

### 2.2 Sending an email (code pattern)

Your app needs a single “send email” function that uses the Mailgun API. Typical pattern:

- **Input:** `to` (string or array), `subject`, `html` (and optionally `text`, `replyTo`).
- **Behaviour:** If `MAILGUN_TEST_EMAIL` is set, replace `to` with that address and optionally prefix subject with `[TEST]` so you don’t email real users during tests.
- **Mailgun:** Use the official Mailgun JS SDK or REST API: `POST https://api.mailgun.net/v3/{domain}/messages` with `from`, `to`, `subject`, `html`, and your API key in auth.

Example (conceptual):

```ts
// sendEmail({ to: string | string[], subject: string, html: string, emailType?: string, metadata?: object })
const actualTo = process.env.MAILGUN_TEST_EMAIL || to;
await mg.messages.create(DOMAIN, { from, to: actualTo, subject, html });
```

The new project can mirror the existing `sendEmail` in `src/lib/email-service.ts` (Mailgun client, test override, optional audit logging).

---

## 3. Email Design

### 3.1 Purpose

One clear idea: “Your check-in is open – log in and complete it.”

### 3.2 Subject line (suggested)

- **“Your check-in is open”**  
  or  
- **“Your weekly check-in is ready”**

Keep it short and actionable.

### 3.3 Body (suggested)

- **Greeting:** “Hi {clientFirstName},”
- **Message:** One or two sentences, e.g.  
  “Your check-in for this week is now open. Log in to complete it and stay on track with your coach.”
- **CTA button:** “Complete your check-in” (or “Log in to check-in”) linking to the **client portal** or directly to the check-in flow, e.g.  
  `{BASE_URL}/client-portal` or `{BASE_URL}/client-portal/check-in-2` (or whatever the new app’s path is).
- **Plain link:** Same URL below the button for accessibility and clients who don’t load images.
- **Sign-off:** e.g. “Best, [Coach name or App name]”
- **Footer:** Optional: “You’re receiving this because you’re an active client. If you don’t want these emails, contact your coach or update your notification settings.”

### 3.4 Template inputs

The template should accept at least:

- `clientName` or `clientFirstName` – for the greeting.
- `loginOrCheckInUrl` – full URL to the client portal or check-in page.
- Optionally: `coachName`, `appName`, for sign-off and branding.

### 3.5 HTML structure

- Use a single-column layout, max width ~600px.
- Inline or embedded CSS (many clients strip `<style>` in the head).
- One prominent button (e.g. green or brand colour) for the CTA.
- Mobile-friendly (large tap target, readable font size).

You can base the HTML on the existing “check-in window open” or “check-in assignment” templates in this repo (`src/lib/email-service.ts` or `email-templates.ts`) and simplify to a single message and one button.

---

## 4. Who Receives the Email (recipient logic)

Implement this in the API route that the scheduler calls.

**Recommended:**

1. **Clients only** – Query your `clients` (or equivalent) collection.
2. **Active** – e.g. `status === 'active'`.
3. **Has email** – `email` is non-empty and valid.
4. **Onboarding done** – e.g. `onboardingStatus === 'completed' || onboardingStatus === 'submitted'` or `canStartCheckIns === true` (match your existing rules).
5. **Notifications allowed** – e.g. `emailNotifications !== false` (or your app’s field).
6. **At least one open check-in this week** – e.g. has at least one assignment in `check_in_assignments` (or equivalent) for the current week with status `pending` or `active` and not yet completed.  
   “Current week” can be the week containing “this Friday” (e.g. Monday–Sunday in Perth, or your app’s reflection week).

**Alternative (simpler):**  
Send to **all active clients** who have completed onboarding and have email notifications enabled, even if they have no assignment this week. The copy can still say “your check-in is open” and the link goes to the portal where they see their check-ins (or a message that none are due).

**Deduplication:**  
Send **at most one email per client per Friday**. Either:

- Run the job only once per week (Friday 10am Perth), and in that run send to each eligible client once, or  
- Track “last Friday open email sent” per client (e.g. `lastFridayCheckInOpenEmailSent: Date`) and skip if already sent for the current week.

---

## 5. API Route Design

### 5.1 Endpoint

- **Method and path:** `POST /api/scheduled-emails/friday-checkin-open`  
  (or `POST /api/scheduled-emails/weekly-checkin-open`).

- **Auth:**  
  Either no auth (scheduler calls with a secret header or no auth if the URL is unguessable), or require a shared secret header, e.g. `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret: <CRON_SECRET>`. The new project should not expose this secret; only the scheduler and your env have it.

### 5.2 Behaviour

1. **Optional:** Validate scheduler secret (if used).
2. **Optional:** Parse body for `testEmail` – if present, send all emails only to that address (and optionally prefix subject with `[TEST]`).
3. **Determine “this week”** in Australia/Perth (e.g. get “this Friday’s” date or the current week’s Monday–Sunday).
4. **Query recipients** using the logic in §4 (active clients, onboarding done, notifications on, and if required: at least one open check-in for this week).
5. **Deduplicate** – one email per client (e.g. by client id).
6. For each recipient:
   - Build `loginOrCheckInUrl` (e.g. `NEXT_PUBLIC_BASE_URL + '/client-portal'` or your check-in path).
   - Get template output (subject, html) from your “Friday check-in open” template.
   - Call your `sendEmail({ to: client.email, subject, html, emailType: 'friday-checkin-open', metadata: { clientId } })`.
   - Optionally update a “last sent” field on the client so you don’t double-send if the job runs twice.
7. Return JSON: `{ success: true, sent: number, skipped: number, errors?: string[] }`.

### 5.3 Idempotency

If the scheduler retries or runs twice, avoid sending twice to the same client for the same week. Options:

- Store `lastFridayCheckInOpenEmailSent` (or `lastWeeklyCheckInOpenEmailSent`) on the client doc with the **date of the Friday** (or week identifier). Before sending, check that you haven’t already sent for that Friday/week.
- Or run the job only once per week and make it safe to run multiple times in the same hour (e.g. “sent this week” flag).

---

## 6. Scheduling: Friday 10:00 AM Perth

The app does **not** run cron itself. An external scheduler must call your API.

### 6.1 Google Cloud Scheduler (recommended if you use GCP)

- **Schedule (cron):** Friday at 10:00 in Perth → `0 10 * * 5` with timezone `Australia/Perth`.  
  (In cron: 5 = Friday; 10 = 10th hour.)

- **Example:**

```bash
# Replace YOUR_PROJECT, YOUR_REGION, YOUR_CLOUD_RUN_OR_APP_URL with real values
gcloud scheduler jobs create http friday-checkin-open \
  --project=YOUR_PROJECT \
  --location=YOUR_REGION \
  --schedule="0 10 * * 5" \
  --uri="https://YOUR_CLOUD_RUN_OR_APP_URL/api/scheduled-emails/friday-checkin-open" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --time-zone="Australia/Perth"
```

- **Optional auth:** If your route requires a secret, add e.g.  
  `--headers="Content-Type=application/json,X-Cron-Secret=YOUR_CRON_SECRET"`  
  and set `YOUR_CRON_SECRET` in Cloud Scheduler (or use OIDC if you use it for other jobs).

- **Test run:**  
  `gcloud scheduler jobs run friday-checkin-open --location=YOUR_REGION`

### 6.2 Other schedulers

Use any service that can send HTTP POST on a schedule (e.g. cron-job.org, EasyCron, Vercel Cron, GitHub Actions scheduled workflow). Configure:

- **URL:** `https://your-app-domain/api/scheduled-emails/friday-checkin-open`
- **Method:** POST
- **Schedule:** Weekly, Friday 10:00 AM **Australia/Perth** (convert to UTC if the scheduler uses UTC: Perth is UTC+8, so 10:00 Perth = 02:00 UTC; but if the scheduler supports timezone, use `Australia/Perth`).

---

## 7. Testing

1. **Test mode:** Set `MAILGUN_TEST_EMAIL=your@email.com`. All sends go to that address; no real clients receive the email.
2. **Manual trigger:** Call `POST /api/scheduled-emails/friday-checkin-open` (and optionally `{"testEmail":"you@example.com"}` in the body) to run the logic once without waiting for Friday.
3. **Staging:** Run the same job in a staging environment with test data and confirm subject, body, link, and recipient list.

---

## 8. Checklist for the New Project

- [ ] Mailgun: domain verified, API key in env, `sendEmail` (or equivalent) implemented with test override.
- [ ] Template: “Friday check-in open” – subject + HTML with greeting, short message, CTA button, link, sign-off.
- [ ] API route: `POST /api/scheduled-emails/friday-checkin-open` – recipient logic (§4), one email per client, call template + sendEmail.
- [ ] Idempotency: avoid double-send for the same week (e.g. “last sent” per client or per week).
- [ ] Scheduler: job at `0 10 * * 5` with timezone `Australia/Perth` calling the route (Cloud Scheduler or other).
- [ ] Env: `NEXT_PUBLIC_BASE_URL`, Mailgun vars, optional `MAILGUN_TEST_EMAIL` and optional `CRON_SECRET`.

This gives the new project everything needed to design and send the single Friday 10am Perth “your check-in is open” email via Mailgun.
