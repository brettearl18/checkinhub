# Cost, API usage & page speed

This doc summarises where costs and API usage come from, and how page speed is affected, so you can keep everything under control.

## Main cost drivers

### 1. **Firebase / Firestore**

- **Reads:** You are charged per document read. Each `.get()` on a collection or document, and each document returned by a query, counts.
- **Writes:** Each `.set()`, `.update()`, `.add()` counts.
- **Auth:** Firebase Auth (token verification) has its own usage; typically small unless you have very high traffic.

**Per authenticated request:**  
Every API that uses `requireCoach` or `requireClient` runs `getIdentityFromToken`, which does:
- 1 read: `users/{uid}`
- For clients: often 1 read (`clients/{uid}`) or 1 query (`clients` where `authUid == uid`)

So **each API call adds ~1–3 Firestore reads** before your route logic.

### 2. **Heavier endpoints**

| Endpoint | What it does | Approx. reads (example) |
|----------|----------------|--------------------------|
| **GET /api/coach/habits** | Habits overview for all clients | 1 (clients) + batched habit entries (see below). Cached 60s per coach to avoid repeat hits. |
| **GET /api/coach/clients/inventory** | Client list + weights, check-ins, payments | 1 clients query + chunked queries (measurements, assignments, responses). Scales with client count. |
| **GET /api/coach/clients/[id]/progress** | One client’s progress (charts, forms, questions) | Client + measurements + goals + images + responses + scoring + forms + questions. Dozens of reads per load. |
| **GET /api/coach/check-ins** | All check-ins for coach | Clients + chunked formResponses + coachFeedback. |
| **POST /api/cron/check-in-reminders** | Friday/Monday reminders | 1 assignment query + per client: 1 client doc (+ optional users query) + 1 notification write + push tokens query + FCM send. |

**Coach Habits overview:**  
Previously this did one `habitEntries` query per client (N+1). It’s now:

- **Batched:** habit entries are fetched with `clientId in [up to 30 ids]` so we do **ceil(N/30)** queries instead of N (same total document reads, fewer round-trips).
- **Cached:** Result is cached for **60 seconds** per coach so refreshing the Habits page doesn’t hit Firestore every time.

### 3. **Client-side behaviour**

- There is **no polling or auto-refresh** on a timer; data is loaded on mount/navigation.
- Pages that need fresh data (e.g. after submitting a habit) refetch once after the mutation.
- No `setInterval`-driven API calls were found.

So **APIs are not called excessively from the client**; the main lever is how often users open heavy pages (e.g. coach Habits, Progress, inventory).

### 4. **Cron**

- **POST /api/cron/check-in-reminders** is intended to be called **externally** (e.g. Vercel Cron or a scheduler) **at most a few times per day** (e.g. Friday 10am, Monday 5pm).
- It is protected by `CRON_SECRET`; do not call it from the client.
- Each run: one assignment query, then per eligible client a few reads + one notification write + push send. Total cost scales with number of clients with open check-ins.

### 5. **Stripe**

- Used for payments and subscriptions; cost is per Stripe API call (e.g. creating customers, subscriptions, webhooks). Billing pages and webhooks are the main callers; usage is event-driven, not high-frequency.

### 6. **Vercel**

- Serverless invocations and bandwidth. Each API request is one invocation; cold starts can add latency. Reducing unnecessary or duplicate API calls (e.g. caching coach habits) helps.

---

## Recommendations

1. **Avoid calling heavy coach endpoints in a loop** from the client (e.g. don’t call `/api/coach/clients/[id]/habits` for every client to build an overview; use **GET /api/coach/habits** instead, which is batched and cached).
2. **Keep cron schedule minimal** (e.g. 2–3 times per day for check-in reminders).
3. **Coach Habits overview** is cached for 60 seconds; if you need fresher data, reduce the `revalidate` in the route (or remove caching and accept higher read usage).
4. **Firestore indexes:** Ensure composite indexes exist for any query you run (Firebase console will prompt when a query needs one). Missing indexes can cause failures or slow queries.
5. **Monitor in Firebase Console:** Use Firestore “Usage” and “Usage and billing” to watch read/write trends over time.

