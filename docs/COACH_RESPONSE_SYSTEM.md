# Coach Response System

This document describes how coaches review client check-ins and provide feedback: data model, UI flow, APIs, and how the client is notified. It covers the response detail page, per-question and overall feedback (voice and text), “Mark as Reviewed,” and the client feedback view.

---

## 1. Overview

After a client submits a check-in, the coach can:

1. **Open the response** – View the client’s answers, scores per question, and traffic light status (Excellent / On Track / Needs Attention).
2. **Add feedback** – Per question: voice note or text. Overall: one voice summary and one text summary for the whole check-in.
3. **Track review progress** – “X of Y questions reviewed” (a question is “reviewed” when it has at least one feedback item).
4. **Mark as Reviewed** – Signal that the review is complete; the client is notified and can see feedback at `/client-portal/feedback/[responseId]`.

Feedback is stored in the **`coachFeedback`** collection. The **`formResponses`** and **`check_in_assignments`** documents are updated with `coachResponded`, `reviewedByCoach`, and related fields so lists and filters stay in sync.

---

## 2. Data Model

### 2.1 `coachFeedback` collection

Each document is one feedback item: either **per-question** or **overall** (no question).

| Field | Type | Description |
|-------|------|-------------|
| `responseId` | string | Form response document ID (formResponses). |
| `coachId` | string | Coach’s Firebase Auth UID. |
| `clientId` | string | Client the response belongs to. |
| `questionId` | string \| null | Question ID for per-question feedback; **null** for overall summary. |
| `feedbackType` | `'voice' \| 'text'` | Whether content is voice (base64 or URL) or plain text. |
| `content` | string | Voice: base64 audio or storage URL. Text: the feedback text. |
| `createdAt` | Date | When the feedback was first saved. |
| `updatedAt` | Date | Last update (e.g. coach edited text). |

- **Per-question:** One document per (responseId, coachId, questionId, feedbackType). Saving again for the same combo **updates** that document.
- **Overall:** questionId is null. One document per (responseId, coachId, feedbackType) for overall voice and one for overall text.

**Queries:** By `responseId` and either `coachId` or (for client view) verified `clientId` after confirming the response belongs to that client.

### 2.2 `formResponses` (updated by feedback and review)

Relevant fields set or updated by the coach response flow:

| Field | Type | Description |
|-------|------|-------------|
| `coachResponded` | boolean | Set true when the coach saves **any** feedback (voice or text). |
| `coachRespondedAt` | Date | When the first feedback was saved. |
| `feedbackStatus` | string | e.g. `'responded'` when feedback is saved. |
| `reviewedByCoach` | boolean | Set true when the coach clicks **Mark as Reviewed**. |
| `reviewedAt` | Date | When it was marked as reviewed. |
| `reviewedBy` | string | Coach UID who marked it reviewed. |

### 2.3 `check_in_assignments` (updated in sync)

When feedback is saved or the response is marked as reviewed, the assignment linked to that response (via `responseId`) is updated:

| Field | Description |
|-------|-------------|
| `coachResponded` | true when coach has saved feedback. |
| `coachRespondedAt` | Timestamp. |
| `workflowStatus` | e.g. `'responded'` when feedback exists; used for “Coach Responses” and filtering. |
| `reviewedByCoach` | true when coach has marked as reviewed. |
| `reviewedAt` | When marked as reviewed. |

This keeps dashboard lists (e.g. “Check-ins to review” vs “Coach Responses”) and client check-in lists consistent.

---

## 3. Coach Flow: Response Detail Page

**URL:** `/responses/[id]`  
**ID:** Can be a **response ID** (formResponses doc id) or an **assignment ID**; the API resolves assignment → responseId when needed.

### 3.1 Entry points

- **Check-ins to review:** Dashboard or Check-ins page calls `GET /api/dashboard/check-ins-to-review?coachId=...`. Returns check-ins that are completed but not yet `coachResponded`/`reviewedByCoach`. Coach clicks a row → navigate to `/responses/[responseId]` (or assignment id; API resolves).
- **Client profile:** From the client’s check-ins table, “View” or “Respond” → `/responses/[responseId]`.
- **Messages:** Links to `/responses/[responseId]` when the context is a check-in.

