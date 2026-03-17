# Fitness programming – how coaches design client programs

High-level overview for product and engineering: how fitness coaches think about and structure programs, and how that maps to data and UX.

---

## 1. What coaches are doing

Coaches design **programs** (templates) that define **what** the client does over time: which exercises, how many sets and reps, how exercises are grouped (e.g. supersets), and how much rest to take. Programs are then **assigned** to a client with a start date; the client follows the program week by week (and later may log what they did).

Core concepts coaches use:

- **Periodization** – Planning in phases (e.g. 4 weeks “hypertrophy”, then 4 weeks “strength”) with different goals and intensities.
- **Volume and intensity** – Sets × reps × load; coaches manipulate these across weeks (e.g. ramp volume, then deload).
- **Exercise selection and order** – Main lifts first, accessories after; push/pull balance; movement patterns (squat, hinge, push, pull, carry).
- **Rest and density** – Rest between sets (e.g. 90s for strength, 60s for hypertrophy); grouping exercises (supersets, circuits) to control time and fatigue.
- **Progression** – How the client advances: add weight, add reps, add sets, or change difficulty of the exercise.

So the **core** of “how coaches write programs” is: **phases → weeks → days → blocks of work (straight sets, supersets, circuits) with sets, reps, and rest.**

---

## 2. Program structure (hierarchy)

Typical mental model:

```
Program (e.g. "12-Week Strength")
  ├── Meta: name, description, duration (weeks), phase name (optional)
  ├── Week 1, Week 2, … Week N
  │     ├── Day 1 (e.g. "Lower")
  │     │     ├── Block 1: Straight sets – Squat 3×8, rest 90s
  │     │     ├── Block 2: Superset – Leg curl + Leg extension, 2×12, rest 60s after each round
  │     │     └── Block 3: Straight sets – Calf raise 3×15, rest 45s
  │     ├── Day 2 (e.g. "Upper")
  │     └── …
  └── …
```

- **Program** = the whole template (often multi-week, multi-phase).
- **Week** = one week of the plan (Week 1, 2, …); sometimes coaches think in “microcycles”.
- **Day** = one session (e.g. “Lower”, “Push”, “Day 1”). A day contains **blocks**.
- **Block** = one unit of work the client does before resting:
  - **Straight sets:** one exercise, multiple sets, rest between sets (e.g. Squat 3×8, rest 90s).
  - **Superset:** 2 (or 3) exercises done back-to-back; rest after each “round” (e.g. A then B, rest 60s, repeat).
  - **Circuit:** 3+ exercises in sequence; rest after each full round (often used for conditioning or time efficiency).

Within each block, **exercises** have prescribed **sets**, **reps** (or “30s”, “AMRAP”, etc.), and optional **notes**. **Rest** is specified per block (between sets for straight sets, after each round for superset/circuit).

---

## 3. Sets, reps, and notes

- **Sets** – Number of working sets (e.g. 3, 4). Sometimes “warm-up” is implied or noted separately.
- **Reps** – Target reps per set (e.g. 8, 10), or time (“30s”), or effort (“AMRAP”, “RPE 8”).
- **Notes** – Cues, weight ranges, “same as last week”, or progression rules. Coaches use this for context the client sees in-session.

So “add sets” in the product means: the coach can define **how many sets** (and reps) for each exercise in a block; we already have sets/reps fields—the improvement is **grouping** (blocks, supersets) and **rest**.

---

## 4. Supersets (and circuits)

- **Superset** = two (or three) exercises performed back-to-back with little or no rest between them; then rest; then repeat for the next set/round.
- Coaches use supersets to:
  - Save time (pair opposing or non-competing movements).
  - Increase density (more work in less time).
  - Manage fatigue (e.g. push then pull).

So the product must let the coach **indicate** that a group of exercises is a superset (and optionally a circuit). That’s the **block type**: `straight_sets` (one exercise), `superset` (2–3 exercises), `circuit` (3+).

---

## 5. Rest between exercises and sets

- **Rest between sets** (straight sets): e.g. 90 seconds after each set of squats. Coaches choose this by goal (strength = longer, hypertrophy = moderate, conditioning = shorter).
- **Rest after a superset/circuit round**: after completing all exercises in the block once, the client rests (e.g. 60–90s), then repeats.

So we need a **rest** value per block, stored in seconds, so the app can:
- Show the client “Rest 1:30” and run a **countdown timer** (and optionally a stopwatch for ad-hoc rest).
- Optionally surface presets in the builder (30s, 60s, 90s, 2 min).

---

## 6. How this maps to our product

| Coach concept | In the product |
|---------------|-----------------|
| Program | Program template (name, description, duration, phase). |
| Weeks / days | Weeks[] → Days[] (each day has a name, e.g. “Day 1”, “Lower”). |
| “This is a superset” | Block type = `superset`; block contains 2+ exercises. |
| “Rest 90s between sets” | Block has `restSeconds: 90` (for straight sets = between sets). |
| “Rest 60s after each superset round” | Block has `restSeconds: 60` (for superset/circuit = after each round). |
| Sets and reps | Per-exercise within block: `sets`, `reps`, `notes`. |
| Add sets / indicate supersets / rest | Builder: add **blocks** (Straight sets | Superset | Circuit), add exercises to the block, set sets/reps/notes and optional **Rest** (seconds). Client view: show blocks, show rest countdown when they finish a set/round. |

So the **core** of fitness programming in the app is: **blocks** (with type and rest) and **exercises inside blocks** (with sets, reps, notes). The CTO-level doc is this file; the concrete data shape and UX are in `program-builder-modern-design.md` and the phased plan in `exercise-programming-phases.md`.

---

## 7. Implementation status (phases)

We track progress in phases; full detail is in **`exercise-programming-phases.md`**. Summary here:

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Exercise library (coach CRUD, Firestore `exercises`) | ✅ Done |
| **2** | Program builder (weeks → days → blocks: straight sets / superset / circuit, rest, sets/reps/notes) | ✅ Done |
| **3** | Assign program to client + client “My program” / session view; coach “View program” | ✅ Done |
| **4** | Logging workouts (client logs sets/reps/weight, complete session; coach sees completion/logs) | 🔜 Next |
| **5** | Gamification (streaks, points, badges) | Planned |
| **6** | Polish (versioning, challenges, PWA, etc.) | Optional |

When a phase is completed, update this table and the detailed plan in `exercise-programming-phases.md`.
