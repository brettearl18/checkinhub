# Phase 3 – Implementation outline

Assign program to client (coach) + client program view (mobile).

---

## Summary

| Area | What we build |
|------|----------------|
| **Data** | `client_programs` collection: one active (or paused) program per client, with program snapshot and week tracking. |
| **Coach** | Assign program from client profile or Programs; pick client + program + start date. See which clients have a program. |
| **Client** | New "Program" / "Workouts" in nav. My program: current week, list of days. Today’s workout prominent → tap to session detail (exercises + sets/reps). |
| **API** | Assign: `POST /api/coach/clients/[clientId]/program`. Client: `GET /api/client/program`, `GET /api/client/program/today` (or session by week/day). |

---

## 1. Data model

**Collection: `client_programs`**

- One doc per client that has an assigned program (or we allow one active at a time and use `clientId` as natural key, or a subcollection under clients).
- **Fields:**
  - `clientId` (string)
  - `coachId` (string)
  - `programId` (string) – reference to the template (for “which program”).
  - **`programSnapshot`** (object) – copy of the program at assign time (name, weeks with days and blocks so edits to the template don’t change this assignment). Same shape as program: `{ name, weeks: [{ days: [{ name, blocks: [{ type, restSeconds, exercises: [{ exerciseId, sets, reps, notes }] }] }] }] }`.
  - `startDate` (date or string YYYY-MM-DD) – program “Week 1” starts on this date (e.g. Monday).
  - `currentWeek` (number, optional) – 1-based; can be updated later for “jump to week” or progress.
  - `status` (string): `"active"` | `"paused"` | `"completed"`.
  - `createdAt`, `updatedAt`.

**Sessions (derived, not a new collection)**  
A “session” = one day of one week (e.g. Week 1 – Day 1). We derive it from `programSnapshot.weeks[weekIndex].days[dayIndex]`. No separate session collection for Phase 3.

---

## 2. API

**Coach: assign (or update) program**

- `POST /api/coach/clients/[clientId]/program`  
  - Body: `{ programId, startDate (YYYY-MM-DD), status? }`.  
  - Load program by `programId`, verify coach owns it, build `programSnapshot`, set `currentWeek: 1`, write `client_programs` (set or merge by clientId so one assignment per client, or create doc with unique id).  
  - Returns the created/updated assignment.

**Coach: list clients with program (optional)**

- Could be done via existing client list + a field “has program”, or `GET /api/coach/programs/assignments` returning list of `{ clientId, clientName?, programName, startDate, currentWeek, status }` for the coach.

**Client: get my program**

- `GET /api/client/program`  
  - Returns the client’s current assignment (program snapshot, startDate, currentWeek, status) or 404/empty if none.  
  - Auth: client only; resolve clientId from token.

**Client: get today’s session (or session by week/day)**

- `GET /api/client/program/today`  
  - Compute which week we’re in from `startDate` + today’s date (e.g. week 1 = startDate to startDate+6, week 2 = startDate+7 to startDate+13).  
  - Optionally “which day” from a simple rule (e.g. same weekday as startDate, or day index by weekday).  
  - Return the session: `{ weekIndex, dayIndex, weekLabel, dayLabel, blocks: [...] }` (blocks with type, restSeconds, exercises; exercise details can be enriched from exercise library by exerciseId if we want names/media).  
- Or `GET /api/client/program/session?week=1&day=0` for a specific week/day so client can open “Week 1 – Day 1” etc.

**Exercise names on client**  
Session payload can include `exerciseId` only; client app can call `GET /api/coach/exercises` (coach-only) or we add a **client-readable** endpoint that returns minimal exercise info (id, name, videoUrl, imageUrl) for the exerciseIds in the program. Simpler: **embed exercise name (and optional media URLs) in the snapshot** when we assign, so client doesn’t need to look up exercises. So when building `programSnapshot`, for each block exercise we store `exerciseId` + `exerciseName` (and optionally `videoUrl`/`imageUrl`) from the coach’s exercise library at assign time.

