# New Client Signup Flow

This document describes the **complete** ways a new client can join the platform: coach-created (with or without password), token-based onboarding (invite link), and self-registration with coach code. It also covers onboarding questionnaire, when check-ins are allowed, and related emails/notifications.

---

## 1. Overview: Three Entry Paths

| Path | Who starts it | Client gets | First step for client |
|------|----------------|------------|------------------------|
| **A. Coach adds client with password** | Coach | Auth account + client doc immediately; credentials email | Log in → complete onboarding questionnaire |
| **B. Coach adds client without password** | Coach | Client doc only (status `pending`); invite email with link | Open link → set password (token flow) → log in → onboarding questionnaire |
| **C. Self-registration** | Client | Coach code required; Auth + client doc on submit | Register at `/register` → welcome email → log in → onboarding questionnaire |

After the client has an Auth account and can log in, **onboarding questionnaire** and **canStartCheckIns** control when they can do check-ins. Check-ins are **allocated manually by the coach** after signup (no automatic first check-in in current behaviour).

---

## 2. Path A: Coach Adds Client With Password

### 2.1 Coach action

- **Where:** e.g. **Add New Client** (`/clients/new`) or equivalent coach UI.
- **Required:** firstName, lastName, email, **coachId**. Optional: phone, password.
- **API:** `POST /api/clients`  
  **Body:** `firstName`, `lastName`, `email`, `coachId`, optional `phone`, optional `password` (and optional goals, communicationPreference, checkInFrequency).  
  **Note:** The API expects **coachId**; if the form sends only `assignedCoach`, the request must map it to `coachId` (e.g. `coachId: userProfile?.uid` or `coachId: assignedCoach`).

### 2.2 Backend (when password is provided)

1. **Validation** – Required fields; password strength if present. Check no existing client or Auth user with that email.
2. **Firebase Auth** – Create user with email, password, displayName; set custom claims `role: 'client'`, `coachId: coachId`.
3. **users** – Create/merge doc `users/{authUid}` with uid, email, role, profile (firstName, lastName), metadata (invitedBy: coachId).
4. **clients** – Create doc with id = authUid (or generated id if no auth). Fields: firstName, lastName, email, coachId, status **`active`**, authUid, and standard defaults (timezone, progressScore, etc.).
5. **clientScoring** – Create default (e.g. moderate profile).
6. **Measurement schedule** – Auto-create for client (e.g. fortnightly from next Friday) if coachId present.
7. **Email** – Send **credentials email** (login URL, email, password, coach name). Optional: notify admin/coach (client signup notification).

### 2.3 Client experience

- Receives credentials email → logs in at `/login` → lands in client portal.
- **Onboarding:** Dashboard shows “Complete Your Onboarding Questionnaire.” Until they complete it (and optionally “Submit to coach”), check-ins may be gated by `canStartCheckIns` (see §6). After all sections complete, `canStartCheckIns` is set true and they can do check-ins the coach has assigned.

---

## 3. Path B: Coach Adds Client Without Password (Token / Invite)

### 3.1 Coach action

- Same as Path A but **do not send password**.
- **API:** `POST /api/clients` with firstName, lastName, email, coachId, no password.

### 3.2 Backend (no password)

1. **Validation** – Same as Path A; no Auth user created yet.
2. **Client doc** – Created with a **generated client id** (e.g. `client-{timestamp}-{random}`). status = **`pending`**, authUid = null.
3. **Token** – Generate secure `onboardingToken`, set `tokenExpiry` = now + 7 days. Save on client doc: `onboardingToken`, `tokenExpiry`.
4. **clientScoring** – Default (e.g. moderate).
5. **Measurement schedule** – Optional, same as Path A (current code may create after token completion).
6. **Email** – **Onboarding invitation email** with link:  
   `{BASE_URL}/client-onboarding?token={onboardingToken}&email={encodedEmail}`  
   Subject e.g. “Welcome to Your Wellness Journey”; explains they’ll set a password and complete onboarding. Link valid 7 days.
7. Optional admin/coach signup notification.

### 3.3 Client: open invite link

- **URL:** `/client-onboarding?token=...&email=...`
- **Page:** Calls `POST /api/client-onboarding/verify` with `token`, `email`.
- **Verify API:** Finds client by `onboardingToken` + `email`; checks not expired (`tokenExpiry`), not already active. Returns client name etc.
- If invalid/expired: show error and link to login. If valid: show **set password** form.

