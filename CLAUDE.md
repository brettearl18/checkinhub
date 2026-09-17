# CheckinHUB — Project Overview for AI Assistants

> **Purpose of this document:** Give Claude (or any AI coding assistant) enough context to work on this codebase without re-discovering architecture from scratch.  
> **Production URL:** `https://checkin.vanahealth.com.au`  
> **Brand:** Vana Health / CheckinHUB  
> **Timezone for business logic:** Australia/Perth (`src/lib/perth-date.ts`)

---

## 1. What This Project Is

CheckinHUB is a **coach–client wellness platform**. Coaches manage a roster of clients, assign weekly check-in forms, review responses, run programs, and handle billing. Clients log in to complete check-ins, track habits/measurements/progress, follow workout programs, and optionally track menstrual cycle data.

**Two portals:**

| Portal | Route prefix | Users |
|--------|--------------|-------|
| Coach | `/coach/*` | Coaches (fitness/wellness practitioners) |
| Client | `/client/*` | End clients |

**Critical constraint:** This app connects to an **existing Firebase project** (CheckinV5 / `checkinv5`). Firestore collection names and field names must **not be renamed** without a migration plan. See `docs/DATA_SCHEMA_FOR_NEW_UI.md` for the canonical schema.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, design tokens (brand gold `#daa450`) |
| Client DB/Auth | Firebase 11 (Auth, Firestore, Storage) |
| Server | `firebase-admin` 13 in API routes |
| Payments | Stripe 20 (server-only — no Stripe.js on frontend) |
| Email | Mailgun REST API (`src/lib/email-service.ts`) |
| Push | Firebase Cloud Messaging (web push) |
| Charts | Recharts |
| Hosting | Vercel (with cron jobs in `vercel.json`) |

**Commands:** `npm run dev` (turbopack), `npm run build`, `npm start`

---

## 3. Repository Layout

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # ~120 API route handlers
│   │   ├── coach/            # Coach-authenticated APIs
│   │   ├── client/           # Client-authenticated APIs
│   │   ├── check-in/         # Shared check-in flow APIs
│   │   ├── cron/             # Vercel cron endpoints
│   │   ├── webhooks/stripe/  # Stripe webhook
│   │   ├── me/               # Identity resolution
│   │   └── client-register/, client-onboarding/
│   ├── client/               # Client portal pages
│   ├── coach/                # Coach portal pages
│   ├── client-onboarding/    # Token-based onboarding
│   ├── delete-my-data/       # GDPR-style self-delete
│   ├── sign-in/, register/, privacy/
│   └── layout.tsx            # Root layout + AuthProvider
├── components/
│   ├── client/               # Client UI (cycle, habits, check-in, etc.)
│   ├── coach/                # Coach UI (exercises, progress photos, etc.)
│   └── ui/                   # Shared primitives (Button, Card, charts)
├── contexts/
│   └── AuthContext.tsx       # Firebase auth + identity state
└── lib/                      # Shared server/client logic (51 modules)
docs/                         # Detailed feature docs (see §12)
firestore.rules
firestore.indexes.json
vercel.json                   # Cron schedules
.env.template
```

---

## 4. Authentication & Identity

### Client-side
- Firebase email/password sign-in at `/sign-in`
- `AuthContext` (`src/contexts/AuthContext.tsx`) listens to `onAuthStateChanged`
- On login, calls `GET /api/me` to resolve role and IDs
- API calls use `Authorization: Bearer <firebase-id-token>` via `src/lib/api-client.ts`

### Server-side (`src/lib/api-auth.ts`)
- `getIdentityFromToken(token)` → `{ uid, role, clientId, coachId }`
- Reads `users/{uid}` for role (`coach` | `client` | `admin`)
- **Client:** finds `clients` doc by `authUid == uid` or doc id == uid
- **Coach:** `coachId = uid`

### Guards
- `requireClient(request, options?)` — blocks closed accounts and Stripe-suspended accounts
  - `allowLimitedPortalAccess: true` — profile read when closed or subscription ended
  - `allowClosedAccount: true` — delete-data routes for closed accounts only
- `requireCoach(request)` — coach-only routes

### Client signup paths
1. **Coach creates with password** → Auth account created immediately, credentials email sent
2. **Coach creates without password** → `pending` status, onboarding token email (`/client-onboarding`)
3. **Self-register** with coach code → `/register` → `POST /api/client-register`

### Client status (`src/lib/client-status.ts`)
- `active` — normal roster
- `pending` — onboarding not complete
- `cancelled` — off roster (legacy `archived` treated as `cancelled`)

---

## 5. Firestore Data Model (Summary)

**Canonical reference:** `docs/DATA_SCHEMA_FOR_NEW_UI.md`

### Core collections

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `clients` | client id or auth uid | Profile, coachId, status, Stripe, meal plans, closure fields |
| `users` | Firebase Auth UID | Role, email, name |
| `coaches` | coach UID | shortUID (coach code), settings |
| `forms` | formId | Check-in form definitions |
| `questions` | questionId | Question text, type, options, scoring |
| `check_in_assignments` | auto | Assigned check-ins per client/week |
| `formResponses` | auto | Submitted answers + score |
| `coachFeedback` | auto | Coach voice/text feedback on responses |
| `client_measurements` | auto | Body weight + tape measurements |
| `clientGoals` | auto | Wellness goals |
| `clientScoring` | clientId | Traffic-light score thresholds |
| `progress_images` | auto | Progress photos |
| `messages` | auto | Coach–client chat (`conversationId = clientId_coachId`) |
| `notifications` | auto | In-app notifications |

### Extended collections

| Collection | Purpose |
|------------|---------|
| `habitEntries` | Daily habit logs (steps, hydration, sleep) |
| `cycleProfiles` / `cycleDailyLogs` | Optional cycle tracking |
| `client_achievements` / `pending_achievements` | Badges |
| `programs` | Workout program templates |
| `client_programs` | Assigned program (doc id = clientId) |
| `exercises` | Coach exercise library |
| `pushTokens` | FCM web push tokens |

### Important fields on `clients` doc

```ts
// Stripe / billing
stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus  // 'active'|'paused'|'cancelled'
paymentStatus  // 'paid'|'past_due'|'failed'|'canceled'