---

## Quick reference: APIs that do many reads

- `GET /api/coach/habits` – all clients’ habit summaries (batched + 60s cache).
- `GET /api/coach/clients/inventory` – client list + extra data in chunks.
- `GET /api/coach/clients/[clientId]/progress` – one client, many collections.
- `GET /api/coach/check-ins` – assignments + responses + feedback in chunks.

Opening these pages is when most Firestore reads occur; caching and batching are in place where it matters most.

---

## APIs loaded every time a coach accesses the app

### Once per session (auth)

When the coach loads the app or their Firebase session is restored, **one** call runs before any coach page:

| API | When |
|-----|------|
| **GET /api/me** | Once when `onAuthStateChanged` fires (page load or tab open). Resolves role, coachId, name, etc. |

So: **1 API call** for auth, then the first page they land on runs its own calls.

### Per page (on first visit to that page)

Each coach route fetches only what it needs on mount. No global “load everything” — so the number of APIs depends on **which page** they open.

| Page | # of APIs on load | APIs called |
|------|--------------------|-------------|
| **Dashboard** (`/coach`) | **2** | `GET /api/coach/dashboard`, `GET /api/coach/clients/inventory` (in parallel) |
| **Clients** (`/coach/clients`) | **1** | `GET /api/coach/clients/inventory` |
| **Habits** (`/coach/habits`) | **1** | `GET /api/coach/habits` |
| **Check-ins** (`/coach/check-ins`) | **1** | `GET /api/coach/check-ins` |
| **Messages** (`/coach/messages`) | **1** then more | `GET /api/coach/conversations`; then `GET /api/coach/conversations/[id]/messages` when they pick a conversation |
| **Notifications** (`/coach/notifications`) | **1** | `GET /api/coach/notifications` |
| **Payments** (`/coach/payments`) | **1** | `GET /api/coach/payments` |
| **Gallery** (`/coach/gallery`) | **1** | `GET /api/coach/gallery` |
| **Forms** (`/coach/forms`) | **2** | `GET /api/coach/forms`, `GET /api/coach/forms/standards` (in parallel) |
| **Form edit** (`/coach/forms/[id]/edit`) | **2** | `GET /api/coach/forms/[id]`, `GET /api/coach/questions` (in parallel) |
| **Questions** (`/coach/questions`) | **1** | `GET /api/coach/questions` |
| **Client detail** (`/coach/clients/[id]`) | **2** | `GET /api/coach/clients`, `GET /api/coach/clients/[id]/check-ins` (in parallel) |
| **Client Habits** (`/coach/clients/[id]/habits`) | **2** | `GET /api/coach/clients`, `GET /api/coach/clients/[id]/habits` (in parallel) |
| **Client Progress** (`/coach/clients/[id]/progress`) | **1** | `GET /api/coach/clients/[id]/progress` |
| **Client Settings** (`/coach/clients/[id]/settings`) | **1** then more | `GET /api/coach/clients/[id]/profile` on load; billing (subscription, prices, history) when they open that section |
| **Client response** (`/coach/clients/[id]/responses/[rid]`) | **2** | `GET .../responses/[rid]`, `GET .../responses/[rid]/feedback` (in parallel) |
| **Payments (client)** (`/coach/payments/[id]`) | **2** | `GET /api/coach/clients/[id]/profile`, `GET /api/coach/clients/[id]/billing/history` (in parallel) |

### Example: coach opens the app and goes to dashboard

1. **1** call: `/api/me` (auth).
2. **2** calls in parallel: `/api/coach/dashboard`, `/api/coach/clients/inventory`.

**Total: 3 API calls** for “coach accesses dashboard”.

If they then click **Clients**, the Clients page runs **1** more call (`/api/coach/clients/inventory`). If they had landed on Clients first, it would be 1 (auth) + 1 (inventory) = **2** calls for that first view.

