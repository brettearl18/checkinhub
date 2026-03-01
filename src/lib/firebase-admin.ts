import * as admin from "firebase-admin";

let app: admin.app.App | undefined;

function getAdminApp(): admin.app.App {
  const existing = admin.apps.find((a) => a?.name === "checkinhub-admin");
  if (existing) return existing as admin.app.App;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  }
  const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  return admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) },
    "checkinhub-admin"
  );
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

export function getAdminAuth(): admin.auth.Auth {
  if (!app) app = getAdminApp();
  return admin.auth(app);
}

export function getAdminDb(): admin.firestore.Firestore {
  if (!app) app = getAdminApp();
  return admin.firestore(app);
}

export async function verifyIdToken(token: string) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(token);
}
