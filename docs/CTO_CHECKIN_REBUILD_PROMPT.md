# CTO: Check-in System – Issues Catalog & Rebuild Prompt

This document does two things:

1. **Catalogs every known failure and weakness** in the current check-in system so nothing is repeated.
2. **Provides a single prompt** you can paste into a new repo/project to build an **optimized check-in system** from the ground up: no failure points, no missing check-ins, no wrong dates.

Use the schema in `DATA_SCHEMA_FOR_NEW_UI.md` for the exact Firestore shape; use this doc for **what went wrong** and **how the new system must behave**.

---

# Part 1: Issues We Have Had

## A. Wrong week / wrong assignment

| Issue | What happened | Root cause |
|------|----------------|------------|
| **“This week” opened April** | Client chose “This week (Feb 16–22)” but landed on a form for a week in April. | Resolve matched on **due date** (next Monday). Week semantics were derived from due date; when no assignment had that exact due date, API fell back to “earliest” assignment, which could be a later week (e.g. Week 7 in April). |
| **Multiple sources of “week”** | `dueDate`, `recurringWeek`, “week ending Sunday”, “next Monday” all used in different places. | No single canonical “reflection week” (the week the check-in is *for*). Matching and display logic mixed due-date math with week numbers. |
| **Progress table: three “W1” columns, dates out of order** | Question Progress Over Time showed W1 23/02, W1 05/01, W1 02/01, W2, W3. | Responses sorted by **recurringWeek** first, then date, so all “Week 1” from different periods grouped together. Chronological order was broken. |

**Lesson for rebuild:** One canonical “reflection week” per check-in (e.g. Monday YYYY-MM-DD). All matching, display, and sorting by **date only**. No fallback to “earliest” assignment when the selected week has no assignment—create one or return a clear error.

---

## B. Client identity and API access

| Issue | What happened | Root cause |
|------|----------------|------------|
| **401 on resolve / check-ins list** | “Could not start check-in” or empty “Resume check-in” list. | Requests sent without Bearer token, or token expired. No retry with refreshed token; no clear error/Retry in UI. |
| **Delete Pending deleted 0** | Coach clicked Delete Pending; success message but no rows removed. | Assignments stored under **auth UID**; API queried with **client doc id** (or vice versa). Two different `clientId` values used in different code paths. |
| **Resume list empty although check-in started** | User started a check-in, left, came back; “Resume” didn’t show it. | Either 401 so check-ins API never returned data, or horizon filter (e.g. “only last 3 / next 6 weeks”) excluded the assignment, or clientId mismatch. |

**Lesson for rebuild:** Single, consistent resolution of “client id” (doc id + auth UID) everywhere. All client-scoped APIs: require auth, resolve client once, use same id for read/write. Retry once with refreshed token on 401; surface clear error + Retry in UI.

---

## C. Completed vs available weeks

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Completed “This week” still selectable** | Client had already submitted “This week”; it still appeared as an option to start again. | “Completed week” derived from `dueDate` → “reflection week Monday” using **UTC**; week options use **local** Monday. Timezone mismatch so completed weeks weren’t disabled. |
| **No server-side “completed week”** | Relied on client computing reflection week from due date. | Assignments created before “Check-in 2” didn’t have `reflectionWeekStart`; only due date existed. Backfill or dual logic (prefer reflectionWeekStart, fallback to due-date math) required. |

**Lesson for rebuild:** Every assignment has an explicit **reflection week** (Monday YYYY-MM-DD) set at creation. All “is this week done?” logic uses that field only. No date math in multiple timezones for critical paths.

---

## D. Pre-created assignments and coach list

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Synthetic pending after Delete Pending** | Coach deleted pending; list still showed 25+ pending rows. | Coach check-ins API **synthesized** future weeks from one template (e.g. “Week 1 of 52” → weeks 2–52 as virtual rows). Deleted only real docs; synthetic rows kept showing. |
| **DELETE body not received** | Delete Pending sometimes received no body (clientId/formId). | Some environments/servers don’t forward body on DELETE. API expected clientId/formId in body. |
| **List not refreshing after delete** | After successful delete, UI didn’t refetch. | Guard (e.g. “hasLoadedCheckIns”) prevented refetch or state wasn’t reset so the same stale list rendered. |