// Account closure / retention
status                    // 'active' | 'pending' | 'cancelled'
cancelledAt
dataRetentionUntil        // YYYY-MM-DD (12 months after closure)
stripeCancellationPendingAt  // starts 3-day grace before closure email
accountClosedEmailSentAt
accountReactivatedEmailSentAt
dataDeletionWarningEmailSentAt
dataDeletionToken, dataDeletionTokenExpiry

// Other
badgeAwardMode            // 'auto' | 'coach'
mealPlanLinks, mealPlanJson
canStartCheckIns, onboardingStatus, onboardingToken
```

---

## 6. Feature Areas & Key Files

### 6.1 Weekly Check-ins

**Model:** Each check-in is tied to a **reflection week** (`reflectionWeekStart` = Monday `YYYY-MM-DD` in Perth).

**Flow:**
1. Client opens New check-in → `POST /api/check-in/resolve` creates/finds assignment
2. Client fills form → draft saved → `POST /api/check-in/submit`
3. Score computed via `src/lib/check-in-score.ts` + traffic-light bands in `src/lib/scoring-utils.ts`
4. Coach reviews on client page → feedback in `coachFeedback`

**Assignment statuses:** `pending`, `active`, `overdue`, `started`, `completed`, `missed`

**Key files:**
- `src/app/api/check-in/*` — resolve, submit, draft, missed handling
- `src/lib/check-in-assignment-status.ts`
- `src/components/client/CheckInFormFields.tsx`
- `docs/TRAFFIC_LIGHT_AND_SCORING.md`, `docs/COACH_RESPONSE_SYSTEM.md`

**Reminders:** Cron sends in-app + push + email Friday (open) and Monday (closing). See `src/lib/check-in-reminders-cron.ts`.

### 6.2 Habits

Three predefined habits: steps, hydration, sleep (`src/lib/habits.ts`).  
Entries in `habitEntries`; streaks computed in `src/lib/habits-streaks.ts`.

### 6.3 Progress & Measurements

- Body weight + optional tape measurements (`client_measurements`)
- Progress photos (`progress_images`) with comparison UI
- Goals (`clientGoals`)
- Coach progress page: `/coach/clients/[clientId]/progress`
- Timeline aggregation: `src/lib/progress-timeline.ts`

### 6.4 Programs & Exercises

- Coach builds programs: weeks → days → blocks → exercises
- Assign to client → `client_programs/{clientId}`
- Client follows sessions at `/client/program/session/[week]/[day]`
- Exercise library per coach in `exercises` collection
- Docs: `docs/Fitness-Programming.md`, `docs/exercise-programming-phases.md`

### 6.5 Cycle Tracking (optional, client opt-in)

- Collections: `cycleProfiles`, `cycleDailyLogs`
- Client opt-in + setup at `/client/cycle`
- Coach read-only view when client shares: `/coach/clients/[clientId]/cycle`
- Phase calculation: `src/lib/cycle-tracking.ts`
- Coach progress page shows greyed-out panel if not set up: `src/components/coach/CoachCycleWellbeingGlance.tsx`

### 6.6 Billing / Stripe

- Client linked via `stripeCustomerId` on client doc
- **No Stripe.js on frontend** — all Stripe calls server-side
- Coach billing APIs under `/api/coach/clients/[clientId]/billing/`:
  - `subscription`, `sync`, `cancel-subscription`, `pause-subscription`, `resume-subscription`, `update-price`, `retry-invoice`, `history`
- Webhook: `POST /api/webhooks/stripe` — syncs `paymentStatus`, `stripeSubscriptionStatus`
- Client pay link: `GET /api/client/billing/pay-link`
- Docs: `docs/STRIPE_INTEGRATION.md`, `docs/STRIPE_PAYMENT_STATUS.md`

### 6.7 Client Cancellation & Data Retention

**Gold-standard lifecycle** (implemented in `src/lib/client-account-closure.ts`):

```
Stripe cancels
  → stripeCancellationPendingAt set
  → Portal access blocked immediately (API + UI)
  → 3-day grace (no closure email yet)
  → If resubscribe within 3 days: access restored, reactivation email, no closure
  → After 3 days (cron): status=cancelled, closure email from Coach Silvi
  → Month 11: deletion warning email
  → Month 12: auto-purge (cron)

Coach manually sets Cancelled
  → Immediate closure + closure email (no 3-day grace)

Coach sets Active (reactivation)
  → Clears retention fields, reactivation email from Coach Silvi
```

**Portal access rules** (`src/lib/api-auth.ts` + `src/lib/client-account-closure.ts`):
- `isClosedClientStatus(status)` → blocked except profile + delete-data
- `isStripePortalAccessSuspended(data)` → blocked except profile (subscription ended, not yet fully closed)

**Self-delete:** `/delete-my-data` with secure token from closure email  
**Purge:** `src/lib/purge-client-data.ts` — deletes all client Firestore data + Auth user

**Key files:**
- `src/lib/client-account-closure.ts` — close, reactivate, schedule Stripe grace
- `src/lib/client-stripe-closure-cron.ts` — 3-day grace cron
- `src/lib/client-data-retention-cron.ts` — month-11 warning + month-12 purge
- `src/lib/client-cancelled-email.ts` — branded emails (Coach Silvi)
- `src/lib/client-email-layout.ts` — HTML email wrapper

### 6.8 Achievements / Badges

- ~15+ badge definitions in `src/lib/achievements.ts`
- Award modes: `auto` (immediate) or `coach` (pending approval) — `src/lib/badge-approval.ts`
- Evaluation: `src/lib/award-achievements.ts`

### 6.9 Messages & Notifications

- Messages: `messages` collection, `conversationId = ${clientId}_${coachId}`
- In-app notifications: `notifications` collection
- Push: FCM via `src/lib/push-server.ts` — see `docs/PUSH_NOTIFICATIONS.md`

### 6.10 Meal Plans

- Stored on client doc: `mealPlanLinks`, `mealPlanJson`
- Viewer: `src/components/client/MealPlanViewer.tsx`
- Coach can email client on save — `docs/MEAL_PLANS.md`

---

## 7. API Route Conventions

**Base:** `src/app/api/`

### Auth pattern (every protected route)
```ts
const authResult = await requireClient(request);  // or requireCoach
if ("error" in authResult) return authResult.error;
const clientId = authResult.identity.clientId!;
```

### Route groups

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/api/coach/*` | `requireCoach` | Coach dashboard operations |
| `/api/client/*` | `requireClient` | Client portal operations |
| `/api/check-in/*` | `requireClient` | Check-in create/submit flow |
| `/api/cron/*` | `CRON_SECRET` header | Scheduled jobs |
| `/api/webhooks/stripe` | Stripe signature | Payment events |
| `/api/me` | Bearer token | Identity resolution |

### Cron auth
```ts
// src/lib/check-in-reminders-cron.ts
requireCronSecret(request)
// Accepts: Authorization: Bearer <CRON_SECRET> or x-cron-secret: <CRON_SECRET>
```

### Cron schedules (`vercel.json`)

| Path | UTC cron | Perth time | Purpose |
|------|----------|------------|---------|
| `/api/cron/check-in-reminders/open` | `0 2 * * 5` | Fri 10:00 | Check-in open reminder |
| `/api/cron/check-in-reminders/closing` | `0 9 * * 1` | Mon 17:00 | Check-in closing reminder |
| `/api/cron/weight-reminder-daily` | `0 23 * * *` | Daily 07:00 | Body weight reminder |
| `/api/cron/habit-reminder-daily` | `0 11 * * *` | Daily 19:00 | Habit tracker reminder |
| `/api/cron/client-data-retention` | `0 1 * * *` | Daily 09:00 | Stripe grace closures + deletion warnings + purges |

---

## 8. Email System

**Provider:** Mailgun (`src/lib/email-service.ts`)

**Required env vars:** `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`, `MAILGUN_FROM_NAME`

**Live vs test:** If `MAILGUN_TEST_EMAIL` is set, ALL emails redirect to that address with `[TEST]` prefix. Remove it in Production to send to real clients.

**Account lifecycle emails** use branded HTML from `src/lib/client-email-layout.ts`, sent **from Coach Silvi** (`CLIENT_EMAIL_COACH_NAME` env var).

| Email | Trigger | File |
|-------|---------|------|
| Check-in open / closing | Cron | `src/lib/check-in-reminders-cron.ts` |
| New client credentials / onboarding | Coach creates client | `src/app/api/coach/clients/route.ts` |
| Meal plan updated | Coach saves + checkbox | `src/app/api/coach/clients/[clientId]/profile/route.ts` |
| Account closed | Coach cancel or Stripe grace ends | `src/lib/client-cancelled-email.ts` |
| Account reactivated | Coach reactivates or Stripe resubscribes | same |
| Deletion warning (30 days) | Cron month 11 | same |
| Manual check-in nudge | Coach button | `src/app/api/coach/clients/[clientId]/send-check-in-reminder/route.ts` |

**Coach can preview all templates:** Settings → Email (`/coach/settings`)

**Full list:** `docs/EMAILS.md`

---

## 9. UI / Design

- **Brand gold:** `#daa450` — CTAs, header bar, primary actions
- **Client portal theme:** `data-theme="vana"` on client layout (`VANA_THEME_TRIAL` flag)
- **Fonts:** `src/lib/fonts.ts` (display + body)
- **Vana brand bar:** `src/components/client/VanaBrandBar.tsx` — white logo on gold strip
- **Design doc:** `docs/THEME_DESIGN.md`

**Date display:** Always `DD MMM YYYY` via `src/lib/format-date.ts` (`formatDateDisplay`). Calendar keys use `YYYY-MM-DD` without timezone shift.

---

## 10. Deployment

**Host:** Vercel from `main` branch → auto-deploy  
**Production:** `https://checkin.vanahealth.com.au`

### Required Production env vars

| Category | Variables |
|----------|-----------|
| Firebase client | `NEXT_PUBLIC_FIREBASE_*` (all 7) |
| Firebase Admin | `FIREBASE_SERVICE_ACCOUNT` (full JSON string) |
| App URL | `NEXT_PUBLIC_APP_URL=https://checkin.vanahealth.com.au` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Mailgun | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`, `MAILGUN_FROM_NAME` |
| Cron | `CRON_SECRET` |
| Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| Email branding | `CLIENT_EMAIL_COACH_NAME=Coach Silvi`, `CLIENT_ACCOUNT_CLOSED_CC_EMAIL=info@vanahealth.com.au` |

### Firebase setup (required for production auth)
1. **Authorized domains** in Firebase Console → Authentication
2. **API key HTTP referrers** in Google Cloud Console (often the actual fix for `auth/requests-from-referer-are-blocked`)

**Full deploy guide:** `docs/VERCEL_DEPLOYMENT.md`

---

## 11. Coding Conventions for AI Assistants

### Do
- Read surrounding code before editing — match naming, types, import style
- Use existing lib functions rather than reimplementing (especially dates, auth, status checks)
- Use `formatDateDisplay` for all user-visible dates
- Use `requireClient` / `requireCoach` on all new API routes
- Use `isClosedClientStatus` / `isStripePortalAccessSuspended` when gating client access
- Keep Firestore field names stable (see `docs/DATA_SCHEMA_FOR_NEW_UI.md`)
- Minimize diff scope — only change what the task requires
- Run `npm run build` to verify before considering work complete

### Don't
- Rename Firestore collections or fields without explicit migration plan
- Add Stripe.js to the frontend
- Commit unless explicitly asked
- Skip hooks with `--no-verify`
- Block cancelled clients from profile/delete-data routes (use `allowLimitedPortalAccess` / `allowClosedAccount`)
- Send closure email immediately on Stripe cancel (use 3-day grace via `scheduleStripeCancellationClosure`)

### Client portal access layers (remember these are separate)
1. **Billing** — Stripe subscription status
2. **Portal access** — `clients.status` + `stripeCancellationPendingAt`
3. **Data retention** — `dataRetentionUntil`, purge cron

---

## 12. Existing Documentation Index

| Doc | Topic |
|-----|-------|
| `docs/DATA_SCHEMA_FOR_NEW_UI.md` | **Canonical Firestore schema** |
| `docs/VERCEL_DEPLOYMENT.md` | Deploy + env vars |
| `docs/EMAILS.md` | All email triggers + go-live checklist |
| `docs/NEW_CLIENT_SIGNUP_FLOW.md` | Client onboarding paths |
| `docs/STRIPE_INTEGRATION.md` | Stripe linking + webhook |
| `docs/STRIPE_PAYMENT_STATUS.md` | Payment status testing |
| `docs/TRAFFIC_LIGHT_AND_SCORING.md` | Check-in scoring |
| `docs/COACH_RESPONSE_SYSTEM.md` | Coach review workflow |
| `docs/COACH_AUDIO_FEEDBACK.md` | Voice feedback |
| `docs/CHECK_IN_REMINDERS_CRON.md` | Reminder cron details |
| `docs/PUSH_NOTIFICATIONS.md` | FCM web push setup |
| `docs/MEAL_PLANS.md` | Meal plan feature |
| `docs/Fitness-Programming.md` | Program builder |
| `docs/THEME_DESIGN.md` | Design tokens + Vana theme |
| `docs/CTO_DEVELOPMENT_PLAN.md` | Phased build history |
| `docs/CTO_CHECKIN_REBUILD_PROMPT.md` | Rebuild principles |

---

## 13. Architecture Diagram

```
┌─────────────┐     ┌─────────────┐
│   Coach     │     │   Client    │
│  /coach/*   │     │  /client/*  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └────────┬──────────┘
                │ Firebase Auth (Bearer token)
                ▼
┌───────────────────────────────────────┐
│         Vercel / Next.js 15           │
│  ┌─────────────┐  ┌────────────────┐  │
│  │ App Router  │  │  API Routes    │  │
│  │   Pages     │  │  ~120 handlers │  │
│  └─────────────┘  └───────┬────────┘  │
│  ┌─────────────────────────┴────────┐ │
│  │         Vercel Cron (daily)      │ │
│  └──────────────────────────────────┘ │
└───────────┬──────────┬────────┬───────┘
            │          │        │
     ┌──────▼──┐  ┌────▼───┐ ┌──▼─────┐
     │Firebase │  │ Stripe │ │Mailgun │
     │Auth+FS  │  │        │ │        │
     │+Storage │  │webhook │ │        │
     │+FCM     │  └────────┘ └────────┘
     └─────────┘
     Project: checkinv5
```

---

## 14. Common Tasks — Where to Look

| Task | Start here |
|------|------------|
| Add coach API endpoint | `src/app/api/coach/`, use `requireCoach` |
| Add client API endpoint | `src/app/api/client/`, use `requireClient` |
| Change check-in flow | `src/app/api/check-in/`, `src/lib/check-in-score.ts` |
| Change scoring bands | `src/lib/scoring-utils.ts`, `clientScoring` collection |
| Change cancellation behavior | `src/lib/client-account-closure.ts` |
| Change emails | `src/lib/client-cancelled-email.ts`, `src/lib/email-service.ts` |
| Add cron job | `vercel.json` + `src/app/api/cron/` + `requireCronSecret` |
| Stripe webhook handling | `src/app/api/webhooks/stripe/route.ts` |
| Client portal page | `src/app/client/` |
| Coach portal page | `src/app/coach/` |
| Firestore schema question | `docs/DATA_SCHEMA_FOR_NEW_UI.md` |
| Deploy / env vars | `docs/VERCEL_DEPLOYMENT.md` |

---

*Last updated: July 2026. Update this file when adding major features or changing architecture.*
