# Phase 1: Firebase & real data – checklist

Use this when running Phase 1. See **CTO_DEVELOPMENT_PLAN.md** for full scope and exit criteria.

---

## 1. Environment

- [ ] Copy `.env.template` to `.env.local` (do not commit `.env.local`).
- [ ] Fill **client** keys from Firebase Console → Project settings (or from your current app’s env):
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - (optional) `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- [ ] For **API routes** (real identity + Firestore from backend), add:
  - `FIREBASE_SERVICE_ACCOUNT` = single-line JSON from Firebase Console → Project settings → Service accounts → Generate new private key.  
  - Escape newlines in the private key as `\\n`.

**Tip:** Use a **dev/staging** Firebase project for Phase 1 if you don’t want to touch live data. Switch to the live project when you’re ready to go live.

---

## 2. Firestore rules and indexes

- [ ] Copy your **current live app’s** `firestore.rules` into this repo’s **root** (replace the placeholder).
- [ ] Copy your **current live app’s** `firestore.indexes.json` into this repo’s **root** (replace the empty file).
- [ ] From this repo, deploy to the **same** Firebase project:
  - `npx firebase use <project-id>`   (e.g. `checkinv5` or your dev project)
  - `npx firebase deploy --only firestore:rules`
  - `npx firebase deploy --only firestore:indexes`   (if you added/changed indexes)

**Important:** No data export/import. Same project = same data; you’re only deploying rules and indexes.

---

## 3. Verify

- [ ] **Sign-in:** Use a real client (or coach) email/password. You should be redirected to `/client` or `/coach` and see real identity (no mock).
- [ ] **New check-in:** Choose a form (from Firestore) and a week. Resolve should create or find a real `check_in_assignments` doc with `reflectionWeekStart` set. Submit should write to `formResponses` and update the assignment.
- [ ] **Resume:** Dashboard “Resume” list shows real resumable assignments from Firestore.
- [ ] **Production safety:** With `NODE_ENV=production` and `FIREBASE_SERVICE_ACCOUNT` unset, APIs return 503 (no mocks in production).

---

## 4. Sign off

- [ ] All Phase 1 exit criteria in **CTO_DEVELOPMENT_PLAN.md** are met.
- [ ] Ready to start Phase 2 (Client polish).

---

**Firebase CLI:** If you don’t have it, run `npm install -g firebase-tools` and `firebase login`. This repo’s `firebase.json` points at `firestore.rules` and `firestore.indexes.json` in the root.