### 3.4 Client: set password and activate

- User enters password (and confirm); client submits to `POST /api/client-onboarding/complete` with `token`, `email`, `password`.
- **Complete API:**
  1. Re-validate token + email; check not expired, not already active.
  2. **Create Firebase Auth user** (email, password, displayName from client doc); set custom claims `role: 'client'`, `coachId: clientData.coachId`.
  3. **Update client doc:** status = `active`, authUid = new Auth UID, clear onboardingToken/tokenExpiry, onboardingStatus = `completed`, **canStartCheckIns = true**.
  4. **users** – Create doc for auth UID (role client, profile, metadata.invitedBy).
  5. **Notification** – e.g. welcome/onboarding complete for client.
  6. **Email** – Notify admin/coach that client completed onboarding.
  7. **Measurement schedule** – Create if coachId present (if not already created).
- **UI:** Success message; redirect to `/login` after short delay. Client then logs in and uses the portal; they may still see onboarding questionnaire for profile/goals (and submitting to coach), but they are already allowed to start check-ins from the backend’s perspective.

---

## 4. Path C: Self-Registration (Client Registers With Coach Code)

### 4.1 Client action

- **URL:** `/register`
- **Form:** email, password, confirmPassword, firstName, lastName, **coachCode** (required for clients). Role is fixed as client (coaches are created by admin).
- **Coach code:** Optional “Verify” step calls `GET /api/coaches/lookup?shortUID={code}` to show coach name and validate code before submit.

### 4.2 Backend: `POST /api/auth/register`

- **Body:** email, password, firstName, lastName, role: `'client'`, **coachCode** (required when role is client).
- **Coach lookup:** Resolve coach by `coaches.shortUID` (e.g. uppercase), status active. If not found → 404 invalid coach code.
- **Duplicate check:** If a **client** with this email exists: status `pending` → 409 “invitation already sent…”; status `active` → 409 “account already exists, log in.”
- **Firebase Auth** – Create user; no custom claims shown in snippet but coachId is stored on client record.
- **users** – Create doc (uid, email, firstName, lastName, role, coachId for client).
- **clients** – Create doc with id = auth UID. status = `pending` (or active; code may set pending initially), onboardingStatus = `not_started`, **canStartCheckIns = false**, and standard defaults. coachId = resolved coach id.
- **clientScoring** – Default (e.g. moderate).
- **Measurement schedule** – Create if coachId present.
- **Email** – **Self-registration welcome email** (welcome, next steps, login URL, coach name if linked).

### 4.3 Client experience

- After register → can log in. Dashboard shows onboarding questionnaire. When they complete all sections (and optionally submit to coach), `canStartCheckIns` is set true and they can do assigned check-ins.

---

## 5. Onboarding Questionnaire (Post–Signup)

- **Where:** Client portal → “Complete Your Onboarding Questionnaire” → `/client-portal/onboarding-questionnaire`.
- **Data:** Stored in **client_onboarding_responses** (by clientId); progress and section state in **client** doc (onboardingStatus, progress, etc.).
- **Sections:** Multiple sections/questions (see onboarding-questions). Client can save progress per section.
- **When all sections complete:**  
  - **PATCH/POST** to onboarding API updates client: **onboardingStatus** (e.g. `in_progress` → `completed`), **canStartCheckIns = true**, onboardingCompletedAt, optional onboardingData (goals, activity level, etc.).
- **Submit to coach:** Client can “Submit” questionnaire to coach.  
  - **POST** to e.g. `/api/client-portal/onboarding/submit` (clientId, coachId).  
  - Sets onboarding doc status to `submitted`, client doc **onboardingStatus = 'submitted'** (and optionally onboardingSubmittedAt).  
  - Creates notification for coach; may generate/store report.  
  - **canStartCheckIns** is already true when all sections are complete (set by the same onboarding save flow that marks completion).

**Gating check-ins:**  
- Check-ins list / “New check-in” availability uses **canStartCheckIns** and/or **onboardingStatus** (e.g. completed or submitted).  
- So: client must complete the onboarding questionnaire (all sections) before they can start check-ins; “Submit to coach” is an extra step that notifies the coach and sets status to submitted.

---

## 6. When Can the Client Start Check-Ins?

