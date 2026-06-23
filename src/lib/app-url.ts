/** Resolve public app base URL for emails and invite links. */
export function resolveAppBaseUrl(requestUrl?: string): string {
  let baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!baseUrl && requestUrl) {
    try {
      baseUrl = new URL(requestUrl).origin;
    } catch {
      // ignore
    }
  }
  return baseUrl.replace(/\/$/, "");
}