**Lesson for rebuild:** No synthetic rows. List = only real documents. Destructive actions use POST with body (e.g. “delete pending”) so body is never dropped. After any mutation that changes the list, force refetch and update UI.

---

## E. Windows, overdue, and “missed”

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Client blocked on Saturday** | Client tried to do “this week” on Saturday; told window closed or shown wrong week. | Window logic (e.g. Fri 10am–Tue 12pm) and “next week’s window opened” auto-marked assignments missed. Synthetic past weeks stayed “overdue” and appeared in lists; form page showed “window closed” for past week. |
| **Confusion: overdue vs missed vs pending** | Multiple statuses; clients and coaches unsure what to do. | Status derived from due date, window, and DB flag; synthetic assignments didn’t get same status rules as real ones. |

**Lesson for rebuild:** If you keep “windows,” apply the same rules to every assignment (real only; no synthetic). Prefer simple rule: “allow submission for any non-completed assignment for that client+form+week” and use “reflection week” as the single gate. No auto-missed based on “next week’s window” unless you clearly document and test it.

---

## F. UX and product alignment

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Too many week options** | 4 weeks back + 1 week ahead; “what’s the point?” for future. | Product wanted “2 weeks back, this week only; nothing in the future.” Logic was generic. |
| **Complete Now went to wrong place** | Dashboard “Complete Now” linked to form; product wanted “New check-in” first. | Two entry points (direct form vs type+week) and copy didn’t match intent. |
| **“Check-ins” in nav after removal** | Sidebar still showed “Check-ins” on some deploys. | Different deploy targets (Cloud Run vs Firebase Hosting); or nav built from list that still had the link. |
| **Coach table: due date vs completed** | Coach expected to see “when completed” for done check-ins; saw due date. | Table showed due date for all rows. Product wanted completed date when status = completed. |

**Lesson for rebuild:** Single, clear entry for “do a check-in” (e.g. type + week → form). Dashboard CTA and nav match that. Coach views show “completed at” for completed rows. Week range and visibility driven by explicit product rules (e.g. 2 back, 0 future).

---

## G. Data and display consistency

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Progress table date order** | Columns not chronological; duplicate week labels. | Sort key was (recurringWeek, date) instead of date only. |
| **Resume / To Do vs New check-in** | When to show “Resume” vs “start new” unclear; links inconsistent. | Multiple entry points (dashboard To Do, Check-ins page, New check-in) with different targets (direct form vs check-in-2). |

**Lesson for rebuild:** All “list of check-ins” sorted by **date only** (asc or desc by product). One primary path: “New check-in” (type + week) → resolve/create → form. “Resume” = same list from API (pending/overdue), same form link; no second resolve.

---

## H. Deployment and environment

| Issue | What happened | Root cause |
|------|----------------|------------|
| **Changes on run.app but not web.app** | Deployed to Cloud Run; user checked checkinv5.web.app and saw old UI. | Two deploy targets: Cloud Run (run.app) and Firebase Hosting (web.app). Only one was updated. |
| **Stale .next/standalone for Hosting** | Firebase deploy used old build. | `firebase deploy --only hosting` used existing `.next/standalone`; no fresh build before deploy. |

**Lesson for rebuild:** Single deploy story (e.g. build once → deploy to one place, or document “build then deploy Hosting” so both targets get same code).

---

# Part 2: Design Principles for the Rebuild

These are the rules the new system must follow so the same failures cannot recur.

1. **Single canonical “reflection week”**  
   Every check-in assignment has one field: the Monday (YYYY-MM-DD) of the week the check-in is *for*. All “which week?”, “is this week done?”, and “find assignment for this week” logic uses only this field. No derivation from due date in multiple code paths.

