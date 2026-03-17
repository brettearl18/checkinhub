# Program builder – modern design (supersets, rest, timers)

High-level direction for evolving the program builder to support **blocks** (supersets, circuits), **rest periods**, and **client-side rest timers**.

---

## Where we are now

- **Structure:** Program → Weeks → Days → **flat list of exercises** (exerciseId, sets, reps, notes).
- **Gap:** No way to express “do A then B with no rest, then rest 90s” (superset), or “rest 60s between sets”, or “circuit: A → B → C → rest → repeat”.

---

## Modern pattern: blocks as the building unit

In tools like Trainerize, TrueCoach, TrainHeroic, and Hevy, the day is not a flat list of exercises. It’s a list of **blocks**. Each block can be:

| Block type        | Meaning | Typical use |
|-------------------|--------|-------------|
| **Straight sets** | One exercise, N sets × reps, rest between sets | Classic strength: “3 × 10 Bench” |
| **Superset**      | 2 (or 3) exercises done back-to-back; rest after each “round” | A → B → rest → repeat |
| **Circuit**       | 3+ exercises in sequence; rest after each full round | Conditioning, circuits |
| **EMOM / AMRAP / For time** | Time or effort based | Optional later |

So the hierarchy becomes:

```
Program
  → Weeks[]
      → Days[]
          → Blocks[]        ← NEW
              → type: "straight_sets" | "superset" | "circuit"
              → restSeconds?: number   (rest after this block / after each round)
              → exercises[]  (1 for straight_sets, 2+ for superset/circuit)
                  → exerciseId, sets, reps, notes
```

- **Straight sets:** 1 exercise; `restSeconds` = rest **between sets** (e.g. 90s).
- **Superset / circuit:** 2+ exercises; `restSeconds` = rest **after each round** (after completing all exercises in the block once).

This gives you supersets and rest in one consistent model.

---

## Rest and timers

### Coach side (builder)

- Per **block**, optional **Rest** field: e.g. “90 sec” (between sets or after round).
- Stored as `restSeconds` (number) so the app can drive a countdown.
- Presets in the UI help: 30s, 60s, 90s, 2 min, 3 min.

### Client side (during workout) – Phase 3/4

- When the client is in “session view” and finishes a set (or a superset round), show:
  - **“Rest 1:30”** with a **countdown timer** (e.g. 90 → 0).
  - Optional: **Stopwatch** for “rest as long as you want” (no prescribed rest), or a **Start rest** button that starts the countdown from the prescribed duration.
- Same timer component can be used for:
  - **Rest countdown** (preset 90s, 60s, etc.).
  - **Work intervals** later (e.g. “30s on / 30s off” for EMOM-style).

So: coach sets **rest duration** in the builder; client gets a **rest timer (countdown)** (and optionally a stopwatch) when doing the workout.

---

## Data model evolution

### Option A – Add blocks, keep backward compatibility

- Keep current **days** with **exercises[]** for existing programs.
- Add optional **blocks[]** on the day:
  - If `day.blocks` is present and non-empty, render the day from blocks (each block has type, restSeconds, exercises).
  - Else, treat `day.exercises` as a single implicit “straight sets” block per exercise (restSeconds undefined).
- New programs use blocks only; old programs still load and display.

### Option B – Migrate to blocks only

- **Day** has only **blocks[]**.
- Each block: `type`, `restSeconds?`, `exercises[]`.
- Migrate existing programs: each current exercise becomes one block of type `straight_sets` with one exercise.

Recommendation: **Option A** so we can ship block-based building and timers without a big migration; later you can migrate old programs to blocks and drop the legacy path.

---

## Builder UI (high level)

1. **Day level:** Add **block** (not just “add exercise”). Choose block type: Straight sets | Superset | Circuit.
2. **Straight sets block:** Add one exercise from library; sets, reps, notes; optional **Rest** (e.g. 90 sec).
3. **Superset block:** Add 2+ exercises; sets/reps/notes per exercise; optional **Rest after each round**.
4. **Circuit block:** Same as superset but 3+ exercises; optional **Rest after each round**.
5. **Reorder:** Move blocks up/down; within a superset/circuit, reorder exercises.
6. **Rest field:** Dropdown or number input + “sec”/“min”; save as `restSeconds`.

No stopwatch in the **builder**; the stopwatch/rest countdown lives in the **client workout view** (when they’re doing the session).

---

## Summary

| Need | Approach |
|------|----------|
| **Supersets / circuits** | Introduce **blocks** per day: type = straight_sets \| superset \| circuit; each block has 1 or 2+ exercises. |
| **Rests** | Per-block **restSeconds** (between sets for straight sets, after each round for superset/circuit). |
| **Timer** | **Client-side** rest countdown (and optional stopwatch) when the client is in the session, driven by `restSeconds`. |
| **Builder** | “Add block” → choose type → add exercise(s) → set sets/reps/notes and optional rest. |

Next concrete steps could be: (1) extend the program data model with optional `blocks` and `restSeconds`, (2) update the coach builder to add/edit blocks and rest, (3) in the client session view, add a rest countdown (and optional stopwatch) using `restSeconds`. If you want, we can turn this into a short “Phase 2b” in `exercise-programming-phases.md` and then implement step by step.
