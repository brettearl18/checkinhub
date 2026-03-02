# Traffic Light System – How Scores Are Calculated and Measured

This document describes how check-in scores are computed, how question weights work, and how the traffic light (red / orange / green) is determined. It is the single reference for the formula and rules.

---

## 1. Overview

1. **Per question:** Each answered question gets a **raw score out of 10** (`questionScore`) based on its type and the answer.
2. **Weighting:** Each question has a **weight** (`questionWeight`, default 5, range 1–10). Only questions with weight &gt; 0 and that are “scorable” (see below) count.
3. **Weighted sum:** For each scorable question: `weightedScore = questionScore × questionWeight`. Sum these to get `totalWeightedScore`; sum the weights to get `totalWeight`.
4. **Final percentage:** `score = (totalWeightedScore / (totalWeight × 10)) × 100`, rounded. Result is 0–100%.
5. **Traffic light:** Compare `score` to the client/form thresholds: **red** (≤ redMax), **orange** (≤ orangeMax), **green** (above orangeMax).

---

## 2. Question Weight (`questionWeight`)

- **Stored on:** Each question document in the `questions` collection.
- **Fields used:** `questionWeight` or `weight` (fallback). Default if missing: **5**.
- **Range:** 1–10 in practice. **0** means “do not score” (e.g. many text/textarea questions).
- **Role:** Weight is the multiplier for that question’s contribution. Higher weight = more impact on the final percentage.

**Formula role:**  
`totalWeight` = sum of `questionWeight` over **scorable** questions only.  
So the “total possible” weighted score is `totalWeight × 10` (if every question scored 10/10).

---

## 3. Which Questions Are Scored?

At **submit time** (authoritative logic in `src/app/client-portal/check-in/[id]/page.tsx`):

- **Excluded (never scored):**  
  - `questionWeight === 0`  
  - `type === 'number'`  
  - `type === 'text'`  
  - `type === 'textarea'`  

  For these, the response is stored but `score` and `weight` are set to 0 and they do **not** contribute to `totalWeightedScore` or `totalWeight`.

- **Included (scored):**  
  Scale/rating, multiple_choice/select, boolean, and any other type that isn’t explicitly excluded. They use `questionWeight` (or default 5) and contribute to the final score.

---

## 4. Raw Score per Question (`questionScore`, 1–10)

For each **scorable** question, the answer is converted to a **score out of 10** as follows.

### 4.1 Scale / Rating (`scale`, `rating`)

- **Rule:** Use the answer value directly.
- **Expected range:** 1–10.
- **Example:** Answer `7` → `questionScore = 7`.

### 4.2 Boolean (`boolean`)

- **Rule:** Depends on `yesIsPositive` and optional `yesNoWeight` on the question.
  - **yesIsPositive true (default):** “Yes” is the positive (higher) score, “No” is the negative (lower) score.
  - **yesIsPositive false:** “Yes” is the negative score, “No” is the positive score (e.g. “Did you skip exercise?”).
  - **Default scores (when `yesNoWeight` is not set):** Yes → 8, No → 3 (1–10 scale), i.e. 80 and 30 in 0–100.
  - **When `yesNoWeight` is set (0–100):** “Yes” → `yesNoWeight`, “No” → `100 - yesNoWeight`; then if `yesIsPositive` is false, the two values are swapped so “Yes” gets the lower score and “No” the higher.
- Answer is treated as “Yes” if value is `true`, `'yes'`, or `'Yes'`.

### 4.3 Multiple choice / Select (`multiple_choice`, `select`)

- **If the chosen option has a `weight` property:**  
  `questionScore = option.weight` (expected 1–10).
- **Else (position-based fallback):**  
  Options are ordered; first option = lowest score, last = highest.  
  `questionScore = 1 + (selectedIndex / (numOptions - 1)) × 9`.  
  If there is only one option: `questionScore = 5`.

### 4.4 Number (`number`)

- In the **main submit flow**, `number` is **excluded** from scoring (see §3).  
- In other places (e.g. edit/success recalc), if it were scored: 0–100 is normalized as `1 + (value / 100) × 9`; otherwise clamped/normalized to 1–10.

### 4.5 Text / Textarea (`text`, `textarea`)

- **Excluded** from scoring at submit (see §3). No raw score.