### Summary

- **Auth:** 1 call (`/api/me`) once per session.
- **Per page:** 1–2 APIs on first visit to that page (parallel where there are 2).
- **No polling:** Revisiting a page triggers the same 1–2 calls again (no background refresh loop).

So the total number of APIs “every time a coach accesses” is: **1 (auth) + (1 or 2 for the page they open)**. If they open Dashboard first, that’s **3** calls total; if they open Habits first, that’s **2** calls total.

---

## Page speed & performance

### What affects speed

| Factor | Where it matters |
|--------|-------------------|
| **TTFB (Time to First Byte)** | Every page. Affected by API latency (Firestore, cold starts on Vercel). |
| **API latency** | Pages that fetch data on load (dashboard, progress, habits, inventory). Heavy endpoints (see table above) take longer. |
| **Client JS bundle** | First load. Large libraries (e.g. Recharts for charts) increase parse/compile time. |
| **Main thread** | Charts and large lists. Recharts and table rendering can add work after data arrives. |

### Pages that tend to be slower

| Page | Why |
|------|-----|
| **Client dashboard** (`/client`) | Loads 4 APIs in parallel (profile, assignments, history, images). Good: parallel not sequential. Speed depends on network and API response time. |
| **Coach Habits** (`/coach/habits`) | One API that does batched Firestore reads; cached 60s. First load after cache miss can be slower with many clients. |
| **Coach Clients / inventory** (`/coach/clients`) | One heavy API (clients + measurements + assignments + responses in chunks). Scales with client count. |
| **Coach client Progress** (`/coach/clients/[id]/progress`) | Many Firestore reads + chart (Recharts). Chart is lazy-loaded so it doesn’t slow other coach pages. |
| **Client Measurements** (`/client/measurements`) | One API + chart. Chart is lazy-loaded. |
| **Client Progress** (`/client/progress`) | API + traffic-light grid. No chart on this page. |

### How to check speed

1. **Chrome DevTools → Network**  
   Reload the page. Check “Waiting (TTFB)” and total load time for the document and API requests. Filter by “Fetch/XHR” to see API timing.

2. **Chrome DevTools → Performance**  
   Record a page load, then look at “Loading”, “Scripting”, “Rendering”. Identifies long tasks and heavy JS.

3. **Lighthouse** (DevTools → Lighthouse)  
   Run “Performance” for LCP, TBT, CLS. Use “Analyze page load” to see what’s slow (often TTFB or “Reduce JavaScript execution time”).

4. **Real user**  
   In production, Vercel Analytics (if enabled) and Firebase Performance Monitoring can show real-user timings.

   **Finding the slow request:** In Performance you may see a long bar like `getProje...` — that is often Firebase Auth (e.g. getProjectConfig). Open **Network**, reload, filter Fetch/XHR, sort by **Time**, to see the full URL and whether the delay is your APIs or Firebase. Browser extensions (Phantom, Loom, VPN, etc.) also show in Bottom-up and add main-thread time; focus on your domain and API requests when judging speed.

### What's already in place

- **Parallel fetches:** Client dashboard uses `Promise.all` for profile, assignments, history, images (one round-trip instead of four sequential).
- **Batched + cached coach habits:** Fewer Firestore round-trips and 60s cache to avoid repeat work.
- **Lazy-loaded charts:** `MeasurementLineChart` (Recharts) is loaded only on the pages that show charts (coach Progress, client Measurements), so the rest of the app doesn’t pay the Recharts bundle cost on first load.

### Optional improvements

- **Cache-Control on APIs:** For responses that can be stale briefly (e.g. coach habits), the route already uses `unstable_cache`. You could add `Cache-Control: private, max-age=60` in the response for CDN/browser hints (if you put a CDN in front).
- **Vercel:** Ensure the app runs in a region close to your users to reduce TTFB.
- **Firestore:** Keep indexes in place; slow queries increase API duration and thus page load time.
