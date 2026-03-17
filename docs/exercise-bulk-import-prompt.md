# Bulk exercise import – ChatGPT prompt

Use the prompt below in ChatGPT to generate a list of exercises that match our app’s schema. You can then use the output for a bulk-import script or paste into a spreadsheet and import via API.

---

## Copy-paste prompt for full schema (JSON)

**Use this prompt to generate a JSON array.** Replace `[N]` with the number of exercises (e.g. `50`). The app now supports the full schema below.

```
You are helping build a bulk list of exercises for a fitness app. Generate a valid JSON array of [N] exercises. Each object in the array must have the keys below. Use only the allowed values shown.

**Required:** name (string). All other fields are optional but must use the types and allowed values below.

**Allowed values (use exactly as written):**
- category: one of "Strength", "Cardio", "Mobility", "Flexibility", "Other"
- equipment: one of "Bodyweight", "Dumbbells", "Kettlebell", "Resistance Band", "Barbell", "Machine", "Cable", "Other"
- primaryMuscleGroups / secondaryMuscleGroups: arrays of strings from "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Hip flexors", "Other"
- difficulty: one of "Beginner", "Intermediate", "Advanced"
- movementPattern: one of "Squat", "Hinge", "Push", "Pull", "Lunge", "Carry", "Rotational", "Other"
- bodyRegion: one of "Upper", "Lower", "Full body", "Core"

**Fields per exercise (use empty string "" or empty array [] when not applicable):**
- name (string, required)
- description (string)
- category (string, from list above)
- equipment (string, from list above)
- primaryMuscleGroups (array of strings from muscle list)
- secondaryMuscleGroups (array of strings from muscle list)
- videoUrl (string, URL or "")
- imageUrl (string, URL or "")
- difficulty (string, from list above)
- movementPattern (string, from list above)
- isUnilateral (boolean)
- isCompound (boolean)
- bodyRegion (string, from list above)
- coachingCues (array of strings, e.g. ["Drive knees out", "Squeeze glutes at top"])
- commonMistakes (array of strings, e.g. ["Rounding lower back", "Knees caving"])
- regressionOptions (array of strings, e.g. ["Box squat", "Goblet squat"])
- progressionOptions (array of strings, e.g. ["Add weight", "Pistol squat"])
- startingPosition (string, e.g. "Standing", "Seated", "Prone")
- tempo (string, e.g. "3-1-2-0" or "Controlled", "Explosive")
- rangeOfMotionNotes (string)
- safetyNotes (string)

Output only a single valid JSON array. No markdown, no code fence, no trailing commas. Example of one element:

{"name":"Barbell Back Squat","description":"Stand with feet shoulder-width apart, bar on upper back. Brace core, break at hips and knees, lower until thighs at least parallel. Drive through heels to stand. Keep chest up and knees in line with toes.","category":"Strength","equipment":"Barbell","primaryMuscleGroups":["Quadriceps","Glutes"],"secondaryMuscleGroups":["Core","Hamstrings"],"videoUrl":"","imageUrl":"","difficulty":"Intermediate","movementPattern":"Squat","isUnilateral":false,"isCompound":true,"bodyRegion":"Lower","coachingCues":["Drive knees out","Squeeze glutes at top"],"commonMistakes":["Rounding lower back","Knees caving in"],"regressionOptions":["Box squat","Goblet squat"],"progressionOptions":["Add weight","Pause squat"],"startingPosition":"Standing","tempo":"3-1-2-0","rangeOfMotionNotes":"Thighs at least parallel to floor.","safetyNotes":"Do not round lower back. Avoid if knee pain."}

Generate the full array of [N] exercises in this exact format.
```

**Variants:** Replace `[N]` with a number (e.g. 30). For a themed list, add e.g. "focused on glutes and hamstrings" or "bodyweight only". For video URLs add: "Where possible provide a real videoUrl (YouTube) for each exercise; otherwise use empty string."

---

## Current schema vs full (target) schema

**Currently in the app (Phase 1 MVP):**  
`name`, `description`, `category`, `equipment`, `primaryMuscleGroups`, `secondaryMuscleGroups`, `videoUrl`, `imageUrl`, plus `coachId`, `isCustom`, `createdAt`/`updatedAt` (set by backend).

**Required vs optional (full schema):**  
Only **`name`** is required. **`category`** is strongly recommended. All other fields (including the ones below) are optional so coaches can add exercises quickly and enrich over time.

**Missing from current schema** (matter for a real, coach-grade library):

