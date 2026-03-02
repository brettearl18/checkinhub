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
export async function sendPushToUser(options: SendPushOptions): Promise<{ sent: number; failed: number }> {
  const { userId, title, body, actionPath = "/client", tag } = options;
  const tokens = await getPushTokensForUser(userId);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = baseUrl ? `${baseUrl.replace(/\/$/, "")}${actionPath}` : actionPath;

  let messaging;
  try {
    messaging = getAdminMessaging();
  } catch {
    return { sent: 0, failed: tokens.length };
  }

  let sent = 0;
  let failed = 0;
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title, body },
        webpush: {
          fcmOptions: { link },
          headers: { Urgency: "normal" },
        },
        data: {
          url: link,
          link,
          tag: tag || "checkinhub",
        },
      });
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
