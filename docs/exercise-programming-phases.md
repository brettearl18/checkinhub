# Exercise programming – phased development plan

Mobile-first client experience; gamification (Trainerize-style) in later phases.

---

## Tech / stack (no change)

- **App:** Next.js, React (existing).
- **DB:** Firestore (new collections only).
- **Client UI:** Mobile-first CSS, touch-friendly (min 44px), bottom nav for key actions, optional PWA later.
- **Media:** Firebase Storage for exercise media, or URL-only for MVP.

---

## Phase 1 – Exercise library (coach)

**Goal:** Coach can manage a library of exercises and use it when building programs.

| Deliverable | Detail |
|-------------|--------|
| **Data** | `exercises` collection: `coachId`, `name`, `description`, `category`, `equipment`, `primaryMuscleGroups[]`, `secondaryMuscleGroups[]`, `videoUrl`/`imageUrl`, `isCustom`, `createdAt`. Optional / future: `difficulty`, `movementPattern`, `isUnilateral`, `isCompound`, `bodyRegion`, `coachingCues`, `commonMistakes`, `regressionOptions`, `progressionOptions`, `startingPosition`, `tempo`, `rangeOfMotionNotes`, `safetyNotes` (see `exercise-bulk-import-prompt.md`). |
| **Coach UI** | New nav item "Exercise library" → list (search, filter by category/equipment) → add/edit/delete exercise. Form: name, description, category, equipment, **primary muscle groups**, **secondary muscle groups** (multi-select), media URL. |
| **API** | `GET/POST /api/coach/exercises`, `GET/PATCH/DELETE /api/coach/exercises/[id]`. Scope by `coachId`. |
| **Seed (optional)** | Script or seed data for common exercises so coaches have a starting set. |

**Out of scope for Phase 1:** Client sees nothing; no programs yet.

---

## Phase 2 – Program builder (coach)

**Goal:** Coach can create programs (weeks → days → exercises with sets/reps) and save as templates.

| Deliverable | Detail |
|-------------|--------|
| **Data** | `programs` (or `program_templates`): `coachId`, `name`, `description`, `weeks[]` → `days[]` → `exercises[]` (exerciseId, sets, reps, notes, order). Optional: `durationWeeks`, `phaseName`. |
| **Coach UI** | "Programs" → list templates → "New program" → builder: add week/day, add exercise from library (search/modal), set sets×reps (e.g. "3 × 10", "AMRAP", "30s"), reorder, remove. Save as template. |
| **API** | `GET/POST /api/coach/programs`, `GET/PATCH/DELETE /api/coach/programs/[id]`. |
| **Mobile** | Coach can be desktop; builder can be responsive but optimised for larger screens. |

**Out of scope:** Assigning to client; client view.

---

## Phase 3 – Assign program to client (coach) + client program view (mobile)

**Goal:** Coach assigns a program to a client; client sees "My program" and today’s workout on mobile.

| Deliverable | Detail |
|-------------|--------|
| **Data** | `client_programs`: `clientId`, `coachId`, `programId` (or snapshot of program at assign time), `startDate`, `currentWeek`, `status` (active/completed/paused). Optionally snapshot program so edits to template don’t change existing assignments. |
| **Coach UI** | From client profile or "Programs" → "Assign to client" → pick client, program, start date. List of clients with active program. |
| **Client UI (mobile-first)** | New nav: "Program" or "Workouts". **My program:** current week view; list of days (e.g. "Week 1 – Day 1", "Day 2"…). **Today’s workout:** if today has a session, show it prominently; tap → **session detail** (list of exercises with prescribed sets/reps). Touch targets ≥44px; bottom nav entry for "Workouts". **Later:** client tap on exercise video opens in popup/modal on phone. |
| **API** | `POST /api/coach/clients/[clientId]/program` (assign); `GET /api/client/program`, `GET /api/client/program/today` (or session by date). |
| **Responsive** | Client layout: single column on small screens; cards for each day/session; sticky "Start workout" / "Today’s session". |

**Out of scope:** Logging sets/reps; history; gamification.

---

## Phase 4 – Logging workouts (client mobile)

**Goal:** Client can log what they did (sets, reps, weight) and mark session complete.