### 3.2 Loading the response

- **API:** `GET /api/responses/[id]?coachId=...`
- **Returns:** Response document (clientId, clientName, formTitle, responses array with answers/scores, score, submittedAt, etc.), questions list, and metadata: `reviewedByCoach`, `coachResponded`, `workflowStatus`, `feedbackCount`, `reactions`.
- **Auth:** The response’s `coachId` must match the requesting coach.

### 3.3 Page layout (summary)

1. **Banner** – “Your client is waiting for your feedback…” when `!coachResponded`.
2. **Review progress** – “X of Y questions reviewed” and “Jump to Next Unreviewed.” A question counts as reviewed if there is at least one coachFeedback row for that `questionId` or there is unsaved text in the per-question text box for that question.
3. **Answer summary table** – Columns: #, QUESTION, ANSWER, SCORE, STATUS (traffic light: Excellent / On Track / Needs Attention). Sort by original order or by score. Click row to scroll to detailed view.
4. **Detailed view** – Each question card shows question text, client answer, score (e.g. 9.0/10), status, and:
   - **Per-question feedback:** Voice recorder (record → save) and text area with “Save” so the coach can add voice and/or text per question.
5. **Overall Coach Summary**
   - **Voice summary:** “Record Overall Voice Summary” → same save flow as per-question voice but with `questionId: null`.
   - **Text summary:** Multi-line text; “Save Overall Summary” → save with `questionId: null`.
6. **Mark as Reviewed**
   - If not yet reviewed: green button “Mark as Reviewed.” Calls `POST /api/responses/[id]/review` and creates an in-app notification for the client.
   - If already reviewed: message “This response has been marked as reviewed.”

---

## 4. Saving Feedback

### 4.1 API: `POST /api/coach-feedback`

**Body:**

- `responseId` (required)
- `coachId` (required)
- `clientId` (required)
- `questionId` (optional) – **null** or omitted for overall summary; question id for per-question feedback.
- `feedbackType` (required) – `'voice'` or `'text'`
- `content` (required) – Base64 audio string for voice, or plain text for text.

**Behaviour:**

- If a document already exists for (responseId, coachId, questionId, feedbackType), it is **updated** (content, updatedAt). Otherwise a new document is **added**.
- **formResponses:** Doc for responseId is updated: `coachResponded: true`, `coachRespondedAt`, `feedbackStatus: 'responded'`.
- **check_in_assignments:** All assignments with `responseId == responseId` are updated: `coachResponded: true`, `coachRespondedAt`, `workflowStatus: 'responded'`.
- **First feedback only:** If this is the first feedback for this response from this coach:
  - **In-app notification:** “Coach Feedback Available” with link to `/client-portal/feedback/[responseId]` (via notification service).
  - **Email:** Coach feedback email template is sent to the client (if email exists and template is configured), with link to the same feedback page.

So the client can be notified as soon as the coach adds any feedback; “Mark as Reviewed” is a separate step that adds an explicit “review complete” notification.

### 4.2 Other coach-feedback endpoints

- **GET /api/coach-feedback?responseId=...&coachId=...** (or clientId for client) – Returns all feedback for that response, deduplicated by (questionId, feedbackType), most recent kept. Used to populate the response detail page and the client feedback page.
- **PUT /api/coach-feedback** – Body: `feedbackId`, `content`. Updates an existing feedback document (e.g. edit text).
- **DELETE /api/coach-feedback?feedbackId=...** – Deletes one feedback document.

---

## 5. Mark as Reviewed

### 5.1 API: `POST /api/responses/[id]/review`

**Body:** `{ coachId, reviewedAt? }`.

**Behaviour:**

- Resolves [id] to the formResponses document (id can be responseId or assignmentId).
- Verifies the response’s coachId matches the requesting coach.
- **formResponses:** Updates `reviewedByCoach: true`, `reviewedAt`, `reviewedBy`, `coachResponded: true`, `coachRespondedAt`.
- **check_in_assignments:** If the response has `assignmentId`, updates that assignment: `reviewedByCoach: true`, `reviewedAt`, `coachResponded: true`, `coachRespondedAt`, `workflowStatus: 'responded'`.

