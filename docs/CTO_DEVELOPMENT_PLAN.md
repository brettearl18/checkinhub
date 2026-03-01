# CTO Development Plan – CheckinHUB

Phased build plan so the app is delivered in order, stays aligned with the rebuild principles, and can be validated at each step. **Stick to the plan:** complete a phase (and its exit criteria) before starting the next.

**References:** `DATA_SCHEMA_FOR_NEW_UI.md` (schema), `CTO_CHECKIN_REBUILD_PROMPT.md` (principles + checklist), `NEW_REPO_STARTUP_CHECKLIST.md` (env + config).

---

## Principles (non‑negotiable)

- **Reflection week** = single source of truth (`reflectionWeekStart`, Monday YYYY-MM-DD).
- **Create-on-demand** = no synthetic rows; lists = real Firestore docs only.
- **One client id** = resolve once per request; use same id for all client-scoped read/write.
- **401** = retry once with refreshed token; then clear error + Retry in UI.
- **Chronological** = any “over time” list sorted by **date only**.
- **Destructive actions** = POST with body (no DELETE with body).
- **Single deploy story** = one build → all live URLs.

---

## Current status (before Phase 1)

| Done | Item |
|------|------|
| ✓ | Next.js 15, TypeScript, Tailwind, design tokens (#daa450) |
| ✓ | Auth: Firebase client, AuthProvider, sign-in, sign-out, `/api/me` (identity) |
| ✓ | Client id resolution in API (`requireClient`, mock when no service account) |
| ✓ | Client portal layout + dashboard; New check-in (type + week → resolve → form); form page + submit |
| ✓ | APIs: forms, resolve, assignments, completed-weeks, GET assignment, submit |
| ✓ | Week range: 2 back + this week; completed weeks disabled |
| ○ | Firebase: still optional (mocks when env missing); rules/indexes placeholder |

---

## Phase 1: Firebase & real data

**Goal:** App runs against real Firestore/Auth (dev or live project). No mocks for core flows.

**Scope:**

1. **Environment**
   - Add `.env.local` with Firebase client keys (from existing project or Firebase Console).
   - Optionally add `FIREBASE_SERVICE_ACCOUNT` for API routes (so `/api/me` and all APIs use Firestore).

2. **Firestore**
   - Replace repo `firestore.rules` and `firestore.indexes.json` with **exact copies from the current live app**.
   - Deploy rules/indexes to the **same** Firebase project:  
     `firebase deploy --only firestore:rules` and `firebase deploy --only firestore:indexes` (when needed).
   - Do **not** run any data export/import; same project = same data.

3. **Remove mocks**
   - When `FIREBASE_SERVICE_ACCOUNT` is set, all APIs use Firestore (no mock branches).
   - Keep behaviour when env is missing (e.g. “Firebase not configured” on sign-in, or optional mock for demos) only if you want local dev without Firebase.

4. **Auth**
   - Sign-in uses real Firebase Auth; `/api/me` resolves real `users` + `clients` when Admin is configured.
   - Redirect after sign-in by role (client → `/client`, coach → `/coach`) using identity from `/api/me`.

**Exit criteria:**

- [ ] Sign-in with real credentials; identity (role, clientId/coachId) from Firestore.
- [ ] New check-in flow: forms from Firestore; resolve creates/reads real `check_in_assignments` with `reflectionWeekStart`; submit writes `formResponses` and updates assignment.
- [ ] Resume list = real assignments from Firestore (resumable only).
- [ ] Rules and indexes deployed; no data transfer (same project).

**Do not start Phase 2 until Phase 1 is signed off.**

---

## Phase 2: Client polish & resilience

**Goal:** Client experience complete and robust: profile, progress/history, measurements, goals, 401 handling, empty states.

**Scope:**

1. **Profile**
   - Client profile view/edit (from `clients`); respect `profilePersonalization` (e.g. theme) if used.

2. **Progress & history**
   - “Progress” or “History”: list of past check-ins (assignments + responses) from Firestore.
   - Sorted by **date only** (e.g. `completedAt` or `dueDate` desc).
   - No primary sort by week number.

3. **Measurements & goals**
   - View (and optionally add) `client_measurements`.
   - View `clientGoals`; optional edit of current value/progress.

4. **401 & retry**
   - All API calls use `fetchWithAuth` (already retries once with refreshed token).
   - On second 401: show clear message (“Sign in again or refresh”) and **Retry** button; no silent empty lists.

5. **Empty states & copy**
   - Consistent empty states for “No check-ins”, “No measurements”, “No goals”.
   - “Complete Now” / primary CTA points to New check-in (type + week) flow only.

**Exit criteria:**

- [ ] Client can view/edit profile; see progress/history (date-ordered); see/add measurements and goals.
- [ ] 401 → retry once → then error message + Retry.
- [ ] Empty states and single entry path verified.

**Dependency:** Phase 1 done (real Firebase).

---

## Phase 3: Coach – core

**Goal:** Coach can sign in, see their clients, see real check-ins per client (no synthetic rows), and delete pending with list refresh.

**Scope:**

1. **Coach auth & layout**
   - Coach sign-in (same Firebase Auth); `/api/me` returns `role: 'coach'`, `coachId` (uid).
   - Coach layout: nav (e.g. Clients, Sign out); protect routes (redirect non-coach to home).

2. **Client list**
   - API: list clients for this coach (e.g. `clients` where `coachId` == coach uid).
   - Coach dashboard: list of clients (link to client detail / check-ins).

3. **Check-ins per client**
   - API: list **real** `check_in_assignments` for selected client only (no synthetic “Week 2…52”).
   - Sorted by **date only** (e.g. due or completed).
   - Table: show **completed date** when status is completed, otherwise **due date**.

4. **Delete pending**
   - API: **POST** with body `{ clientId, formId? }` to delete pending assignments for that client (and optionally form).
   - After success: client check-ins list **refetches** so UI updates (no stale/synthetic rows).

**Exit criteria:**

- [ ] Coach signs in and sees only their clients.
- [ ] Check-ins list = real documents only; date-ordered; completed rows show completed date.
- [ ] Delete pending works (POST + body); list refreshes after delete.

**Dependency:** Phase 1 (real Firebase). Can overlap with Phase 2.

---

## Phase 4: Coach – responses, feedback, messaging, form builder

**Goal:** Coach can open a response, give feedback (text/voice), use coach–client messaging, and create/edit forms and questions (form builder).

**Scope:**

1. **View response**
   - From client check-ins table, open a completed check-in: load `formResponses` + form + questions; show answers and score.

2. **Coach feedback**
   - Add text or voice feedback: write to `coachFeedback` (responseId, coachId, clientId, questionId or null for overall, feedbackType, content).
   - Client can see feedback in their portal (if not already present, add minimal view).

3. **Messages**
   - Coach–client messaging: list conversations; thread view; send message (write to `messages` with `conversationId`, etc.).

4. **Notifications**
   - Coach in-app notifications (from `notifications` by userId); mark read; optional link to response/message.

5. **Form builder** (see `docs/FORM_BUILDER_SCHEMA.md`)
   - List/create/update/delete **forms** (by coachId); list/create/update/delete **questions** (by coachId).
   - Form stores ordered `questions: string[]` (question doc ids); load form then load each question by id.
   - Support all question types (text, textarea, number, scale, boolean, select, multiple_choice, date, time) and option/weight/scoring fields per schema.
   - Add/remove/reorder questions on a form (update `form.questions`); do not delete question docs still referenced by any form (or remove from forms first).
   - **Copy from standard:** duplicate a standard form by creating new question docs (new ids, coachId = current coach) and new form with new question id list.
   - APIs: GET/POST/PATCH/DELETE for forms; GET/POST/PUT/DELETE for questions; auth = coach (ownership checks).

**Exit criteria:**

- [x] Coach can open response, add feedback; client can see feedback.
- [x] Coach and client can message each other; notifications visible.
- [x] Coach can create/edit forms and questions; reorder; copy from standard; form builder matches FORM_BUILDER_SCHEMA.md.

**Dependency:** Phase 3.

**Verification:** See `docs/PHASE4_VERIFICATION.md`. Voice feedback is API-ready but UI is text-only; optional to add voice input later.

---

## Phase 5: Deploy & release

**Goal:** Single deploy story; same build on all live URLs; go-live checklist done.

**Scope:**

1. **Deploy documentation**
   - One documented flow: e.g. `npm run build` then deploy to Firebase Hosting (and/or Cloud Run) so **both** run.app and web.app (or your targets) get the **same** build.
   - No “deploy to one URL only” without updating the other.

2. **Environment**
   - Production env vars (Hosting/Cloud Run): same Firebase project; no secrets in repo.
   - Authorised domains: add production domain(s) in Firebase Auth if using redirects.

3. **Firestore & indexes**
   - Confirm production project has rules and indexes deployed from this repo (or from current app and kept in sync).

4. **Go-live checklist**
   - Smoke: sign-in (client + coach), New check-in, submit, coach view client check-ins, delete pending, view response.
   - Confirm: no synthetic rows; completed date in coach table; 401 retry behaviour.

**Exit criteria:**

- [ ] Deploy doc is followed and both targets serve same version.
- [ ] Go-live checklist passed; no known regressions from rebuild principles.

**Dependency:** Phases 1–4 (or at least 1–3 if Phase 4 is deferred).

---

## Phase 6 (optional): Extensions

**Only after Phases 1–5 are stable.** Pick as needed.

| Item | Notes |
|------|--------|
| **Payments / Stripe** | Define who pays whom; store `stripeCustomerId` / subscription on `clients` or `coaches`; gate access (e.g. `canStartCheckIns`) by payment status. Schema currently has no payment collections. |
| **Onboarding** | Client onboarding flow: `client_onboarding_responses`, optional `client_onboarding`; drive by `onboardingStatus`. |
| **Wellness resources** | Read-only `wellnessResources`; simple list/detail in client portal. |
| **Progress images** | View/upload `progress_images`; Storage rules if not already in place. |
| **Measurement schedules** | Coach sets `measurement_schedules`; client reminders or UI hint. |
| **Client scoring** | Coach edits `clientScoring` (thresholds) per client. |

---

## Phase summary

| Phase | Name | Dependency | Outcome |
|-------|------|-------------|---------|
| **1** | Firebase & real data | — | Real Firestore/Auth; no mocks; rules/indexes in sync |
| **2** | Client polish | Phase 1 | Profile, progress, measurements, goals, 401 UI, empty states |
| **3** | Coach core | Phase 1 | Clients list, real check-ins table, delete pending, refetch |
| **4** | Coach depth + form builder | Phase 3 | View response, feedback, messages, notifications, form builder (forms + questions CRUD, copy from standard) |
| **5** | Deploy & release | 1–4 | Single deploy story; go-live checklist |
| **6** | Optional | 1–5 | Payments, onboarding, wellness resources, etc. |

**Form builder:** Spec in `docs/FORM_BUILDER_SCHEMA.md`. Developed in **Phase 4** (coach).

---

## How to use this plan

1. **Before each phase:** Read scope and exit criteria; ensure dependencies are done.
2. **During:** Implement only that phase’s scope; don’t pull in Phase N+1 features early.
3. **After:** Tick exit criteria; sign off (e.g. in a short review or demo) before starting the next phase.
4. **Stick to the plan:** If something doesn’t fit (e.g. a new request), add it to Phase 6 or a new phase—don’t merge into the current phase without updating this doc.

Update this file when you add a phase, change scope, or move items between phases so the plan stays the single source of truth.
