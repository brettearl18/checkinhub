# Form Builder Schema – For New Repo

This document describes how **forms** and **questions** are stored and how to build a form builder that reads/writes the same Firestore data. Use it together with `DATA_SCHEMA_FOR_NEW_UI.md` (which has the high-level collection list).

---

## 1. Overview

- **Forms** live in the `forms` collection. Each form has a **list of question document IDs** (`questions: string[]`). Order of the array = display order.
- **Questions** live in the `questions` collection. They are **reusable** across forms; a form references them by id only. Questions are owned by a coach (`coachId`).
- To **render a form**, load the form doc, then load each question doc by id (in order). To **submit a check-in**, save a `formResponses` doc with `responses: { questionId, answer, score? }[]`.

---

## 2. Form document (`forms` collection)

**Document ID:** Use a generated id, e.g. `form-{timestamp}-{random}` (e.g. `form-1739123456789-abc12def`), and call `.doc(formId).set(form)` so the doc id is the form id.

### Schema

```ts
{
  id: string;                    // same as document id
  title: string;
  description: string;
  category: string;              // e.g. "Goals & Progress", "Vana Check In"
  coachId: string;               // owner (Firebase Auth UID of coach)
  questions: string[];           // ordered list of question document IDs
  estimatedTime?: number;        // minutes, e.g. 5
  isStandard?: boolean;          // true if template (e.g. seed form), false for user-created
  isActive?: boolean;            // default true
  isArchived?: boolean;          // default false
  thresholds?: {                 // optional; overall form scoring bands (0–100)
    redMax: number;              // score <= redMax → red
    orangeMax: number;           // score <= orangeMax → orange; else green
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes / queries

- List forms by coach: `where('coachId', '==', coachId)` and optionally `orderBy('createdAt', 'desc')`.
- Get one form: `doc(formId).get()`.

### Create form (POST)

- **Input:** `title`, `description`, `category`, `coachId`, `questions` or `questionIds` (array of question ids), optional `estimatedTime`, `isActive`, `thresholds`.
- **If copying from a standard form:** `isCopyingStandard: true` and `questions` = list of source question ids. For each id, load the question doc, create a **new** question doc with a new id (e.g. `q-{timestamp}-{random}`), set `coachId` to the current coach, then use the **new** question ids in the form’s `questions` array.
- Generate `formId`, set `createdAt`/`updatedAt`, then `db.collection('forms').doc(formId).set(form)`.

### Update form (PATCH / PUT)

- **Input:** `title`, `description`, `category`, `questionIds` (full ordered list), optional `isActive`, `isArchived`, `thresholds`.
- **Auth:** Only the coach who owns the form (`existingForm.coachId === coachId`) may update.
- Update only the form document: `questions`, `updatedAt`, and any other provided fields. Do not delete or create question docs from this endpoint unless you explicitly design a “sync” behaviour.

### Delete form

- Delete only the form document: `db.collection('forms').doc(formId).delete()`. Do **not** delete question documents or any `check_in_assignments` / `formResponses`; client history stays intact.

---

## 3. Question document (`questions` collection)

**Document ID:** Use a generated id, e.g. `question-{timestamp}-{random}` or `q-{timestamp}-{random}`. Store with `db.collection('questions').doc(questionId).set(question)`.

### Schema

```ts
{
  id: string;                    // same as document id
  text: string;                  // main question text (required)
  title?: string;                // optional; some code uses title instead of text
  type: string;                  // question type (see below)
  description?: string;
  category?: string;              // e.g. "Vana Check In"
  coachId: string;
  options?: string[] | Array<{ text: string; weight: number }>;  // for select/scale/multiple_choice
  weights?: number[];             // optional; per-option score weight (same order as options)
  questionWeight?: number;       // weight for overall score (0 = not scored, e.g. textarea)
  yesNoWeight?: number;          // for boolean; weight when "yes"
  yesIsPositive?: boolean;      // for boolean; true = yes is good
  isRequired?: boolean;
  required?: boolean;
  isActive?: boolean;
  usageCount?: number;
  scoring?: {                    // optional; per-question traffic light bands
    type?: string;
    thresholds?: { green?: number[]; orange?: number[]; red?: number[] };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Note:** Both `text` and `title` appear in the codebase; the form builder and check-in UI should treat “question text” as `question.text || question.title`.

### Question types

Use exactly these type values so the check-in UI can render and score correctly:

| type             | Description        | options / value shape |
|------------------|--------------------|------------------------|
| `text`           | Short text         | none                   |
| `textarea`       | Long text          | none; typically `questionWeight: 0` (not scored) |
| `number`         | Numeric input      | optional min/max (if you add them) |
| `scale`          | Scale (e.g. 1–10)  | optional labels; score = numeric value |
| `boolean`        | Yes/No             | optional `yesNoWeight`, `yesIsPositive` |
| `select`         | Single choice      | `options`: string[] or `{ text, weight }[]` |
| `multiselect`    | Multiple choice    | same as select         |
| `multiple_choice`| Same as select     | same as select         |
| `date`           | Date picker        | none                   |
| `time`           | Time picker        | none                   |

- **Options format:** Either an array of strings `["Low", "Medium", "High"]` or an array of objects `[{ text: "Low", weight: 8 }, { text: "High", weight: 2 }]`. If objects, `weights` can be stored separately in `weights` (same order as options) or embedded in each option.
- **Scoring:** Scored questions contribute to the overall check-in score (0–100). Use `questionWeight` (and per-option `weight` where applicable). Use `questionWeight: 0` for non-scored questions (e.g. many `textarea`).

### Indexes / queries

- List questions by coach: `where('coachId', '==', coachId).orderBy('createdAt', 'desc')`.
- Get one question: `doc(questionId).get()`.
- Get many questions by ids: for each id in `form.questions`, `doc(questionId).get()` (or batch get).

### Create question (POST)

- **Input:** `text` (or `title`), `type`, `coachId`, optional `description`, `category`, `options`, `weights`, `questionWeight`, `isRequired`, etc.
- Generate `questionId`, set `createdAt`/`updatedAt`, then `db.collection('questions').doc(questionId).set(question)`.

### Update question (PUT)

- **Input:** any subset of the question fields (no id change).
- `db.collection('questions').doc(questionId).update(updateData)` with `updatedAt: new Date()`.

### Delete question

- `db.collection('questions').doc(questionId).delete()`. **Note:** Any form that still lists this id in `questions` will have a broken reference; the form builder should remove the id from all forms that use it, or soft-delete (e.g. `isActive: false`).

---

## 4. Form ↔ question relationship

- A **form** stores only question **ids**: `form.questions = ["question-1", "question-2", ...]`. Order = display order.
- To **load a form with questions:**  
  1) Get form: `forms.doc(formId).get()`.  
  2) For each id in `form.questions`, get question: `questions.doc(id).get()`.  
  3) If a question doc is missing, skip or show a placeholder (do not change form.questions unless the user explicitly reorders or removes in the builder).
