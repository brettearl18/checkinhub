# Phase 1 & Phase 2 – Verification checklist

Use this to confirm Phases 1 and 2 are complete. See **CTO_DEVELOPMENT_PLAN.md** for full scope.

---

## Phase 1: Firebase & real data

### Exit criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|--------|
| 1 | Sign-in with real credentials; identity (role, clientId/coachId) from Firestore | ✓ | `/api/me` uses Firestore when `FIREBASE_SERVICE_ACCOUNT` set; redirect client→`/client`, coach→`/coach`. |
| 2 | New check-in: forms from Firestore; resolve creates/reads real `check_in_assignments` with `reflectionWeekStart`; submit writes `formResponses` and updates assignment | ✓ | APIs: forms, resolve, submit; no mocks when admin configured. |
| 3 | Resume list = real assignments from Firestore (resumable only) | ✓ | `GET /api/check-in/assignments` filters status in `["pending","active","overdue","started"]`. |
| 4 | Rules and indexes deployed; no data transfer (same project) | ✓ | `firestore.rules` confirmed: authenticated users read/write (see file comments). App uses Admin SDK only for data; rules apply to any client-side access. Deploy with `firebase deploy --only firestore:rules` and `firebase deploy --only firestore:indexes`. |

### Scope checklist

- [x] Environment: `.env.template` exists; `.env.local` (user-managed) with client keys + optional `FIREBASE_SERVICE_ACCOUNT`.
- [x] When service account set: all APIs use Firestore (no mock branches for core flows).
- [x] When service account **not** set in production: APIs return 503 (e.g. `requireClient`/`requireCoach`, `/api/me`).
- [x] **Rules confirmed:** Repo `firestore.rules` allows read/write for `request.auth != null`. **Holding off deploy** so the old site (same project) is unaffected; deploy when ready (after checking/backing up current rules in Firebase Console).

---

## Phase 2: Client polish & resilience

### Exit criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|--------|
| 1 | Client can view/edit profile; see progress/history (date-ordered); see/add measurements and goals | ✓ | Profile: view+edit. History: `/client/history` date-ordered. Measurements: view+add. Goals: view + progress bar (optional edit of current value not in UI; API exists). |
| 2 | 401 → retry once → then error message + Retry | ✓ | `fetchWithAuth` retries once with refreshed token; pages set `authError` and show `AuthErrorRetry`. |
| 3 | Empty states and single entry path verified | ✓ | EmptyState on dashboard resume, history, measurements, goals. All primary CTAs point to New check-in. |

### Scope checklist

- [x] **Profile:** `/client/profile` – view/edit (firstName, lastName, email, phone, timezone).
- [x] **History:** `/client/history` – past check-ins, sorted by date; links to response+feedback when completed.
- [x] **Measurements:** `/client/measurements` – list + add (body weight + optional measurements).
- [x] **Goals:** `/client/goals` – list + progress bar; PATCH API for goal update exists (optional in-scope edit UI not built).
- [x] **401 & retry:** `useApiClient` retries once; `AuthErrorRetry` on second 401.
- [x] **Empty states:** No check-ins (resume), No check-ins yet (history), No measurements, No goals; all with New check-in where relevant.
- [x] **Single entry path:** Dashboard, profile Check-ins card, history empty state → New check-in.

---

## Optional Phase 2 addition (if desired)

- **Goals – edit current value:** Phase 2 says “optional edit of current value/progress.” The API `PATCH /api/client/goals/[goalId]` exists; the goals page does not yet have an inline edit (e.g. input + Save). Add if you want clients to update current value from the app.

---

## Sign-off

- [ ] Phase 1 exit criteria met (and rules/indexes confirmed for your project).
- [ ] Phase 2 exit criteria met.
- [ ] Ready to proceed to Phase 3+ (or back to coach UX work).

Update this file when you complete or change any item.
