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

### Cron (optional – check-in reminders)

| Variable | Example | Notes |
|----------|---------|--------|
| `CRON_SECRET` | Random string you generate | Required if you call `/api/cron/check-in-reminders`; pass it in the `Authorization` header so only your cron job can trigger it. |

---

## 3. Firebase: allow your Vercel domain

Firebase Auth only allows requests from domains you list. If you skip this step, you’ll see:  
`auth/requests-from-referer-https://your-domain-are-blocked`.

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Authentication** → **Settings** (tab) → **Authorized domains**.
2. Click **Add domain** and add **each** domain your app uses (Firebase does not support wildcards like `*.vercel.app`):
   - Your app URL, e.g. `checkinhub-alpha.vercel.app`
   - Any other Vercel deployment URLs you use (e.g. preview branches)
   - Your custom domain if you add one later (e.g. `app.checkinhub.com`)

Without this, sign-in and redirects will be blocked.

---

## 4. Deploy

1. Save environment variables in Vercel.
2. Trigger a deploy: **Deploy** from the import screen, or push to the connected branch (e.g. `main`).
3. Wait for the build. The first deployment will use the env vars you added.

---

## 5. After first deploy

- **Stripe webhooks:** In Stripe, create a webhook for production with URL `https://checkinhub-alpha.vercel.app/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the signing secret.
- **Custom domain (optional):** In Vercel → Project → **Settings → Domains**, add your domain and follow DNS instructions.
- **Cron:** If you use Vercel Cron (Pro plan), add a `vercel.json` schedule for `/api/cron/check-in-reminders`. Otherwise call that URL from an external cron (e.g. cron-job.org) with `Authorization: Bearer <CRON_SECRET>`.

---

## 6. Build and runtime notes

- **Node:** Vercel uses a Node version that supports Next.js 15; no extra config needed unless you need a specific version.
- **Firebase Admin:** `FIREBASE_SERVICE_ACCOUNT` must be the full JSON string; the app reads it in server code only.
- **Preview deployments:** Each PR gets a unique URL. Use the same env vars as production if you want previews to use real Firebase/Stripe, or use separate Firebase/Stripe projects for staging.

If something fails in build or at runtime, check **Vercel → Deployments → [deployment] → Logs** and **Functions** for errors.
