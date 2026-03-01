# New Repo Startup Checklist

Use this when starting a **new repository/project** for the optimized check-in system. It ties together what you have and what you still need.

---

## What you already have (in this repo)

| Doc | Purpose |
|-----|--------|
| **`DATA_SCHEMA_FOR_NEW_UI.md`** | Full Firestore (and Auth/Storage) schema. Collection names, document shapes, field types. Use this so the new app reads/writes the same data. |
| **`CTO_CHECKIN_REBUILD_PROMPT.md`** | All known issues, design principles, and the **copy-paste prompt** for the new project. Part 3 is the brief to paste into the new repo. |
| **`NEW_REPO_STARTUP_CHECKLIST.md`** (this file) | What to copy, what to create, and in what order. |

---

## What you need to copy or create

### 1. From this repo (copy into the new repo or keep as reference)

- **`docs/DATA_SCHEMA_FOR_NEW_UI.md`** – Copy into the new repo’s `docs/` (or paste into the first Cursor chat).
- **`docs/CTO_CHECKIN_REBUILD_PROMPT.md`** – Copy into the new repo; use **Part 3 (PROMPT START … PROMPT END)** as the initial project brief.
- **`firestore.rules`** – Copy from this repo’s root. The new app will use the same Firestore project; rules must stay in sync. If you change rules in the new repo, deploy them to the same Firebase project.
- **`firestore.indexes.json`** – Copy from this repo’s root. Required for the query patterns in the schema (e.g. `check_in_assignments` by clientId + dueDate, `formResponses` by clientId + submittedAt, `client_measurements` by clientId + date). Deploy with `firebase deploy --only firestore:indexes` (or keep in new repo and deploy when ready).

### 2. Environment variables (new repo)

Create `.env.local` (and optionally `.env.template` without secrets). Get values from this project’s `.env.local` or from Firebase Console.

**Required for Firebase (same project as current app):**

| Variable | Where to get it |
|----------|------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project settings → General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `{project-id}.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID (e.g. `checkinv5`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `{project-id}.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Project settings |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Project settings |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional (analytics) |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project settings → Service accounts → Generate new private key. Use as single-line JSON; escape `\n` in private key as `\\n`. |

**Optional (if new app needs them):**

- `NEXT_PUBLIC_BASE_URL` – e.g. `https://checkinv5.web.app` (for emails, links).
- Mailgun, Stripe, etc. – Only if the new app implements the same emails/payments; otherwise omit.

Do **not** commit `.env.local` or any file containing the service account key. Commit `.env.template` with placeholder names only.

### 3. Firebase project (no new project needed)

- Use the **same** Firebase project as the current app (e.g. `checkinv5`). Same Firestore, Auth, Storage.
- **Auth:** Enable the same sign-in methods (e.g. Email/Password). If you use redirects, add the new app’s domain to authorised domains when you deploy.
- **Storage:** Same bucket; rules in `storage.rules` if you use Storage (e.g. progress images, avatars). Copy `storage.rules` from this repo if the new app uploads files.

### 4. Required API surface (what the new app must implement)

The new app can be full stack (Next.js API routes) or a front-end that talks to a backend. Either way, it must support at least these operations (schema in `DATA_SCHEMA_FOR_NEW_UI.md`):

| Area | Operations |
|------|------------|
| **Auth** | Sign in (Firebase Auth); resolve current user; resolve client id from token (doc id + auth UID). |
| **Client portal** | Get client profile; get check-ins list (by client id); resolve/create assignment (client + form + reflection week); get form + questions; submit response; get measurements; get goals; get notifications; get messages. |
| **Coach** | Get clients; get check-ins for a client; get form responses; update assignment (e.g. mark missed); optional: delete pending, feedback, etc. |
| **Progress / history** | Get responses and assignments for history; get measurements for charts. |

You can implement these as REST routes (like the current app) or with a different backend; the important part is that reads/writes use the **same** Firestore collections and field names.

---

## Order of operations (new repo)

1. **Create the new repo** (e.g. `checkinv5-v2` or `vana-checkin-ui`) and open it in Cursor (or your IDE).
2. **Copy the three docs** into the new repo (e.g. `docs/`): `DATA_SCHEMA_FOR_NEW_UI.md`, `CTO_CHECKIN_REBUILD_PROMPT.md`, `NEW_REPO_STARTUP_CHECKLIST.md`.
3. **Copy config from this repo:** `firestore.rules`, `firestore.indexes.json`, and optionally `storage.rules`. Put them in the new repo root (or where your Firebase config lives).
4. **Create env file:** In the new repo, create `.env.template` (names only) and `.env.local` (real values from this project or Firebase Console). Do not commit `.env.local`.
5. **Paste the rebuild prompt:** Open `CTO_CHECKIN_REBUILD_PROMPT.md`, copy **Part 3 (PROMPT START … PROMPT END)**, and paste it as the first prompt/ brief in the new project (e.g. first Cursor chat or README).
6. **Scaffold the app:** Next.js (or your stack), Firebase client SDK, and optionally Firebase Admin in API routes. Connect to the same Firebase project using `.env.local`.
7. **Implement against the schema:** Use `DATA_SCHEMA_FOR_NEW_UI.md` for every read/write. Use the design principles and checklist in `CTO_CHECKIN_REBUILD_PROMPT.md` so you don’t reintroduce the old failure points.
8. **Deploy:** When ready, deploy to your targets (e.g. Cloud Run + Firebase Hosting). Use one build and the same env so all URLs serve the same version.

---

## Quick “do we have everything?” check

- [ ] **Data:** Schema doc in new repo; all collections and fields defined.
- [ ] **Behaviour:** Rebuild prompt (Part 3) and checklist used as the brief.
- [ ] **Security:** `firestore.rules` (and `storage.rules` if needed) copied; same Firebase project.
- [ ] **Indexes:** `firestore.indexes.json` copied; indexes deployed for the queries you run.
- [ ] **Secrets:** `.env.local` with Firebase config (and any other env); not committed.
- [ ] **Auth:** Same sign-in methods enabled in Firebase Auth; new app domain in authorised domains when you go live.

If all of the above are done, you have what you need to restart in a new repo and build the optimized check-in system against the same data.