| Deliverable | Detail |
|-------------|--------|
| **Data** | `workout_logs` (or `session_logs`): `clientId`, `programId`, `sessionRef` (e.g. week/day), `date`, `completedAt`, `exercises[]` → `sets[]` (reps, weight, RPE, note). Optional: `duration`, `mood`. |
| **Client UI** | In session detail: for each exercise, show prescribed sets; add **log rows** (e.g. "Set 1: 10 reps, 20 kg", "Set 2: 8 reps, 22 kg"). Button "Complete workout" → save log, mark session done. Past sessions: view-only or "View log". |
| **API** | `POST /api/client/workout-log` (create/update log for a session/date), `GET /api/client/workout-log?date=…` or by session. |
| **Coach view** | In client’s program/overview: see completed sessions and optionally last logged weights/reps for exercises (read-only from same `workout_logs`). |
| **Mobile** | Large inputs for reps/weight; minimal typing; quick "Same as last time" or copy previous log. |

---

## Phase 5 – Gamification (Trainerize-style, client mobile)

**Goal:** Streaks, badges, points, achievements to keep clients engaged.

| Deliverable | Detail |
|-------------|--------|
| **Concepts** | **Streaks:** workout streak (e.g. 7 days in a row), check-in streak (existing + program). **Points:** earn X points per workout completed, per check-in, etc. **Badges / achievements:** "First workout", "5 workouts", "10 in a row", "Early bird" (workout before 9am), "Consistent" (4 weeks), etc. **Leaderboard (optional):** per coach or private (just the client’s stats). |
| **Data** | `client_gamification` (or fields on client + new collection): `clientId`, `points`, `workoutStreak`, `workoutStreakLastDate`, `checkInStreak`, `badges[]` (badgeId, earnedAt). `achievements` (or config): `id`, `name`, `description`, `icon`, `criteria` (e.g. `workoutsCompleted >= 5`). |
| **Client UI (mobile)** | **Dashboard widget:** "🔥 7 day streak", "🏆 12 badges", "⭐ 340 points". **Awards / Badges page:** grid of badges (earned vs locked); tap for description. **Activity / History:** simple timeline of "Workout completed", "Check-in done" with points earned. Celebratory micro-copy on session complete ("+10 points", "3 day streak!"). |
| **Logic** | On workout log complete: update streak (compare dates), add points, check achievement rules and grant badge. Optional: nightly job to fix streaks if a day was missed. |
| **Coach view (optional)** | See client’s points/streaks/badges in client profile to encourage and mention in messages. |

**UX details:**  
- Unlock animations or confetti for new badges (lightweight CSS or small Lottie).  
- Progress rings or bars for "Next badge: 2 more workouts".  
- Keep copy positive and simple; avoid clutter on small screens.

---

## Phase 6 – Polish and scale (optional)

- **Program versioning:** Change program template without breaking assigned clients (snapshot on assign).  
- **Exercise media:** Upload video/GIF to Firebase Storage; thumbnails.  
- **Challenges:** Time-bound goals (e.g. "Complete 12 workouts in March") with progress and badge.  
- **PWA / offline:** Cache today’s workout so client can view (and optionally queue log) offline.  
- **Notifications:** "You’ve got a workout today", "Streak at risk – log one more".

---

## Mobile optimisation checklist (client)

- Touch targets ≥44px; spacing between tappable areas.
- Bottom nav for: Home, Workouts (program), Progress (or Check-in), Profile.
- List/cards for sessions and exercises; avoid dense tables on small screens.
- Primary action (e.g. "Start workout", "Complete") fixed or sticky on scroll.
- Forms: large inputs, numeric keypad for reps/weight where possible.
- Loading and empty states: skeleton or message, no blank screens.
- Test on real devices (iOS Safari, Android Chrome) and narrow viewport.

---

## Suggested order of work

1. **Phase 1** – Exercise library (coach).  
2. **Phase 2** – Program builder (coach).  
3. **Phase 3** – Assign + client "My program" / today (mobile-first).  
4. **Phase 4** – Logging workouts (client mobile).  
5. **Phase 5** – Gamification (streaks, points, badges, awards).  
6. **Phase 6** – As needed (versioning, challenges, PWA, etc.).

First implementation step: Phase 1 (Firestore `exercises` + coach CRUD UI and APIs).
