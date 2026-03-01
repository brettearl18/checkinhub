# CheckinHUB

Coach–client check-in and progress platform. Modern UI connected to existing Firebase (same project, same schema).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS 4** + design tokens (primary `#daa450`)
- **Firebase** (Auth, Firestore, Storage) – same project as current app

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment (Phase 1)**

   Copy `.env.template` to `.env.local` and fill in Firebase values. For real data and API identity, also set `FIREBASE_SERVICE_ACCOUNT` (see `docs/PHASE1_CHECKLIST.md`). Do not commit `.env.local`.

3. **Firestore rules & indexes**

   Replace `firestore.rules` and `firestore.indexes.json` with copies from your current app, then deploy: `npx firebase use <project-id>` and `npx firebase deploy --only firestore:rules` (and `firestore:indexes` when needed). See `docs/PHASE1_CHECKLIST.md`.

4. **Run dev**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project layout

- `src/app/` – App Router pages (client portal, coach dashboard)
- `src/components/ui/` – Primitives (Button, Input, Card)
- `src/lib/firebase.ts` – Firebase client init (Auth, Firestore, Storage)
- `docs/` – Schema, rebuild prompt, startup checklist

## Deploy

Build once, then deploy to your target(s) so all URLs serve the same version:

```bash
npm run build
# Then deploy to Firebase Hosting and/or Cloud Run per your setup
```

Keep `firestore.rules` and `firestore.indexes.json` in sync with the Firebase project; deploy indexes with `firebase deploy --only firestore:indexes` when needed.

## Docs

- **CTO_DEVELOPMENT_PLAN.md** – Phased build plan (Phase 1 → 5 + optional 6)
- **PHASE1_CHECKLIST.md** – Phase 1: Firebase & real data (env, rules, indexes, verify)
- **DATA_SCHEMA_FOR_NEW_UI.md** – Firestore collections and field names (single source of truth)
- **FORM_BUILDER_SCHEMA.md** – Forms + questions schema and form builder API (Phase 4)
- **CTO_CHECKIN_REBUILD_PROMPT.md** – Design principles and rebuild brief
- **NEW_REPO_STARTUP_CHECKLIST.md** – What to copy, env, and order of operations
