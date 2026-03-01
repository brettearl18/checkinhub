# Meal Plans

This document describes how meal plans work in CHECKINV5: data model, coach assignment, client view, and APIs. Meal plans are **links to external content** (e.g. Hub Vana): the app stores a **name** and **URL** per client and optionally notifies the client by email when the coach assigns or updates the plan.

---

## 1. Overview

- **What:** A “meal plan” is a **label + URL** (e.g. “2000 Calorie Meal Plan” → `https://...`). The actual content lives outside the app (e.g. on Hub Vana). The app only stores which plan is assigned to each client and lets the client open the link from their portal.
- **Coach:** Assigns a meal plan to a client from a dropdown (predefined list + coach’s custom plans). Can optionally send an email to the client when assigning/updating. Coaches can add **custom** meal plans (name + URL) that are saved on their profile and appear in the dropdown for all their clients.
- **Client:** Sees their assigned meal plan on the **Meal Plan** page in the client portal: name, “Open Meal Plan” link, and last updated date. If none is assigned, they see “No Meal Plan Assigned”.

---

## 2. Data Model

### 2.1 Client document (`clients` collection)

Stored on the **client** doc:

| Field | Type | Description |
|-------|------|--------------|
| `mealPlanName` | string | Display name of the assigned meal plan (e.g. "2000 Calorie Meal Plan"). |
| `mealPlanUrl` | string | URL to open the plan (e.g. Hub Vana link). Must be a valid URL when saving. |
| `mealPlanUpdatedAt` | Date | When the coach last assigned or updated this client’s meal plan. |

If no plan is assigned, these fields may be missing or empty; the client portal treats that as “No Meal Plan Assigned”.

### 2.2 Coach document (`coaches` collection)

Custom meal plans are stored on the **coach** doc:

| Field | Type | Description |
|-------|------|--------------|
| `customMealPlans` | array | List of `{ name: string, url: string, createdAt?: Date }`. Each entry is one custom plan the coach has added. Shown in the dropdown under “My Custom Meal Plans”. |

- **Predefined** plans are **not** stored in the DB; they are hardcoded in the client profile page and point to fixed Hub Vana URLs.
- **Custom** plans are stored in `coaches.customMealPlans` and are per-coach (each coach has their own list).

---

## 3. Coach Flow (Assign Meal Plan)

**Where:** Client profile → **Meal Plan** section (e.g. under Overview or a dedicated section).

1. **Dropdown:** “Select Meal Plan” includes:
   - **Predefined Meal Plans** – fixed list (e.g. 1300 Calories, 1500 CALORIES, 2000 Calorie Meal Plan, etc.) with fixed URLs.
   - **My Custom Meal Plans** – from `coaches.customMealPlans` (loaded via `GET /api/coaches/[coachId]`).
   - **➕ Create New Custom Meal Plan** – opens name + URL inputs; saving calls `POST /api/coaches/[coachId]/custom-meal-plans` and then the new plan appears in the dropdown and can be selected.

2. **Assign:** Coach selects a plan (or enters name + URL for “CUSTOM”), optionally checks “Send email to client when assigning”, then clicks **Save**.  
   - **API:** `PUT /api/clients/[clientId]/meal-plan`  
   - **Body:** `{ mealPlanName, mealPlanUrl, sendEmail?: boolean }`  
   - **Effect:** Client doc is updated with `mealPlanName`, `mealPlanUrl`, `mealPlanUpdatedAt`. If `sendEmail` is true and the client has email notifications enabled, the client receives the “Your Meal Plan Has Been Updated” email (see Email templates below).

3. **Validation:** Name and URL are required; URL must be valid (`new URL(mealPlanUrl)`). Duplicate names are not allowed when adding a custom plan (per coach).

---

## 4. Client Flow (View Meal Plan)

**Where:** Client portal → **Meal Plan** in the sidebar → `/client-portal/meal-plan`.

1. **Load:** Page calls `GET /api/client-portal?clientEmail=...` (same as other portal pages) and reads from the returned client: `mealPlanName`, `mealPlanUrl`, `mealPlanUpdatedAt`.
2. **Display:**
   - If `mealPlanName` and `mealPlanUrl` are present: show card with plan name, “Last updated” (formatted from `mealPlanUpdatedAt`), and an **Open Meal Plan** button/link that opens `mealPlanUrl` in a new tab.
   - Otherwise: show “No Meal Plan Assigned” and a short message that the coach will assign one.