### 4.6 Default (other types)

- **Default:** `questionScore = 5` (partial credit for answering).

---

## 5. Weighted Score and Final Percentage

**Per scorable question:**

- `weightedScore = questionScore × questionWeight`
- `totalWeightedScore += weightedScore`
- `totalWeight += questionWeight`

**Final check-in score (0–100%):**

```text
score = totalWeight > 0
  ? round((totalWeightedScore / (totalWeight × 10)) × 100)
  : 0
```

**Meaning:**

- **Denominator:** `totalWeight × 10` = maximum possible weighted score if every scorable question got 10/10.
- **Ratio:** `totalWeightedScore / (totalWeight × 10)` = share of that maximum (0–1).
- **Percentage:** Multiply by 100 and round → 0–100%.

**Example:**

- 3 scorable questions, weights 8, 5, 2; scores 7, 8, 5.  
- `totalWeightedScore = 7×8 + 8×5 + 5×2 = 56 + 40 + 10 = 106`.  
- `totalWeight = 15`.  
- `score = (106 / 150) × 100 ≈ 70.67` → **71%**.

---

## 6. Traffic Light (Red / Orange / Green)

**Inputs:**

- **Score:** The 0–100% value from §5.
- **Thresholds:** Two numbers: `redMax`, `orangeMax` (0–100).

**Rule:**

```text
if score ≤ redMax   → red
if score ≤ orangeMax → orange
else                → green
```

So:

- **Red:** 0% up to and including `redMax`.
- **Orange:** `redMax + 1` up to and including `orangeMax`.
- **Green:** `orangeMax + 1` up to 100%.

**Labels (from `scoring-utils.ts`):**  
Red = “Needs Attention”, Orange = “On Track”, Green = “Excellent”.

---

## 7. Where Thresholds Come From

Thresholds are **per check-in display**, not stored on the response. Resolution order:

1. **Form thresholds**  
   If the form has `thresholds.redMax` and `thresholds.orangeMax`, use those (form-level bands).

2. **Client scoring (`clientScoring` collection)**  
   Document id = `clientId`. If it has `thresholds.redMax` and `thresholds.orangeMax`, use those.  
   Legacy: if `thresholds.red` / `thresholds.yellow` exist, they are converted to `redMax`/`orangeMax` via `convertLegacyThresholds`.  
   If only `scoringProfile` is set, use that profile’s default thresholds (see §8).

3. **Default**  
   If nothing else is set: **moderate** profile (e.g. redMax 60, orangeMax 85).

**Success page:** Uses `formThresholds` first, then `scoringConfig` (from `clientScoring`), then profile default.

---

## 8. Scoring Profiles (Default Thresholds)

Defined in `src/lib/scoring-utils.ts`:

| Profile            | redMax | orangeMax | Red range | Orange range | Green range |
|--------------------|--------|-----------|-----------|--------------|-------------|
| **lifestyle**      | 33     | 80        | 0–33%     | 34–80%       | 81–100%     |
| **high-performance** | 75   | 89        | 0–75%     | 76–89%       | 90–100%     |
| **moderate**       | 60     | 85        | 0–60%     | 61–85%       | 86–100%     |
| **custom**         | 70     | 85        | 0–70%     | 71–85%       | 86–100%     |

`clientScoring` can store either:

- `thresholds: { redMax, orangeMax }`, or  
- `scoringProfile: 'lifestyle' | 'high-performance' | 'moderate' | 'custom'` to use the table above.

---

## 9. Option Weights (Multiple Choice)

For `multiple_choice` / `select`, options can be:

- **Strings:** `["Low", "Medium", "High"]` → only position-based scoring (§4.3).
- **Objects with weight:** `[{ text: "Low", weight: 2 }, { text: "High", weight: 9 }]` → selected option’s `weight` is the raw score (1–10).

So the “formula” for that question is: **use the selected option’s `weight` if present; otherwise use position in the list** to get a 1–10 value, then multiply by `questionWeight` and add into `totalWeightedScore`.

---

## 10. Summary

