import { getAdminStorage } from "@/lib/firebase-admin";

const DEFAULT_CORS_ORIGINS = [
  "https://checkin.vanahealth.com.au",
  "https://checkinhub-alpha.vercel.app",
  "http://localhost:3000",
];

let corsEnsured = false;

/**
 * Allow browser PUT of signed upload URLs to the Storage bucket.
 * Safe to call on every upload start; only writes CORS once per server instance.
 */
export async function ensureProgressPhotoUploadCors(extraOrigins: string[] = []): Promise<void> {
  if (corsEnsured) return;
  const bucket = getAdminStorage().bucket();
  const origin = Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...extraOrigins.filter(Boolean)]));
  try {
    await bucket.setCorsConfiguration([
      {
        origin,
        method: ["GET", "HEAD", "PUT", "OPTIONS"],
        responseHeader: ["Content-Type", "Content-Length", "x-goog-resumable"],
        maxAgeSeconds: 3600,
      },
    ]);
    corsEnsured = true;
  } catch (err) {
    console.error("[progress-photo-storage-cors] setCorsConfiguration failed", err);
  }
}
