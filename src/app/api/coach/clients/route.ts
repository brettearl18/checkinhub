import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "mock-client-1", firstName: "Test", lastName: "Client", email: "client@example.com" },
    ]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("clients")
    .where("coachId", "==", coachId)
    .get();

  const clients = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      email: data.email ?? "",
      status: data.status ?? "",
    };
  });
  return NextResponse.json(clients);
}
