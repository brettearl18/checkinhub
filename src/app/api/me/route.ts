import { NextResponse } from "next/server";
import { isAdminConfigured, verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Firebase Admin not configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({
      role: "client",
      clientId: "mock-client-1",
      coachId: null,
    });
  }

  try {
    const decoded = await verifyIdToken(token);
    const uid = decoded.uid;
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const role = (userData?.role ?? userData?.roles?.[0]) as string | undefined;
    let clientId: string | null = null;
    let coachId: string | null = null;

    if (role === "client") {
      const clientByUid = await db.collection("clients").doc(uid).get();
      if (clientByUid.exists) {
        clientId = clientByUid.id;
      } else {
        const byAuthUid = await db
          .collection("clients")
          .where("authUid", "==", uid)
          .limit(1)
          .get();
        if (!byAuthUid.empty) clientId = byAuthUid.docs[0].id;
      }
    } else if (role === "coach") {
      coachId = uid;
    }

    const out: Record<string, unknown> = {
      role: role ?? null,
      clientId,
      coachId,
    };
    const userDataTyped = userData as { firstName?: string; lastName?: string } | undefined;
    if (userDataTyped?.firstName != null) out.firstName = userDataTyped.firstName;
    if (userDataTyped?.lastName != null) out.lastName = userDataTyped.lastName;
    if (role === "coach") {
      const coachSnap = await db.collection("coaches").doc(uid).get();
      const coachData = coachSnap.data() as { shortUID?: string } | undefined;
      if (coachData?.shortUID) out.coachCode = coachData.shortUID;
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