| Field | Type | Purpose / allowed values |
|-------|------|---------------------------|
| `difficulty` | string | Exactly one of: Beginner, Intermediate, Advanced (v1). Filter/display for client level. |
| `movementPattern` | string | Exactly one of: Squat, Hinge, Push, Pull, Lunge, Carry, Rotational, Other. Program design. |
| `isUnilateral` | boolean | One limb at a time (e.g. single-leg RDL). Affects programming and cues. |
| `isCompound` | boolean | Multi-joint vs isolation. Program structure. |
| `bodyRegion` | string | Exactly one of: Upper, Lower, Full body, Core. Quick filter / day split. |
| `coachingCues` | **string[]** | Short cues in-session (e.g. "Drive knees out", "Squeeze glutes at top"). Stored as array; import accepts string or string[] and normalizes to array. |
| `commonMistakes` | **string[]** | What to avoid (e.g. "Rounding lower back", "Knees caving"). Same normalize rule. |
| `regressionOptions` | **string[]** | Easier versions (e.g. "Box squat", "Goblet squat"). Same normalize rule. |
| `progressionOptions` | **string[]** | Harder progressions (e.g. "Add weight", "Pistol squat"). Same normalize rule. |
| `startingPosition` | string | How to set up (e.g. Standing, Seated, Prone). |
| `tempo` | string | e.g. "3-1-2-0" or "Controlled", "Explosive". Optional. |
| `rangeOfMotionNotes` | string | Depth, ROM cues (e.g. "Thighs at least parallel"). |
| `safetyNotes` | string | Warnings (e.g. "Avoid if knee pain", "Do not round spine"). |

When we add these to the API and Firestore, the **full prompt** below can be used to generate JSON that includes them. Until then, use the **starter prompt** and strip or ignore the extra keys on import.

---

## Field mapping (ChatGPT → our app)

### Current (implemented) fields

| You say / CSV column | Our API field | Notes |
|----------------------|----------------|-------|
| Title / Name | `name` | Required. Exercise display name. |
| Exercise type | `category` | **Must be exactly one of:** Strength, Cardio, Mobility, Flexibility, Other |
| Equipment | `equipment` | **Must be exactly one of:** Bodyweight, Dumbbells, Kettlebell, Resistance Band, Barbell, Machine, Cable, Other |
| Primary muscles | `primaryMuscleGroups` | Array of strings. **Use only:** Chest, Back, Shoulders, Biceps, Triceps, Forearms, Core, Quadriceps, Hamstrings, Glutes, Calves, Hip flexors, Other |
| Secondary muscles | `secondaryMuscleGroups` | Same options as primary. Can be empty. |
| Instructions / Description | `description` | Plain text. Step-by-step cues, form notes, etc. |
| Video URL | `videoUrl` | Full URL (YouTube, Vimeo, etc.) or empty. |
| Image URL | `imageUrl` | Full URL to image or empty. |

### Target (not yet in API) fields

Use these in the **full prompt** when we support them: `difficulty`, `movementPattern`, `isUnilateral`, `isCompound`, `bodyRegion`, `coachingCues` (string[]), `commonMistakes` (string[]), `regressionOptions` (string[]), `progressionOptions` (string[]), `startingPosition`, `tempo`, `rangeOfMotionNotes`, `safetyNotes`. See table above for allowed values; list fields normalize string → [string] on import.

---

## Copy-paste prompt for ChatGPT

```
You are helping build a bulk list of exercises for a fitness app. Generate a list of [N] exercises (or a specific list, e.g. "50 common gym exercises" or "20 bodyweight home exercises").

For each exercise, provide:

1. **name** – Short title (e.g. "Barbell Back Squat", "Dumbbell Chest Press").
2. **category** – Exactly one of: Strength, Cardio, Mobility, Flexibility, Other.
3. **equipment** – Exactly one of: Bodyweight, Dumbbells, Kettlebell, Resistance Band, Barbell, Machine, Cable, Other.
4. **primaryMuscleGroups** – Array of 1–3 muscles from: Chest, Back, Shoulders, Biceps, Triceps, Forearms, Core, Quadriceps, Hamstrings, Glutes, Calves, Hip flexors, Other.
5. **secondaryMuscleGroups** – Array (can be empty) from the same list.
6. **description** – 2–4 sentences: setup, movement, key cues. Plain text, no markdown.
7. **videoUrl** – Full URL to a demo video if you know a good one, or empty string "".
8. **imageUrl** – Full URL to an image if relevant, or empty string "".

Output format: a valid JSON array of objects, one per exercise, with keys: name, category, equipment, primaryMuscleGroups, secondaryMuscleGroups, description, videoUrl, imageUrl. No trailing commas. Example for one exercise:

{
  "name": "Barbell Back Squat",
  "category": "Strength",
  "equipment": "Barbell",
  "primaryMuscleGroups": ["Quadriceps", "Glutes"],
  "secondaryMuscleGroups": ["Core", "Hamstrings"],
  "description": "Stand with feet shoulder-width apart, bar on upper back. Brace core, break at hips and knees, lower until thighs at least parallel. Drive through heels to stand. Keep chest up and knees in line with toes.",
  "videoUrl": "",
  "imageUrl": ""
}

Generate the full list in this exact JSON format so it can be imported programmatically.
```

