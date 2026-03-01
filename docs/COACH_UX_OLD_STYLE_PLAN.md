# Plan: Coach UX to Match Old Website Style (Coach Hub)

This doc maps the old CheckinV5 coach interface (checkinv5.web.app) to CheckinHUB so we can get the new app to the same structure and behaviour.

---

## 1. Layout: Sidebar + Main Content

**Old style:** Left sidebar with branding ("Coach Hub"), main nav, Quick actions, Tools. Main area for content.

**Plan:**

| Item | Action |
|------|--------|
| **Sidebar layout** | Replace top-only nav with a persistent **left sidebar** (collapsible on small screens optional). |
| **Branding** | "CheckinHUB" or "Coach Hub" at top of sidebar with small logo/icon. |
| **Main nav in sidebar** | Dashboard, My Clients, Messages, Check-ins, Responses, Analytics, Forms, Questions Library, Photo Gallery, Payment Report. Map to routes below. |
| **Quick actions** | Section in sidebar: "Add Client", "Create Form" (or "New form"). |
| **Tools** | Optional section later (e.g. Test emails) – can defer. |

**Routes to support:**

| Old label | Route | Status / notes |
|-----------|--------|----------------|
| Dashboard | `/coach` | Done. Can add summary stats (total clients, overdue count) on this page. |
| My Clients | `/coach/clients` | New: clients list **page** with stats + table (see §2). Current `/coach` could redirect here or become dashboard with summary; dashboard and "My Clients" can be same or split. |
| Messages | `/coach/messages` | Phase 4 (messaging). |
| Check-ins | `/coach/check-ins` | Optional: "all check-ins" across clients, or keep current flow (clients → client → check-ins). |
| Responses | `/coach/responses` | Optional: list of recent responses across clients; or rely on per-client "View response". |
| Analytics | `/coach/analytics` | Not in current phases; add as Phase 6 or later. |
| Forms | `/coach/forms` | Phase 4 (form builder). |
| Questions Library | `/coach/questions` | Phase 4 (questions CRUD). |
| Photo Gallery | `/coach/gallery` | Phase 6 (progress_images). |
| Payment Report | `/coach/payments` | Phase 6 (Stripe/payments). |

---

## 2. Clients Page (My Clients) – Stats, Search, Table

**Old style:** Header + action buttons; six stat cards; search bar; filter chips; "Client Inventory" table with columns and export/sort.

**Plan:**

### 2.1 Header and actions
- Title: **"Clients"** with subtitle e.g. "Manage your client relationships and track their progress."
- Top-right buttons: e.g. **"Add New Client"** (if we support coach-created clients), **"View Photos Gallery"** (when Photo Gallery exists). Use primary (e.g. brown/primary) button style.

### 2.2 Summary stat cards (six)
- **Total** – count of all clients for this coach.
- **Active** – count where `status === 'active'` (or equivalent).
- **Pending** – count where status pending (e.g. awaiting approval).
- **At-Risk** – define rule (e.g. no check-in in X days, or flag on client); schema may have or we add.
- **Overdue** – count of check-in assignments that are overdue (status overdue or due date &lt; today and not completed).
- **Avg Progress** – average of `client.progress.overallScore` (or from responses) across clients; show as % with optional small chart.

**Backend:** Extend **GET /api/coach/clients** (or add **GET /api/coach/dashboard** or **/api/coach/stats**) to return:
- `total`, `active`, `pending`, `atRisk`, `overdue`, `avgProgress`
- Optionally keep current list response and add a separate stats endpoint that the clients page calls.

### 2.3 Search and filters
- **Search:** Input "Search by name or email..."; filter the client list by `firstName`, `lastName`, `email` (client-side or server-side query).
- **Filters:** Chips/buttons: **All**, **Active**, **Needs Attention**, **Archived**. Filter the list by `client.status` (and "Needs Attention" = e.g. at-risk or overdue).