- **Token flow (Path B):** After **client-onboarding/complete**, client doc gets **canStartCheckIns = true** and onboardingStatus = `completed`. They can do check-ins as soon as the coach has assigned them.
- **Password flow (Path A) and self-register (Path C):** **canStartCheckIns** is set to **true** when the client **completes all sections** of the onboarding questionnaire (saved via client-portal onboarding API). Until then, check-ins list may be empty or gated.
- **Check-ins are allocated by the coach** (manually or via your allocation logic). No automatic “first check-in” is created at signup in the described behaviour.

---

## 7. Emails Summary

| Trigger | Email | Recipient |
|--------|--------|-----------|
| Coach creates client **without** password | Onboarding invitation (link to set password, 7-day expiry) | Client |
| Coach creates client **with** password | Credentials (login URL, email, password) | Client |
| Client completes token onboarding | Optional admin/coach “onboarding complete” | Admin/coach |
| Client self-registers | Welcome (next steps, login URL, coach name) | Client |
| Optional (scheduled) | Onboarding reminder (e.g. 24h after signup if not completed) | Client |

(Other emails: check-in assigned, check-in reminders, coach feedback, etc. – see CLIENT_EMAIL_TRIGGERS_COMPLETE.md.)

---

## 8. Data Created by Signup (Summary)

- **Firebase Auth:** User (email, password, displayName). Custom claims: role `client`, coachId when applicable.
- **users/{uid}:** uid, email, role, profile (firstName, lastName), metadata (e.g. invitedBy coachId).
- **clients/{clientId}:** clientId = Auth UID (Path A, C) or generated id (Path B until complete). Fields: firstName, lastName, email, coachId, status, authUid, onboardingStatus, canStartCheckIns, timestamps, and defaults.
- **clientScoring/{clientId}:** Default thresholds (e.g. moderate).
- **client_onboarding_responses:** Created when client first saves onboarding answers (clientId, responses, progress, status).
- **measurement_schedules:** One per client when coachId present (e.g. fortnightly from next Friday).

---

## 9. API Reference

| Method | Endpoint | Purpose |
|--------|----------|--------|
| POST | `/api/clients` | Coach creates client (with or without password). Requires coachId, firstName, lastName, email. |
| POST | `/api/client-onboarding/verify` | Verify token + email for invite link (returns client info or error). |
| POST | `/api/client-onboarding/complete` | Token flow: create Auth user, set password, activate client, set canStartCheckIns. |
| POST | `/api/auth/register` | Self-registration. Requires email, password, firstName, lastName, role, coachCode (for client). |
| GET | `/api/coaches/lookup?shortUID=...` | Resolve coach by code for registration. |
| (Client portal) | Onboarding save / submit | Save progress; set canStartCheckIns and onboardingStatus when complete/submitted. |

---

## 10. File and Page Reference

| Item | Location |
|------|----------|
| Coach: Add New Client form | `src/app/clients/new/page.tsx` (must send coachId to API, e.g. as coachId or map from assignedCoach) |
| Token onboarding (set password) | `src/app/client-onboarding/page.tsx` |
| Self-registration | `src/app/register/page.tsx` |
| Onboarding questionnaire | `src/app/client-portal/onboarding-questionnaire/page.tsx` |
| Create client API | `src/app/api/clients/route.ts` |
| Onboarding verify/complete | `src/app/api/client-onboarding/verify/route.ts`, `complete/route.ts` |
| Register API | `src/app/api/auth/register/route.ts` |
| Onboarding save/submit | `src/app/api/client-portal/onboarding/route.ts`, `.../onboarding/submit/route.ts` |

---

## 11. Notes for Implementers

- **Add New Client form:** The create-client API requires **coachId**. Ensure the form sends `coachId` (e.g. current coach’s uid). If the form currently sends only `assignedCoach`, add `coachId: userProfile?.uid` (or map assignedCoach → coachId) so creation succeeds.
- **Token expiry:** Invite links expire after 7 days. Client must set password before then or ask coach for a new invite (re-send or regenerate token if you add that flow).
- **Duplicate email:** Creation and register both check for existing client or Auth user with the same email and return 409 with a clear message (e.g. “invitation already sent” for pending, “account already exists” for active).
- **Check-in allocation:** No automatic first check-in is created at signup; coaches allocate check-ins manually (or via your own automation) after the client is active and, if you gate by onboarding, after they can start check-ins.

This is the complete new client signup flow for the platform.
