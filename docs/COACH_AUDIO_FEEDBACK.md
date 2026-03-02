# Coach audio feedback – what we need to do

You want coaches to be able to **record audio** when responding to a client’s check-in, in one of two ways:

1. **Per-question audio** – record a voice reply for each question (and optionally for “overall” feedback).
2. **Single final audio** – record one audio at the end of the check-in, before they submit “Mark as Reviewed”.

Below is what’s already in place and what we need to add for each approach.

---

## What already exists

- **Coach feedback model:** The `coachFeedback` collection already has:
  - `questionId` (or `null` for overall).
  - `feedbackType`: `"text"` or `"voice"` (API accepts both; UI only uses text today).
  - `content`: for text it’s the message; for voice we’ll store the **audio file URL** here.
- **Firebase Storage:** Already used for progress images (client + server). We can use the same bucket for coach voice files.
- **Coach response page:** Per-question text areas + “Add”, overall feedback text area, then “Mark as Reviewed” modal (where responded, notes, progress rating). No audio UI yet.

So the **data model and storage** are ready; we mainly add **recording UI**, **upload**, and **playback**.

---

## Option A: Per-question audio (and optional overall audio)

**Idea:** Next to each question’s text feedback, the coach can also record a short voice note. Same for “Overall feedback”: text and/or one audio.

**What we need:**

1. **Upload API**
   - New route, e.g. `POST /api/coach/clients/[clientId]/responses/[responseId]/upload-voice`.
   - Request: multipart form with an audio file (or base64 in JSON). Validate it’s audio and size limit (e.g. 5–10 MB).
   - Server: save file to Firebase Storage under a path like `coach-feedback/{responseId}/{questionId or 'overall'}_{timestamp}.webm` (or similar), make the file publicly readable or use a signed URL, return the **URL** in the response.

2. **Coach UI (response page)**
   - For each question (and for “Overall feedback”):
     - **Record:** Button “Record” → use browser `MediaRecorder` API (getUserMedia), record to a Blob (e.g. webm/opus). Show “Recording…” and a Stop button.
     - **Stop** → upload the Blob to the upload API above, get back URL.
     - **Save as feedback:** Call existing `POST .../feedback` with `feedbackType: "voice"`, `content: <audioUrl>` (and same `questionId` as for text). Optionally allow both text and voice per question.
   - **Playback:** For each feedback item with `feedbackType === "voice"`, show an `<audio src={content} controls />` so coach and client can play it.

3. **Client view**
   - When the client opens the response page, the existing API already returns feedback list with `feedbackType` and `content`. If `feedbackType === "voice"`, render an `<audio src={content} controls />` instead of (or in addition to) text.

4. **Feedback API**
   - Today the feedback API requires `content` to be a non-empty string. For voice we’ll pass the URL as `content`. So we only need to **allow** `content` to be a URL when `feedbackType === "voice"` (no change if it already accepts any string). If we ever want to store both text and voice per slot, we could add an optional `audioUrl` field later; for now, one “content” (text or URL) per feedback item is enough.

**Summary for Option A:** One upload API, recording + upload + “Add” flow per question/overall, playback on coach and client side using the same feedback list.

---

## Option B: Single final audio before submit

**Idea:** One recording at the end: coach fills in text feedback as today, then before (or in) the “Mark as Reviewed” modal they can record **one** audio summary. That audio is saved as a single feedback item (e.g. `questionId: null`, `feedbackType: "voice"`).

**What we need:**

1. **Same upload API** as in Option A (or a shared route that accepts an audio file and returns a URL).

2. **Coach UI**
   - In the “Mark as Reviewed” modal (or a step just before it): add a section “Optional: record a final audio message”.
   - **Record** → MediaRecorder → Blob → upload → get URL.
   - When coach clicks “Mark as Reviewed”, before or with the review submit:
     - If there’s an audio URL, call `POST .../feedback` once with `feedbackType: "voice"`, `content: audioUrl`, `questionId: null`.
   - No per-question audio UI; only this one recording.

3. **Playback**
   - Coach: can play the recording in the modal before submit, or after (e.g. in the overall feedback section).
   - Client: same as Option A – when we render feedback with `feedbackType === "voice"`, show `<audio src={content} controls />` in the overall feedback area.

**Summary for Option B:** Same upload API and same feedback storage; UI is simpler (one record control, one voice feedback item per response).

---

## Option C: Both (recommended if you want flexibility)

- **Per-question:** Optional voice note per question + optional overall voice (like Option A).
- **Final audio:** Optional single “closing” voice note in the review modal (like Option B). Stored as one more feedback item with `questionId: null`, `feedbackType: "voice"`.

So we’d have:
- Per-question and overall voice (Option A).
- One “final summary” voice in the modal (Option B).
All stored in `coachFeedback`; client sees all of them in the same feedback list (text + audio).

---

## Technical checklist (same for A, B, or C)

| Item | Notes |
|------|--------|
| **1. Upload API** | `POST .../upload-voice`: accept audio file, store in Firebase Storage, return URL. Reuse Storage bucket and auth (requireCoach, verify client ownership). |
| **2. Storage path** | e.g. `coach-feedback/{responseId}/{questionId\|overall}_{timestamp}.webm`. Optional: add content-type and size limits. |
| **3. Recording (browser)** | `navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder` → `ondataavailable` to collect Blob(s) → stop → upload Blob. Handle permissions and “no microphone” gracefully. |
| **4. Format** | Browsers often produce webm/opus. Safari may differ; we can normalize later (e.g. allow both webm and mp4). Start with webm and test on target devices. |
| **5. Feedback POST** | Already accepts `feedbackType: "voice"` and `content`. For voice, send `content: <audioUrl>`. Ensure validation allows URL when feedbackType is voice (e.g. content must be non-empty string; URL is a string). |
| **6. GET feedback** | Already returns `feedbackType` and `content`. Client and coach UI: if `feedbackType === "voice"`, render `<audio src={content} controls />`; else render text. |
| **7. Client response page** | Today it shows text feedback only. Add branch: if voice, show audio player. Same for coach response page when displaying existing feedback. |

---

## Suggested order of implementation

1. **Upload API** – so we have a place to put audio and get URLs.
2. **Feedback API** – confirm it accepts `feedbackType: "voice"` with `content` = URL (and adjust validation if needed).
3. **Coach UI – recording** – one place first (e.g. “Overall feedback” or the final-audio-in-modal). Reuse the same component for per-question later if you choose Option A/C.
4. **Coach UI – playback** – show existing voice feedback as `<audio>` on the coach response page.
5. **Client UI – playback** – show voice feedback as `<audio>` on the client response page.
6. Then add per-question recording (Option A) and/or final-audio-in-modal (Option B) as desired.

If you tell me whether you want **only final audio (B)**, **only per-question (A)**, or **both (C)**, I can outline the exact UI changes and API request shapes next (or implement them step by step).