### 2.4 Client Inventory table
- **Summary line:** "X total clients"; **Save Preset** (optional); **Export** (e.g. CSV); **Sort** dropdown (Name A–Z, etc.).
- **Columns (match old where data exists):**
  - Checkbox (for bulk actions – optional first iteration).
  - **NAME** – avatar (initial or `profile.avatar`) + full name + optional phone.
  - **STATUS** – e.g. Active (green), Pending, Archived.
  - **PROGRESS** – e.g. dots or bar from `progress.overallScore` or trend.
  - **TREND** – e.g. "4/4 (100%)" (completed/total check-ins in a window); needs definition + data.
  - **WEEKS** – e.g. weeks since first check-in or since start; derive from assignments/dates.
  - **AVG SCORE** – from `progress.overallScore` or from formResponses.
  - **ENGAGEMENT** – last activity / last check-in date; "X days ago", "Y overdue" if applicable.
  - **LAST CHECK-IN** – e.g. "This week: Overdue" or last completed date.
  - **ACTIONS** – e.g. "View check-ins" link/button.

**Backend:** Either extend **GET /api/coach/clients** to return per-client aggregates (overdue count, last check-in date, avg score, trend, weeks) or add a new endpoint **GET /api/coach/clients/inventory** that returns the list plus these fields. Use existing `clients` and `check_in_assignments` (and optionally `formResponses`) to compute.

### 2.5 Visual style
- Use existing design tokens (primary `#daa450`, borders, cards).
- Stat cards: distinct background for each (e.g. green for Active, red for At-Risk/Overdue, neutral for Total/Avg Progress).
- Table: clear headers, alternating or hover row, red text for overdue/at-risk where appropriate.

---

## 3. Implementation order (recommended)

1. **Layout** – Add coach **sidebar** and nav links (Dashboard, My Clients, Messages placeholder, Forms placeholder, etc.). Keep current dashboard at `/coach`; add `/coach/clients` for the new clients page.
2. **Clients page shell** – New route `/coach/clients` with header, stat cards (numbers from new or extended API), search + filters, and table with columns we have data for (Name, Status, Progress/score, Engagement/last check-in, Actions). Add stats API and, if needed, inventory API.
3. **Data** – Implement stats (total, active, pending, at-risk, overdue, avg progress) and per-client fields for table (last check-in, overdue count, avg score, weeks). Refine "at-risk" and "trend" when product rules are clear.
4. **Polish** – Export, sort, save preset (optional), bulk actions (optional). Match colours and typography to old style within our design system.
5. **Other nav items** – Wire Messages, Forms, Questions Library, etc., as those features are built (Phase 4/6).

---

## 4. What we already have

- Coach sign-in and layout (top nav only).
- Dashboard at `/coach` with client cards and "View check-ins".
- Per-client check-ins page: table (Form, Week, Status, Date), View response, Assign check-in, Delete pending.
- View response + coach feedback (text); client sees feedback.
- Schema: `clients` (status, progress), `check_in_assignments`, `formResponses` – enough to drive stats and most table columns once we add the APIs and UI above.

---

## 5. Summary

| Area | Plan |
|------|------|
| **Layout** | Sidebar nav (Dashboard, My Clients, Messages, Check-ins, Responses, Analytics, Forms, Questions, Gallery, Payments) + Quick actions. |
| **Clients page** | Stats (6 cards), search, filters (All/Active/Needs Attention/Archived), Client Inventory table with Name, Status, Progress, Trend, Weeks, Avg Score, Engagement, Last check-in, Actions; Export/Sort. |
| **APIs** | Stats endpoint; clients list extended or inventory endpoint with aggregates. |
| **Rest of nav** | Filled in as Phase 4 (messages, forms, questions) and Phase 6 (analytics, gallery, payments) are implemented. |

This document is the single reference for "getting it like the old website style" for the coach UX. Update it as we implement or change scope.
