import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

const CHUNK = 30;

// GET: list progress images for all of this coach's clients (for gallery).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const clientsSnap = await db.collection("clients").where("coachId", "==", coachId).get();
  const clientIds = clientsSnap.docs.map((d) => d.id);
  const clientNames = new Map(
    clientsSnap.docs.map((d) => {
      const data = d.data();
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || data.email || d.id;
      return [d.id, name];
    })
  );

  const images: {
    id: string;
    clientId: string;
    clientName: string;
    imageUrl: string;
    imageType: string | null;
    orientation: string | null;
    caption: string | null;
    uploadedAt: string | null;
  }[] = [];

  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const chunk = clientIds.slice(i, i + CHUNK);
    const snap = await db
      .collection("progress_images")
      .where("clientId", "in", chunk)
      .get();

    for (const d of snap.docs) {
      const data = d.data();
      images.push({
        id: d.id,
        clientId: data.clientId as string,
        clientName: clientNames.get(data.clientId as string) ?? (data.clientId as string),
        imageUrl: data.imageUrl ?? "",
        imageType: data.imageType ?? null,
        orientation: data.orientation ?? null,
        caption: data.caption ?? null,
        uploadedAt: toDate(data.uploadedAt),
      });
    }
  }

  images.sort((a, b) => {
    const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json(images.slice(0, 200));
}