---

## 3. Coach UI

- **Assign from client profile**  
  - On `/coach/clients/[clientId]` (or a “Program” tab/section), add “Assign program” (or “Program” card).  
  - Modal or page: pick program (dropdown/list from `GET /api/coach/programs`), pick start date, optional status.  
  - Submit → `POST /api/coach/clients/[clientId]/program`.  
  - If client already has a program, show it (name, start date, current week, status) and allow “Change program” or “Pause”.

- **Assign from Programs**  
  - On `/coach/programs`, add “Assign to client” (e.g. per row or a global action).  
  - Opens flow: pick client, then start date (program already chosen).  
  - Same `POST` as above.

- **List of clients with program**  
  - Can be a section on Programs (“Clients on this program”) or a filter on the clients list (“Has program”).  
  - Implement when needed; not strictly required for MVP if assign flow is enough.

---

## 4. Client UI (mobile-first)

- **Nav**  
  - Add “Program” or “Workouts” to client nav (and optionally to bottom nav as “Workouts”).  
  - Route: e.g. `/client/program` (my program overview) and `/client/program/today` or `/client/program/session/[week]/[day]` for session detail.

- **My program (`/client/program`)**  
  - If no assignment: empty state “No program assigned. Ask your coach.”  
  - If assigned: show program name, start date, current week (e.g. “Week 2 of 4”).  
  - List of days for **current week** (e.g. “Week 2 – Day 1: Lower”, “Day 2: Upper”, …).  
  - Each day is a card; tap → session detail for that week/day.  
  - Optional: “Today’s workout” at top – if today has a session (e.g. we define “today” as the session whose weekday matches today), show a prominent card “Today: Day 2 – Upper” and “Start workout” → session detail.

- **Session detail** (e.g. `/client/program/session/[week]/[day]` or `/client/program/today`)  
  - Title: “Week N – Day M: [Day name]”.  
  - List blocks in order; for each block: type (Straight sets / Superset / Circuit), optional “Rest 60s after”, then list of exercises with prescribed sets×reps and notes.  
  - Each exercise: name, sets, reps, notes; later we can add thumbnail/video link that opens in modal (Phase 3 “Later” in the doc).  
  - Touch targets ≥44px; single column.  
  - Optional sticky “Start workout” (could just scroll; “Start” might be Phase 4 when we add logging).

- **Responsive**  
  - Single column on small screens; cards for days and for blocks/exercises.

---

## 5. Implementation order

1. **Data + API (coach assign)**  
   - Create `client_programs` (or single doc per client under `clients/[clientId]/program`).  
   - `POST /api/coach/clients/[clientId]/program`: body programId, startDate; load program, build snapshot (with exercise names), write.  
   - Optionally: GET for coach to see current assignment for a client.

2. **Coach UI: assign**  
   - Client profile: “Program” section + “Assign program” → pick program, start date → POST.  
   - Or/and from Programs list: “Assign to client” → pick client, start date → POST.

3. **API (client)**  
   - `GET /api/client/program` – my assignment (snapshot, startDate, currentWeek, status).  
   - `GET /api/client/program/today` – which week/day is “today” and return that session (or `GET /api/client/program/session?week=1&day=0`).

4. **Client UI**  
   - Nav: add Program/Workouts.  
   - `/client/program`: My program (current week, list of days); no assignment → empty state.  
   - Session detail page: list blocks and exercises with sets/reps/notes; optional “Today” entry point.

5. **Polish**  
   - “Today’s workout” prominent on program home; rest timer (Phase 3 “Later” or Phase 4); video modal (doc says “Later”).

---

## 6. Out of scope for Phase 3

- Logging sets/reps (Phase 4).  
- Workout history / completed sessions (Phase 4).  
- Gamification (Phase 5).

---

Next step: implement in the order above (data model + assign API first, then coach assign UI, then client API + client program pages).