2. **Create-on-demand only**  
   Assignments are created when the client (or coach) explicitly starts a check-in for a given (client, form, week). No pre-creation of “Week 2 … 52” or synthetic rows. List APIs return only real documents.

3. **Consistent client identity**  
   One function/resolver: “given token (or request), return the canonical client id(s) for Firestore.” Every client-scoped API uses it. Store and query with the same id(s) (doc id + auth UID) so no “deleted 0” or “empty list” due to id mismatch.

4. **Auth and resilience**  
   All client/coach APIs require a valid Bearer token. On 401, client retries once with a refreshed token. If still 401, show a clear message and a Retry control. No silent failure.

5. **Chronological by date only**  
   Any list or table that is “over time” (progress, history, coach table) is ordered by **date only** (assignment due or completed). No primary sort by “week number” or other ordinal that can repeat across periods.

6. **Completed = server truth**  
   “Is this week completed?” is determined only from stored data: assignment has `responseId` (or status completed) and its reflection week matches. No client-only computation that can diverge (e.g. timezone).

7. **One primary entry path**  
   “Do a check-in” = choose type + week → resolve (find or create by reflection week) → open form. Dashboard “Complete Now” and “Resume” either go to that same entry or deep-link to an existing assignment by id; no second, inconsistent resolve path.

8. **No destructive GET/DELETE body assumptions**  
   Any request that needs a body (e.g. clientId, formId for “delete pending”) uses POST (or PUT) with a JSON body. Never rely on DELETE with body for critical flows.

9. **Explicit product rules in code**  
   Week range (e.g. “2 weeks back, this week, no future”), “show completed date in coach table when completed,” and “Complete Now → New check-in” are explicit constants or config, not implied.

10. **Single deploy story**  
    Build and deploy are documented so that the same build reaches every URL (e.g. Cloud Run and Firebase Hosting) that should serve the app.

---

# Part 3: Prompt for New Repo / New Project

Copy the block below into a new Cursor (or other) project as the initial brief. The project should implement an **optimized check-in system** that satisfies the schema in `DATA_SCHEMA_FOR_NEW_UI.md` and the principles above.

---

## PROMPT START

**Project: Optimized check-in system (greenfield rebuild)**

**Goal:** Build a check-in system that has **no failure points**, **no missing check-ins**, and **no wrong dates**. We are rebuilding from a prior system that had many of the issues below; this project must avoid all of them.

**Data:** Use the exact Firestore schema described in `DATA_SCHEMA_FOR_NEW_UI.md` (same collections and field names) so we can connect the new app to existing data. Do not invent new collection or field names for core check-in concepts.

**Auth:** Same Firebase project (env from existing app). Clients and coaches sign in with Firebase Auth. Resolve “client” from token once per request and use that consistently (doc id + auth UID) for all client-scoped reads/writes.

**Required behaviour:**

1. **Reflection week is the single source of truth**  
   Every check-in assignment has a field `reflectionWeekStart` (Monday YYYY-MM-DD, local). “Which week is this for?” and “is this week already completed?” use only this field. No matching or gating by due date alone. When creating an assignment, always set `reflectionWeekStart` to the week the user selected.

2. **Create-on-demand**  
   Do not pre-create assignments for future weeks. When the user chooses (client + form + week), find an assignment with that `reflectionWeekStart` (and client/form); if none, create one and return its id. Lists show only real documents from Firestore (no synthetic “Week 2 … N” rows).

3. **Client identity**  
   One resolver: from the request (Bearer token), resolve to the canonical client id(s) used in Firestore (doc id and auth UID). Use the same set for every query and write. Never query with one id and write with another.

4. **Auth and 401**  
   All APIs that return client or check-in data require a valid Bearer token. If the API returns 401, the client app must retry once with a refreshed Firebase id token. If it still gets 401, show a clear message (e.g. “Sign in again or refresh”) and a Retry button. Do not fail silently or show an empty list without explanation.