No edit or delete on the client side; only view and open link.

---

## 5. APIs

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| **PUT** | `/api/clients/[id]/meal-plan` | Coach (must have access to that client) | Assign or update the client’s meal plan. Body: `{ mealPlanName, mealPlanUrl, sendEmail?: boolean }`. Updates `clients` doc and optionally sends email. |
| **POST** | `/api/coaches/[id]/custom-meal-plans` | Coach (must be same as `[id]`) | Add a custom meal plan to the coach’s profile. Body: `{ name, url }`. Appends to `coaches.customMealPlans`. |
| **GET** | `/api/coaches/[id]` | Any authenticated (used by coach UI) | Returns coach doc, including `customMealPlans`, so the client profile page can populate “My Custom Meal Plans”. |
| **GET** | `/api/client-portal?clientEmail=...` | Client (own email) | Returns client data including `mealPlanName`, `mealPlanUrl`, `mealPlanUpdatedAt` for the Meal Plan page. |

**Notes:**

- Meal plan **assignment** does not create or change Stripe, check-ins, or other resources; it only updates the client document and optionally sends one email.
- There is **no** dedicated “list meal plans” API for clients; the client only sees the single assigned plan on their Meal Plan page.
- **Custom meal plans** are not shared between coaches; each coach’s list is independent.

---

## 6. Email (Optional)

When the coach assigns or updates a meal plan and checks “Send email to client”:

- **Template:** `getMealPlanAssignedEmailTemplate(clientName, mealPlanName, mealPlanUrl, coachName)` in `src/lib/email-templates.ts`.
- **Subject:** e.g. “Your Meal Plan Has Been Updated”.
- **Content:** Greeting, plan name, button/link to `mealPlanUrl`, and a note that they can also open the plan from the client portal Meal Plan section.
- **Conditions:** Email is sent only if the client has an email address, `sendEmail` was true in the request, and the client’s `emailNotifications` is not disabled. If the email send fails, the meal plan update is still committed (email failure does not roll back).

---

## 7. Predefined Meal Plans (Current App)

The client profile page defines a **predefined** list of meal plans (name + URL). These are **hardcoded** in `src/app/clients/[id]/page.tsx` (e.g. “1300 Calories Meal Plan”, “1500 CALORIES”, “2000 Calorie Meal Plan”, etc.) and point to Hub Vana URLs. They are not stored in Firestore. To add or change predefined plans, edit that list in the client profile component. Custom plans added by coaches are stored in Firestore and do not require code changes.

---

## 8. Check-in Questions (Reference Only)

Some check-in forms (e.g. Vana) include:

- **“Do you need a new meal plan or changes to your current plan?”** – Yes/No (boolean). Used for coach awareness.
- **“Current Meal Plan”** – Text, not scored (weight 0). For reference so the coach can see what the client considers their current plan in free text.

These are **not** the same as the assigned meal plan (name + URL) on the client doc. The assigned plan is set by the coach in the Meal Plan section; the check-in answers are just responses and do not update `mealPlanName` or `mealPlanUrl`.

---

## 9. Security and Validation

- **Client meal plan (PUT):** Caller must have coach access to the client (via `verifyClientAccess`). Only `mealPlanName`, `mealPlanUrl`, and `sendEmail` are used; URL is validated with `new URL(mealPlanUrl)`.
- **Custom meal plans (POST):** Caller must be a coach and the `[id]` must be their own UID (“You can only add meal plans to your own profile”). Name and URL required; URL validated; duplicate names for that coach are rejected.
- **Client portal:** Client sees only their own client record (by email/uid); no other clients’ meal plans are exposed.

---

## 10. Quick Reference

| What | Where |
|------|--------|
| Client fields | `clients.mealPlanName`, `clients.mealPlanUrl`, `clients.mealPlanUpdatedAt` |
| Coach custom list | `coaches.customMealPlans` → `[{ name, url, createdAt? }]` |
| Assign/update | `PUT /api/clients/[id]/meal-plan` |
| Add custom plan | `POST /api/coaches/[id]/custom-meal-plans` |
| Client view | `/client-portal/meal-plan`; data from `GET /api/client-portal` |
| Email | Optional on assign; template `getMealPlanAssignedEmailTemplate` |

This is how meal plans are implemented: **name + URL per client, optional email, predefined list in code + custom list per coach in Firestore.**