| Step | What | Formula / rule |
|------|------|-----------------|
| 1 | Question weight | `questionWeight` or `weight`, default 5; 0 = not scored. |
| 2 | Scorable? | Exclude weight 0, and type number/text/textarea at submit. |
| 3 | Raw score (1–10) | By type: scale = value; boolean = 8/3 or 3/8; multiple choice = option weight or position. |
| 4 | Weighted score | `weightedScore = questionScore × questionWeight` per scorable question. |
| 5 | Final % | `score = round((totalWeightedScore / (totalWeight × 10)) × 100)`. |
| 6 | Traffic light | `score ≤ redMax` → red; `score ≤ orangeMax` → orange; else green. |
| 7 | Thresholds | Form thresholds → clientScoring (clientId) → scoring profile default (e.g. moderate). |

This is how the traffic light system is scored and measured in the app.

---

## 11. Progress Page: “Question Progress Over Time” Grid

The **Progress** page (client portal) shows a grid of coloured dots: one row per question, one column per check-in (week). Each dot is a **per-question traffic light** for that check-in. This is separate from the **overall** check-in traffic light (§6): the grid uses a **fixed 0–10 band** per question, not the client’s red/orange/green thresholds.

### 11.1 Where the data comes from

1. **API:** The Progress page calls **`GET /api/client/question-progress`** (authenticated as the client). This endpoint returns a pre-built grid: `questions` (rows), `weeks` (columns), and `grid[qId][weekKey]` = per-question score 0–100. It also returns `trafficLightRedMax` and `trafficLightOrangeMax` (resolved per §7) for any overall-score display; the **grid dots** themselves use the fixed bands in §11.2, not these thresholds.
2. **Backend:** The question-progress API reads **`formResponses`** where `clientId` matches, loads form and question definitions, and uses **`getPerQuestionScores`** (from `check-in-score.ts`) to compute a 0–100 score per question per check-in. No per-question score is stored on the response; scores are derived from stored `responses` (answer + question type/options/weights) at request time.
3. **Weeks:** Responses are grouped by week (Monday of submit date). Each week column shows the latest submission in that week; the grid is one row per question, one column per week.

So: **every dot in the grid is driven by the same scoring rules** as the overall check-in (scale, options, weights), with **fixed** red/orange/green bands (0–3, 4–6, 7–10 in 1–10 scale) for the grid only.

### 11.2 How each dot’s colour is chosen

For each **question × check-in** cell:

- **Score:** Use the response’s `score` (0–10). If missing, a fallback can use `weightedScore / weight`. This is the **same** raw score (1–10) that was used in the overall check-in formula when the form was submitted.
- **Unscored:** If `weight === 0` or `type` is `text` or `textarea`, the question is treated as “Not Scored” → **grey** dot.
- **Scored:**  
  - **Green (Good):** `score >= 7`  
  - **Orange (Moderate):** `score >= 4` and `score < 7`  
  - **Red (Needs Attention):** `score < 4` (0–3)

So the grid uses **fixed bands** (0–3, 4–6, 7–10) for the per-question dots, not the client’s overall traffic light thresholds (e.g. redMax/orangeMax).

### 11.3 How the grid is built

1. **Sort check-ins by date:** Responses are sorted by `assignmentDueDate` or `submittedAt` (chronological, earliest first). That order defines the **columns** (left = older, right = newer).
2. **Unique questions:** All `questionId` / `questionText` that appear in any response are collected. Each unique question becomes one **row**.
3. **Per cell:** For each (question, check-in), the code finds the matching entry in that check-in’s `responses` array (by `questionId` or question text). It reads `score`, `weight`, `type`, and assigns red / orange / green / grey as above. The column label uses the check-in date (and optional week number).

So the grid is **one row per question, one column per submitted check-in**, with each cell showing the stored per-question score and the corresponding dot colour.

### 11.4 Why it is dynamic

- **On load:** When the client opens the Progress page, it fetches history and builds the grid from the **current** `formResponses`. New check-ins that exist in the DB will appear as new columns (or updated columns if they replaced a previous submission for the same assignment).
- **After submitting a check-in:** When the client returns to the Progress page (e.g. after completing a check-in), the page **refetches** progress data. The app uses a **visibility change** listener: when the tab/window becomes visible again, it calls the progress fetch again (with a short throttle, e.g. 5 seconds) so the latest submission is included and the grid updates without a full page reload.

So the traffic light grid is **taken directly from the client’s check-ins** (formResponses), and it **updates dynamically** as new check-ins are submitted and the user revisits or refreshes the Progress page.