5. **Chronological order**  
   Any list or table that represents “check-ins over time” or “progress over time” must be sorted by **date only** (e.g. assignment due date or completed at), ascending or descending by product choice. Do not sort primarily by “week number” or any ordinal that can repeat (e.g. “Week 1” in different months).

6. **Completed weeks**  
   “This week is already done” is true iff there exists an assignment for that client+form with that `reflectionWeekStart` and (`responseId` set or status completed). Use server data only; do not rely on client-side date math for this. In the “choose week” UI, disable and mark (e.g. “✓ Done”) any week that is completed.

7. **Single entry path for “do a check-in”**  
   The main path is: user chooses check-in type (form) and week → backend finds or creates assignment by `reflectionWeekStart` → redirect to form for that assignment id. Dashboard “Complete Now” and “Resume” either link to this flow or directly to `/check-in/{assignmentId}` for an existing assignment. Do not have two different resolve flows that can send the user to different weeks.

8. **Destructive or mutation actions with body**  
   Any action that needs parameters (e.g. “delete pending for this client+form”) must use POST (or PUT) with a JSON body. Do not use DELETE with a body for critical flows (some environments drop it).

9. **Explicit product rules**  
   Implement these as named constants or config: (a) week range for “choose week” = last 2 weeks + this week only (no future weeks); (b) coach “check-ins” table shows completed-at date when status is completed, otherwise due date; (c) dashboard “Complete Now” links to the “New check-in” (type+week) flow. No magic numbers or implicit behaviour.

10. **Deploy**  
    Document a single flow: build once, then deploy to all targets (e.g. Cloud Run and Firebase Hosting) so every URL serves the same version.

**Issues the previous system had (must not recur):**  
Wrong week (e.g. “This week” opening April); 401 with no retry or message; completed weeks still selectable (timezone/reflection week); Delete Pending deleting 0 (clientId mismatch); synthetic pending rows after delete; list not refreshing after delete; progress table with duplicate “W1” and wrong date order; dashboard and nav pointing to wrong entry; two deploy targets out of sync.  
Design and implement so each of these is impossible or explicitly handled.

**Deliverables:**  
- Client: “New check-in” (type + week) → resolve/create → form → submit.  
- Client: “Resume” / To Do list from same API, same assignment id link.  
- Client: “Choose week” shows only allowed range; completed weeks disabled.  
- Coach: Check-ins list = real assignments only; completed rows show completed date; delete pending works and list refreshes.  
- Progress/history: All time-based lists and tables sorted by date only.  
- Auth: 401 → retry once with refresh; then clear error + Retry.  
- Docs: How to deploy so both run.app and web.app (or your targets) stay in sync.

**PROMPT END**

---

# Part 4: Checklist for the New Build

Before calling the rebuild “done,” verify:

- [ ] Every assignment created has `reflectionWeekStart` set to the selected week Monday (YYYY-MM-DD).
- [ ] “Is this week completed?” uses only server data (assignment with that `reflectionWeekStart` and `responseId` or completed status).
- [ ] No API or UI derives “which week?” from due date alone; no fallback to “earliest” assignment when selected week has no match.
- [ ] Client id is resolved once per request and used consistently (no doc id in one place and auth UID in another for same client).
- [ ] All client/coach data APIs require auth; client retries once on 401 with refreshed token and shows error + Retry if still 401.
- [ ] No synthetic or virtual rows in any check-in list; list = real Firestore documents only.
- [ ] Any “over time” list/table is sorted by date only (no primary sort by week number).
- [ ] “Delete pending” (or equivalent) uses POST with body; list refetches and updates after success.
- [ ] Week picker shows only the product-defined range (e.g. 2 back, this week, 0 future).
- [ ] Dashboard “Complete Now” and primary CTA go to the defined entry (New check-in or direct form).
- [ ] Deploy instructions ensure the same build reaches all live URLs.

---

*End of CTO Check-in Rebuild Prompt*
