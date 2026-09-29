import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

const PUSH_TOKENS_COLLECTION = "pushTokens";

export interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  /** Path to open when user taps the notification (e.g. /client/check-in/new) */
  actionPath?: string;
  tag?: string;
}

/**
 * Get all FCM tokens stored for a user.
 */
export async function getPushTokensForUser(userId: string): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(PUSH_TOKENS_COLLECTION)
    .where("userId", "==", userId)
    .get();
  const tokens: string[] = [];
  snap.docs.forEach((d) => {
    const t = (d.data() as { token?: string }).token;
    if (typeof t === "string" && t) tokens.push(t);
  });
  return tokens;
}

/**
 * Send a web push notification to all of a user's registered devices.
 * No-op if no tokens or if messaging is not configured.
 */
/** FCM error codes meaning the token will never work again. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function sendPushToUser(options: SendPushOptions): Promise<{ sent: number; failed: number }> {
  const { userId, title, body, actionPath = "/client", tag } = options;
  const db = getAdminDb();
  const snap = await db.collection(PUSH_TOKENS_COLLECTION).where("userId", "==", userId).get();
  const tokenDocs = snap.docs
    .map((d) => ({ ref: d.ref, token: (d.data() as { token?: string }).token }))
    .filter((t): t is { ref: typeof t.ref; token: string } => typeof t.token === "string" && t.token.length > 0);
  if (tokenDocs.length === 0) return { sent: 0, failed: 0 };

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const link = baseUrl ? `${baseUrl}${actionPath}` : actionPath;

  let messaging;
  try {
    messaging = getAdminMessaging();
  } catch {
    return { sent: 0, failed: tokenDocs.length };
  }

  let sent = 0;
  let failed = 0;
  for (const { ref, token } of tokenDocs) {
    try {
      await messaging.send({
        token,
        notification: { title, body },
        webpush: {
          fcmOptions: { link },
          headers: { Urgency: "normal" },
          notification: {
            icon: `${baseUrl}/icon-192.png`,
            badge: `${baseUrl}/badge-96.png`,
          },
        },
        data: {
          url: link,
          link,
          tag: tag || "checkinhub",
        },
      });
      sent++;
    } catch (err) {
      failed++;
      const code = (err as { code?: string }).code;
      if (code && DEAD_TOKEN_CODES.has(code)) {
        await ref.delete().catch(() => {});
      }
    }
  }
  return { sent, failed };
}