The UI then creates an **in-app notification** for the client (type e.g. `coach_feedback_ready`, title “Coach Feedback Available”, message that the coach has reviewed and provided feedback, actionUrl `/client-portal/feedback/[responseId]`). This is in addition to any notification/email sent when the first feedback was saved.

---

## 6. Client View: Feedback Page

**URL:** `/client-portal/feedback/[responseId]`

- **API:** Response load: `GET /api/responses/[id]?clientId=...` (clientId = current user). Feedback: `GET /api/coach-feedback?responseId=...&clientId=...`.
- Client sees:
  - Check-in title and submission date.
  - For each question: question text, their answer, and any coach feedback (voice and/or text) for that question.
  - **Overall Coach Summary** – Voice summary (play) and text summary.
- Optional: “Approve” or acknowledge flow (e.g. `clientApproved` on the response) and approval API; see `GET/POST /api/responses/[id]/approve` if implemented.

---

## 7. Traffic Light and Scores on the Response Page

The Answer Summary and detail view use the **per-question score** (0–10) stored on each response item:

- **Green (Excellent):** score in high range (e.g. 7–10).
- **Orange (On Track):** mid range (e.g. 4–6).
- **Red (Needs Attention):** low range (e.g. 0–3).

Unscored questions (e.g. text/textarea, or weight 0) typically show 0.0/10 and may be labelled or styled as “Needs Attention” or “Not Scored” depending on UI. This is the same raw score used in the Progress “Question Progress Over Time” grid (see TRAFFIC_LIGHT_AND_SCORING.md).

---

## 8. Quick Response from Client Profile

From the client profile page, the coach can open a “Quick response” (or similar) modal for a selected check-in and:

- Record a voice note and/or enter text.
- Submit → same `POST /api/coach-feedback` with `questionId: null` (overall feedback).

Optional: text may also be sent as a **message** (POST /api/messages) so it appears in the coach–client message thread. The main storage of record for “coach feedback on this check-in” remains `coachFeedback`.

---

## 9. Notifications and Email Summary

| Event | In-app notification | Email |
|-------|---------------------|--------|
| Coach saves **first** feedback (any voice/text) | Yes – “Coach Feedback Available” → `/client-portal/feedback/[responseId]` | Yes – coach feedback template with link (if client email exists). |
| Coach clicks **Mark as Reviewed** | Yes – “Coach has reviewed your check-in and provided feedback” → same feedback URL | Optional / implementation-specific. |

Both flows point the client to the same feedback page so they can read and listen to all feedback (per-question and overall).

---

## 10. API Summary

| Method | Endpoint | Purpose |
|--------|----------|--------|
| GET | `/api/responses/[id]?coachId=...` or `?clientId=...` | Load one response (and questions); coach or client. |
| GET | `/api/coach-feedback?responseId=...&coachId=...` or `&clientId=...` | List feedback for that response (deduplicated). |
| POST | `/api/coach-feedback` | Create or update one feedback item (voice or text, per-question or overall). |
| PUT | `/api/coach-feedback` | Update existing feedback (body: feedbackId, content). |
| DELETE | `/api/coach-feedback?feedbackId=...` | Delete one feedback document. |
| POST | `/api/responses/[id]/review` | Mark response as reviewed (sets reviewedByCoach, notifies client). |
| GET | `/api/dashboard/check-ins-to-review?coachId=...` | List check-ins needing coach review (no coachResponded/reviewedByCoach). |

---

## 11. File and Collection Reference

| Area | Location |
|------|----------|
| Coach response detail page | `src/app/responses/[id]/page.tsx` |
| Client feedback page | `src/app/client-portal/feedback/[id]/page.tsx` |
| Coach feedback API | `src/app/api/coach-feedback/route.ts` |
| Mark as reviewed API | `src/app/api/responses/[id]/review/route.ts` |
| Response fetch API | `src/app/api/responses/[id]/route.ts` |
| Check-ins to review list | `src/app/api/dashboard/check-ins-to-review/route.ts` |
| Feedback collection | Firestore `coachFeedback` |
| Response/assignment flags | `formResponses`, `check_in_assignments` |

This is the full coach response system: from opening a check-in and adding voice/text feedback (per question and overall) to marking it reviewed and notifying the client so they can view feedback on the client portal.
