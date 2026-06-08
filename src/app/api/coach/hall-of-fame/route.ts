import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage, isAdminConfigured } from "@/lib/firebase-admin";
import { getDownloadURL } from "firebase-admin/storage";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

/** GET: coach hall of fame — saved before/after share images. */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("coach_hall_of_fame")
      .where("coachId", "==", coachId)
      .limit(100)
      .get();

    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          clientId: data.clientId ?? "",
          clientName: data.clientName ?? "",
          pose: data.pose ?? "",
          imageUrl: data.imageUrl ?? "",
          beforeDate: data.beforeDate ?? null,
          afterDate: data.afterDate ?? null,
          createdAt: toDate(data.createdAt),
        };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    return NextResponse.json(list);
  } catch (err) {
    console.error("[coach/hall-of-fame GET]", err);
    return NextResponse.json({ error: "Failed to load hall of fame" }, { status: 500 });
  }
}

/** POST: save a rendered 4:5 share image to the coach hall of fame. */
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const clientId = (formData.get("clientId") as string)?.trim();
  const clientName = (formData.get("clientName") as string)?.trim() || "Client";
  const pose = (formData.get("pose") as string)?.trim() || "";
  const beforeDate = (formData.get("beforeDate") as string)?.trim() || null;
  const afterDate = (formData.get("afterDate") as string)?.trim() || null;

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const path = `coach_hall_of_fame/${coachId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(path);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    const imageUrl = await getDownloadURL(fileRef);
    const now = new Date();

    const docRef = await db.collection("coach_hall_of_fame").add({
      coachId,
      clientId,
      clientName,
      pose,
      imageUrl,
      beforeDate,
      afterDate,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: docRef.id,
      imageUrl,
      clientId,
      clientName,
      pose,
      beforeDate,
      afterDate,
      createdAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[coach/hall-of-fame POST]", err);
    return NextResponse.json({ error: "Failed to save highlight" }, { status: 500 });
  }
}
