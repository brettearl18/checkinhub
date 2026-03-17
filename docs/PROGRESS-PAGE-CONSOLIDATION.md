# Client Progress Page – Consolidation Plan (CTO)

## Goal
Bring all measurable progress onto **one** client Progress page:
1. **Weight & measurement graphs**
2. **Habit trackers** (This week / 1 month / All time)
3. **Baseline (first before) vs current photo** – side-by-side

Existing **Question progress over time** (traffic-light grid) stays on the same page as the first section.

---

## Current State

| Area | Location today | Data source |
|------|----------------|-------------|
| Question progress | `/client/progress` | `GET /api/client/question-progress` |
| Weight/measurement chart | `/client/measurements` | `GET /api/client/measurements` |
| Habit strip | `/client/habits` | `GET /api/client/habits` (includes `history`) |
| Photos | `/client/progress-photos` | `GET /api/client/progress-images` |

No new APIs required; we reuse existing endpoints.

---

## Proposed Page Structure (top → bottom)

1. **Page title**  
   - e.g. “Progress”  
   - Subtitle: “Question scores, measurements, habits, and photos in one place.”

2. **Question progress over time** (existing)  
   - Keep current traffic-light grid and legend.  
   - Optional later: make this section collapsible.

3. **Weight & measurement trends**  
   - One chart (same as Measurements “Trends”): body weight + measurement metrics.  
   - Metric selector: Body weight (kg) + Waist, Hips, Chest, etc. (cm).  
   - Reuse `MeasurementLineChartLazy` + same chart data logic as Measurements page.  
   - Fetch: `GET /api/client/measurements`.  
   - Empty state: “No measurements yet” + link to **Measurements** to add.

4. **Habit trackers**  
   - Embed the same strip as on Habits: time-scale tabs (This week / 1 month / All time) + `HabitWeeklyStrip`.  
   - Fetch: `GET /api/client/habits` (use `habits`, `history.byDate`, `history.start`, `history.end`).  
   - Empty state: “No habit data this period” or link to **Habits** to log.

5. **Before & current photos**  
   - **Side-by-side** (or two large slots):  
     - **Left:** “Baseline / First before” = earliest photo with `imageType` in `before_front` / `before_side` / `before_back` (or single “before” if we simplify).  
     - **Right:** “Current” = most recent “after_*” photo, or failing that the most recent photo overall.  
   - Fetch: `GET /api/client/progress-images` (already returns list ordered by `uploadedAt` desc; client can derive first before + latest current).  
   - Empty state: “Add a before photo” / “Add your current photo” + link to **Photos** to upload.

---

## Data Loading

- **Single page load:** Progress page calls in parallel:
  - `GET /api/client/question-progress`
  - `GET /api/client/measurements`
  - `GET /api/client/habits`
  - `GET /api/client/progress-images`
- **Per-section UX:** Each section has its own loading and empty state so one slow or empty API doesn’t block the others (e.g. show “Loading…” for that block only).

---

## Components to Use / Add

| Section | Component | Notes |
|--------|-----------|--------|
| Question progress | Existing table + legend | No change. |
| Weight/measurement | `MeasurementLineChartLazy` | Same as Measurements page; build `chartData` from measurements list (bodyWeight + measurement keys). |
| Habits | `HabitWeeklyStrip` | Already supports `range`, `history.byDate`, `historyStart`, `historyEnd`. |
| Photos | New small block or `ProgressPhotosCompare` | Two slots: baseline image (earliest before_*) and current image (latest after_* or latest). Use existing `Image` + aspect ratio; link “Add photo” to `/client/progress-photos`. |

---

## Navigation & Links

- **Measurements**, **Habits**, **Photos** stay in the sidebar.
- On Progress, add short CTAs where relevant:
  - “Add measurement” → `/client/measurements`
  - “Log habits” / “View habits” → `/client/habits`
  - “Upload before/after photo” → `/client/progress-photos`

---

## Implementation Order

1. **Data layer**  
   Progress page: add fetches for measurements, habits, progress-images alongside question-progress; hold in state (or small data hooks).

2. **Weight & measurement section**  
   Add section below question progress; reuse measurement list → chart data logic; render `MeasurementLineChartLazy` + metric select; empty state + link to Measurements.

3. **Habit strip section**  
   Add section; pass `habits`, `history.byDate`, `range`, `historyStart`/`historyEnd` into `HabitWeeklyStrip`; empty state + link to Habits.

4. **Before vs current photos section**  
   Add section; derive baseline (earliest before_*) and current (latest after_* or latest); render side-by-side; empty states + link to Photos.

5. **Copy and polish**  
   Page title/subtitle; section headings; consistent empty states and CTAs.

---

## Out of Scope (for this consolidation)

- Changing how question progress or traffic lights work.
- Moving “Add measurement” form or “Log habit” actions off their dedicated pages (we only link to them from Progress).
- New progress-images API fields (e.g. “isBaseline”); derivation from existing `imageType` + `uploadedAt` is enough for baseline vs current.

---

## Summary

| Section | Source | Reuse | New |
|--------|--------|--------|-----|
| Question progress | Existing | ✅ | |
| Weight/measurement graph | Measurements | ✅ Chart + logic | Section + fetch on Progress |
| Habit trackers | Habits | ✅ HabitWeeklyStrip | Section + fetch on Progress |
| Before vs current | Progress images | ✅ List API | Section + derive before/current + side-by-side UI |

Result: one **Progress** page with question scores, weight/measurement trends, habit strip, and baseline vs current photos, with links to Measurements, Habits, and Photos for adding data.
