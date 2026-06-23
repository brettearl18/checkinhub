import { NextResponse } from "next/server";
import { isAdminConfigured, verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import { isClosedClientStatus } from "@/lib/client-status";
import { isStripePortalAccessSuspended } from "@/lib/client-account-closure";

export interface ResolvedIdentity {
  uid: string;
  role: string | null;
  clientId: string | null;
  coachId: string | null;
}

export interface RequireClientOptions {
  /** Allow profile read when account is closed or Stripe billing has ended. */
  allowLimitedPortalAccess?: boolean;
  /** Allow delete-data routes for closed accounts only. */
  allowClosedAccount?: boolean;
}

export async function getIdentityFromToken(token: string): Promise<ResolvedIdentity> {
  if (!isAdminConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ServiceUnavailable");
    }
    return {
      uid: "mock-uid",
      role: "client",
      clientId: "mock-client-1",
      coachId: null,
    };
  }
  const decoded = await verifyIdToken(token);
  const uid = decoded.uid;
  const db = getAdminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data();
  const role = (userData?.role ?? userData?.roles?.[0]) as string | undefined;
  let clientId: string | null = null;
  let coachId: string | null = null;
  if (role === "client") {
    const byAuthUid = await db
      .collection("clients")
      .where("authUid", "==", uid)
      .limit(1)
      .get();
    if (!byAuthUid.empty) {
      clientId = byAuthUid.docs[0].id;
    } else {
      const clientByUid = await db.collection("clients").doc(uid).get();
      if (clientByUid.exists) clientId = clientByUid.id;
    }
  } else if (role === "coach") {
    coachId = uid;
  }
  return { uid, role: role ?? null, clientId, coachId };
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function requireClient(
  request: Request,
  options?: RequireClientOptions
): Promise<
  | { identity: ResolvedIdentity; token: string }
  | { error: NextResponse }
> {
  const token = getTokenFromRequest(request);
  if (!token) return { error: NextResponse.json({ error: "Missing token" }, { status: 401 }) };
  try {
    const identity = await getIdentityFromToken(token);
    if (identity.role !== "client" || !identity.clientId) {
      return { error: NextResponse.json({ error: "Client access required" }, { status: 403 }) };
    }

    if (isAdminConfigured()) {
      const db = getAdminDb();
      const clientSnap = await db.collection("clients").doc(identity.clientId).get();
      const clientData = clientSnap.data() ?? {};
      const status = clientData.status as string | undefined;
      const closed = isClosedClientStatus(status);
      const stripeSuspended = isStripePortalAccessSuspended(clientData);

      if (closed && !options?.allowClosedAccount && !options?.allowLimitedPortalAccess) {
        return {
          error: NextResponse.json(
            { error: "Your account is closed. You can manage your data from Profile." },
            { status: 403 }
          ),
        };
      }

      if (stripeSuspended && !options?.allowLimitedPortalAccess) {
        return {
          error: NextResponse.json(
            {
              error:
                "Your subscription has ended. You can view your account status from Profile.",
            },
            { status: 403 }
          ),
        };
      }
    }

    return { identity, token };
  } catch (e) {
    if (e instanceof Error && e.message === "ServiceUnavailable") {
      return { error: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
    }
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

export async function requireCoach(request: Request): Promise<
  | { identity: ResolvedIdentity; token: string }
  | { error: NextResponse }
> {
  const token = getTokenFromRequest(request);
  if (!token) return { error: NextResponse.json({ error: "Missing token" }, { status: 401 }) };
  try {
    const identity = await getIdentityFromToken(token);
    if (identity.role !== "coach" || !identity.coachId) {
      return { error: NextResponse.json({ error: "Coach access required" }, { status: 403 }) };
    }
    return { identity, token };
  } catch (e) {
    if (e instanceof Error && e.message === "ServiceUnavailable") {
      return { error: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
    }
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}
