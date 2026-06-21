/** User-facing message for Firebase Auth token / sign-in failures. */
export function getFirebaseAuthErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("securetoken.googleapis.com") ||
    msg.includes("granttoken-are-blocked") ||
    msg.includes("API_KEY_SERVICE_BLOCKED")
  ) {
    return "Your session expired and could not be refreshed. Sign out, sign back in, and try again. If it keeps failing, Firebase API key restrictions may need Token Service API enabled in Google Cloud Console.";
  }

  if (msg.includes("identitytoolkit") && msg.includes("blocked")) {
    return "Sign-in services are blocked for this app. Try again later or contact support.";
  }

  if (msg.includes("auth/network-request-failed")) {
    return "Network error while refreshing your session. Check your connection and try again.";
  }

  if (msg.includes("auth/user-token-expired") || msg.includes("auth/id-token-expired")) {
    return "Your session expired. Sign out and sign back in, then try again.";
  }

  return msg || "Authentication error";
}

export function isFirebaseAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Firebase:") ||
    msg.includes("securetoken.googleapis.com") ||
    msg.includes("identitytoolkit") ||
    msg.includes("auth/")
  );
}
