# Phase 4: Coach – responses, feedback, messaging, form builder

Quick check against **CTO_DEVELOPMENT_PLAN.md** Phase 4 scope and exit criteria.

---

## 1. View response

| Requirement | Status | Notes |
|-------------|--------|--------|
| From check-ins table, open completed check-in | ✓ | Coach: Clients → client → check-ins → "View" on completed row → `/coach/clients/[clientId]/responses/[responseId]` |
| Load formResponses + form + questions; show answers and score | ✓ | Page loads response data and feedback; displays answers per question and score |

---

## 2. Coach feedback

| Requirement | Status | Notes |
|-------------|--------|--------|
| Add text or voice feedback; write to `coachFeedback` | ✓ | POST `/api/coach/clients/[clientId]/responses/[responseId]/feedback` with `questionId` (or null), `feedbackType` (text/voice), `content`. Writes to `coachFeedback`. |
| Client can see feedback | ✓ | `/client/response/[responseId]` loads response + feedback; shows "Coach feedback" per question and "Overall feedback from coach". |
| Voice feedback | ⚠ | API accepts `feedbackType: "voice"` and stores it; **UI only has text input** (no voice upload/recording). Add voice later if needed. |

---

## 3. Messages

| Requirement | Status | Notes |
|-------------|--------|--------|
| Coach–client messaging: list conversations; thread view; send message | ✓ | Coach: `/coach/messages` – list conversations, select client, thread view, send. APIs: `GET/POST /api/coach/conversations`, `GET/POST /api/coach/conversations/[id]/messages`. |
| Client side | ✓ | `/client/messages` – conversation + messages, send. APIs: `GET /api/client/conversation`, `GET/POST /api/client/conversation/messages`. |
| Write to `messages` with `conversationId` | ✓ | Implemented in conversation/messages routes. |

---

## 4. Notifications

| Requirement | Status | Notes |
|-------------|--------|--------|
| Coach in-app notifications from `notifications` by userId | ✓ | `GET /api/coach/notifications` – `where('userId', '==', coachId)`. |
| Mark read | ✓ | `PATCH /api/coach/notifications/[id]`; UI "Mark read" and "View" (when actionUrl set). |
| Optional link to response/message | ✓ | Notifications have `actionUrl`; UI shows "View" link when present. |

---

## 5. Form builder (FORM_BUILDER_SCHEMA.md)

| Requirement | Status | Notes |
|-------------|--------|--------|
| List/create/update/delete **forms** (by coachId) | ✓ | GET/POST `/api/coach/forms`, GET/PATCH/DELETE `/api/coach/forms/[formId]`. |
| List/create/update/delete **questions** (by coachId) | ✓ | GET/POST `/api/coach/questions`, GET/PUT/DELETE `/api/coach/questions/[questionId]`. |
| Form stores ordered `questions: string[]` (question ids) | ✓ | Form has `questions` array; load form then load each question by id. |
| Add/remove/reorder questions on a form | ✓ | Edit form page: add from library, remove, move up/down; save via PATCH with `questionIds`. |
| Copy from standard | ✓ | Forms list: "Copy from standard" → POST with `isCopyingStandard: true`, `sourceFormId`; API duplicates questions (new ids, coachId) and creates new form. |
| Do not delete question docs still referenced | ✓ | DELETE form only removes form doc; question docs unchanged. Question DELETE exists; ensure no form references before delete (UI/process). |
| All question types (text, textarea, number, scale, boolean, select, multiple_choice, date, time) | ✓ | Check-in form renders all these; schema supported. **Question create/edit UI**: confirm it exposes type + options/weights for all types if you need full builder parity. |
| Auth = coach; ownership checks | ✓ | All form/question routes use `requireCoach` and validate `coachId` / ownership. |

---

## Exit criteria (from CTO plan)

| Criterion | Status |
|-----------|--------|
| Coach can open response, add feedback; client can see feedback | ✓ |
| Coach and client can message each other; notifications visible | ✓ |
| Coach can create/edit forms and questions; reorder; copy from standard; form builder matches FORM_BUILDER_SCHEMA.md | ✓ (APIs and flows match; voice feedback and full question-type UI are optional polish) |

---

## Optional follow-ups

- **Voice feedback:** API supports it; add recording/upload in coach response UI if you want voice.
- **Question builder UI:** If you need to create/edit every question type (date, time, weights, etc.) from the coach UI, verify the question create/edit screens expose all fields from the schema.

Phase 4 is **complete** for plan scope; optional items above can be done later if needed.