---

## Full prompt (target schema – use when API supports extra fields)

Use this when the app has the full exercise schema. Output includes the missing fields listed above.

```
You are helping build a bulk list of exercises for a fitness app with a rich exercise library. Generate a list of [N] exercises.

For each exercise, provide ALL of the following in a JSON object:

**Core (required):**
- name – Short title (e.g. "Barbell Back Squat").
- category – Exactly one of: Strength, Cardio, Mobility, Flexibility, Other.
- equipment – Exactly one of: Bodyweight, Dumbbells, Kettlebell, Resistance Band, Barbell, Machine, Cable, Other.
- primaryMuscleGroups – Array of 1–3 from: Chest, Back, Shoulders, Biceps, Triceps, Forearms, Core, Quadriceps, Hamstrings, Glutes, Calves, Hip flexors, Other.
- secondaryMuscleGroups – Array (can be empty) from the same list.
- description – 2–4 sentences: setup, movement, key cues. Plain text.

**Optional media:**
- videoUrl – Full URL or "".
- imageUrl – Full URL or "".

**Extended (all optional – use [] or "" if not applicable):**
- difficulty – Exactly one of: Beginner, Intermediate, Advanced.
- movementPattern – Exactly one of: Squat, Hinge, Push, Pull, Lunge, Carry, Rotational, Other.
- isUnilateral – true if one limb at a time, else false.
- isCompound – true if multi-joint, else false.
- bodyRegion – Exactly one of: Upper, Lower, Full body, Core.
- coachingCues – **Array of strings** (e.g. ["Drive knees out", "Squeeze glutes at top"]). One cue per element.
- commonMistakes – **Array of strings** (e.g. ["Rounding lower back", "Knees caving"]).
- regressionOptions – **Array of strings** (e.g. ["Box squat", "Goblet squat"]).
- progressionOptions – **Array of strings** (e.g. ["Add weight", "Pistol squat"]).
- startingPosition – String (e.g. "Standing", "Seated", "Prone").
- tempo – String (e.g. "3-1-2-0" or "Controlled", "Explosive").
- rangeOfMotionNotes – String (depth/ROM cues).
- safetyNotes – String (warnings, contraindications).

Output: a valid JSON array of objects with the keys above. No trailing commas. Use "" or [] for empty optional fields. For coachingCues, commonMistakes, regressionOptions, progressionOptions always use arrays (e.g. [] when empty). On import, if a string is provided for those four fields, the importer will treat it as a single-element array.
```

---

## Variants

- **Smaller list:** Replace `[N]` with a number, e.g. "Generate a list of 30 exercises".
- **Themed list:** e.g. "Generate a list of 25 exercises focused on glutes and hamstrings" or "20 bodyweight exercises for home".
- **With URLs:** Add: "Where possible, provide a real videoUrl (YouTube or similar) for each exercise; otherwise use empty string."

---

## Importing the output

- **Option A (future):** Add a "Bulk import" page in the coach Exercise library that accepts pasted JSON and calls `POST /api/coach/exercises` for each item (or a new `POST /api/coach/exercises/bulk` that accepts an array).
- **Option B:** Use a one-off script that reads the JSON file and calls the existing create-exercise API for each exercise (requires coach auth or admin).

**Normalization on import:** For `coachingCues`, `commonMistakes`, `regressionOptions`, and `progressionOptions`, if the source has a string instead of an array, convert to a single-element array: `value => Array.isArray(value) ? value : (value ? [value] : [])`.

The prompt is designed so ChatGPT’s output matches our schema and allowed values with minimal manual cleanup.

---

## Seeding into localhost (development)

To seed exercises from a JSON file (e.g. **Part 1 - Upper.json**) into your local app with **full categorisation** (category, difficulty, movementPattern, bodyRegion, coachingCues, etc.):

1. **Run the app in development:** `npm run dev`, then open the coach Exercise library at `http://localhost:3000/coach/exercises`.
2. **Log in as a coach** so exercises are assigned to your account.
3. **Click “Seed from Part 1 - Upper”** (button is shown only on localhost). This calls `POST /api/seed/exercises` with `{ source: "Part 1 - Upper" }`, reads `Part 1 - Upper.json` from the project root, and inserts each exercise into Firestore with the same schema (all categorisation fields preserved).
4. **Or call the API directly** (e.g. from browser console or Postman):
   - `POST /api/seed/exercises` with body `{ "source": "Part 1 - Upper" }` (uses the logged-in coach), or
   - `POST /api/seed/exercises` with body `{ "coachId": "<your-coach-uid>", "source": "Part 1 - Upper" }` if you want to specify the coach.

The seed endpoint is **dev-only** (`NODE_ENV === "development"`). Firebase Admin must be configured (`FIREBASE_SERVICE_ACCOUNT`). After seeding, use the Exercise library filters (Category, Equipment, Difficulty, Movement, Region) to see categorisation.