- **Reorder:** Update the form with a new ordered array: `questions: [id2, id1, id3, ...]`.
- **Add question to form:** Append an id to `form.questions` and update the form.
- **Remove question from form:** Remove the id from `form.questions` and update the form. Do not delete the question doc unless the user deletes the question globally.

---

## 5. API surface summary (for new repo)

| Operation        | Method | Endpoint (example)        | Body / params |
|-----------------|--------|---------------------------|---------------|
| List forms      | GET    | `/api/forms?coachId=...`  | -             |
| Get form        | GET    | `/api/forms/[id]`         | -             |
| Create form     | POST   | `/api/forms`              | title, description, category, coachId, questions/questionIds, optional estimatedTime, isActive, thresholds, isCopyingStandard |
| Update form     | PATCH  | `/api/forms/[id]`         | title, description, category, questionIds, isActive, isArchived, thresholds |
| Delete form     | DELETE | `/api/forms/[id]`         | -             |
| List questions  | GET    | `/api/questions?coachId=...` | -         |
| Get question    | GET    | `/api/questions/[id]`     | -             |
| Create question | POST   | `/api/questions`         | text/title, type, coachId, optional description, category, options, questionWeight, etc. |
| Update question | PUT    | `/api/questions/[id]`     | any question fields       |
| Delete question | DELETE | `/api/questions/[id]`     | -             |

**Auth:** All of these should require the caller to be the coach (or admin). Validate `coachId` matches the authenticated user for create; validate form/question ownership for update/delete.

---

## 6. Copying a form (“copy from standard”)

When the user copies a **standard** form (e.g. “Vana Check In” template):

1. Load the source form and its question docs (by `form.questions`).
2. For each question, create a **new** question document: new id, same fields but `coachId` = current coach, `createdAt`/`updatedAt` = now.
3. Build the new form with `questions: [newId1, newId2, ...]` in the same order, `isStandard: false`, `coachId` = current coach, new `formId`.
4. Save the new form with `forms.doc(newFormId).set(form)`.

This way the new form and its questions are owned by the coach and can be edited without affecting the standard template.

---

## 7. Form-level thresholds (optional)

- `form.thresholds`: `{ redMax: number, orangeMax: number }` defines the bands for the **overall** check-in score (0–100):  
  - score ≤ redMax → red  
  - score ≤ orangeMax → orange  
  - else → green  
- These can be used when displaying a completed check-in (e.g. traffic light on the success page). The new repo can store them on the form and, if needed, copy them onto `check_in_assignments` when creating assignments.

---

## 8. Checklist for the new form builder UI

- [ ] List forms by `coachId`; create form with required fields and `questions` array (ids).
- [ ] Load form by id; load each question doc by id in order to show form + questions.
- [ ] Create/update/delete questions; support all question types and option formats above.
- [ ] Add/remove/reorder questions on a form by updating `form.questions` (ordered ids).
- [ ] Copy form: duplicate questions with new ids and new coachId; create new form with new question id list.
- [ ] Do not delete question docs that are still referenced by any form (or remove from all forms first).
- [ ] Use same collection names (`forms`, `questions`) and same field names so existing data works.

Once this is in place, the new repo can build a form builder that reads and writes the same Firestore data as the current app.
