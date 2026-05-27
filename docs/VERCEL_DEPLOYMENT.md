# Deploying CheckinHUB on Vercel

This guide walks through hosting the app on Vercel and wiring environment variables.

## 1. Connect the repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. Import your GitHub repo (`brettearl18/checkinhub` or your fork).
4. Vercel will detect **Next.js** and set:
   - **Build Command:** `next build`
   - **Output Directory:** (default)
   - **Install Command:** `npm install`
5. **Do not deploy yet** — add environment variables first (step 2).

---

## 2. Environment variables

In the Vercel project: **Settings → Environment Variables**. Add these for **Production** (and optionally Preview if you want staging to hit real services).

### Firebase (client)

| Variable | Where to get it | Notes |
|----------|-----------------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project settings → General | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `{project-id}.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `{project-id}.firebasestorage.app` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Project settings | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Project settings | |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional (analytics) | |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Your VAPID **public** key (or Firebase Console → Cloud Messaging → Web Push certificates) | Must be `NEXT_PUBLIC_*` so the client can use it. If you have `VAPID_PUBLIC_KEY` in env, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value. Required for push. |

### Firebase Admin (server)

| Variable | Where to get it | Notes |
|----------|-----------------|--------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project settings → Service accounts → Generate new private key | Paste the **entire JSON** as one line; escape double quotes if needed or use Vercel’s multiline secret. |
| `FIREBASE_STORAGE_BUCKET` | Same as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` or leave blank to fall back to it | |

### App URL (for invite links and emails)

| Variable | Example | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://checkinhub-alpha.vercel.app` (or your custom domain) | Used for client onboarding invite links. Set this to your primary app URL so invite links point to the right place. If unset, Vercel uses `https://${VERCEL_URL}` automatically. |

### Stripe (if you use payments)

| Variable | Where to get it | Notes |
|----------|-----------------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | Use live key for production. |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks | Create an endpoint pointing to `https://your-domain.com/api/webhooks/stripe` and use the signing secret. |

### Mailgun (emails)

| Variable | Notes |
|----------|--------|
| `MAILGUN_API_KEY` | Mailgun API key (private) |
| `MAILGUN_DOMAIN` | Sending domain (e.g. `mg.yourdomain.com`) |
| `MAILGUN_FROM_EMAIL` | From address (e.g. `noreply@mg.yourdomain.com`) |
| `MAILGUN_FROM_NAME` | From display name (e.g. `CheckinHUB`) |
| `MAILGUN_TEST_EMAIL` | Optional: redirect all emails to this address and prefix subject with `[TEST]` |

### Cron (check-in reminders)

| Variable | Example | Notes |
|----------|---------|--------|
| `CRON_SECRET` | Random string you generate | Required for Vercel Cron; Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. |

The project’s `vercel.json` defines two crons: **Friday 02:00 UTC** (10am Perth) → open reminder; **Monday 09:00 UTC** (5pm Perth) → closing reminder. No extra scheduler needed once `CRON_SECRET` is set.

---

## 3. Firebase: allow your production domain (two places)

If sign-in shows  
`auth/requests-from-referer-https://your-domain-are-blocked`,  
you must fix **both** steps below. Adding the domain under Authentication alone is not enough.

### 3a. Authorized domains (Firebase Console)

1. [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** for each host clients use (no `https://`, no path):
   - `checkinhub-alpha.vercel.app`
   - `checkin.vanahealth.com.au`
   - Any other Vercel preview hosts you use

### 3b. API key HTTP referrers (Google Cloud — usually the actual fix)

The referer error comes from the **Browser API key** restriction, not the authorized-domains list.

1. Open [Google Cloud Console](https://console.cloud.google.com) → select project **CheckinV5** (same as Firebase).
2. **APIs & Services** → **Credentials**.
3. Open the key used by the web app (often **Browser key (auto created by Firebase)** — match `NEXT_PUBLIC_FIREBASE_API_KEY` in Vercel).
4. Under **Application restrictions**, choose **HTTP referrers (web sites)**.
5. Add these referrers (keep existing ones such as `localhost` and `checkinhub-alpha.vercel.app`):

   ```
   https://checkin.vanahealth.com.au/*
   https://checkin.vanahealth.com.au
   https://checkinhub-alpha.vercel.app/*
   https://checkinhub-alpha.vercel.app
   http://localhost:3000/*
   http://localhost:3000
   ```

6. **Save**. Changes can take a few minutes to apply; hard-refresh or try incognito.

Also confirm in Vercel → **Environment Variables** (Production):

- `NEXT_PUBLIC_APP_URL` = `https://checkin.vanahealth.com.au`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `checkinv5.firebaseapp.com` (or your Firebase auth domain)

---

## 4. Deploy

1. Save environment variables in Vercel.
2. Trigger a deploy: **Deploy** from the import screen, or push to the connected branch (e.g. `main`).
3. Wait for the build. The first deployment will use the env vars you added.

---

## 5. After first deploy

- **Stripe webhooks:** In Stripe, create a webhook for production with URL `https://checkinhub-alpha.vercel.app/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the signing secret.
- **Custom domain (optional):** In Vercel → Project → **Settings → Domains**, add your domain and follow DNS instructions.
- **Cron:** `vercel.json` already has two cron paths: `/api/cron/check-in-reminders/open` and `/api/cron/check-in-reminders/closing`. Set `CRON_SECRET` in Vercel so the cron runs (Vercel Cron is available on Pro plan).

---

## 6. Build and runtime notes

- **Node:** Vercel uses a Node version that supports Next.js 15; no extra config needed unless you need a specific version.
- **Firebase Admin:** `FIREBASE_SERVICE_ACCOUNT` must be the full JSON string; the app reads it in server code only.
- **Preview deployments:** Each PR gets a unique URL. Use the same env vars as production if you want previews to use real Firebase/Stripe, or use separate Firebase/Stripe projects for staging.

If something fails in build or at runtime, check **Vercel → Deployments → [deployment] → Logs** and **Functions** for errors.
