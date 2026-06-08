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

function storagePathFromUrl(imageUrl: string): string | null {
  try {
    const u = new URL(imageUrl);
    const encoded = u.pathname.split("/o/")[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split("?")[0] ?? encoded);
  } catch {
    return null;
  }
}

async function getOwnedEntry(coachId: string, id: string) {
  const db = getAdminDb();
  const ref = db.collection("coach_hall_of_fame").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const data = doc.data()!;
  if (data.coachId !== coachId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ref, data };
}

async function deleteStorageFile(imageUrl: string, storagePath?: string | null) {
  if (!isAdminConfigured()) return;
  const path = storagePath ?? storagePathFromUrl(imageUrl);
  if (!path) return;
  try {
    const bucket = getAdminStorage().bucket();
    await bucket.file(path).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn("[coach/hall-of-fame] storage delete failed:", err);
  }
}

function entryJson(id: string, data: Record<string, unknown>) {
  return {
    id,
    clientId: data.clientId ?? "",
    clientName: data.clientName ?? "",
    pose: data.pose ?? "",
    imageUrl: data.imageUrl ?? "",
    beforeDate: data.beforeDate ?? null,
    afterDate: data.afterDate ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/** PATCH: update metadata and/or replace the highlight image. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const owned = await getOwnedEntry(coachId, id);
  if ("error" in owned) return owned.error;
  const { ref, data } = owned;

  const contentType = request.headers.get("content-type") ?? "";
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const pose = (formData.get("pose") as string)?.trim();
    const beforeDate = (formData.get("beforeDate") as string)?.trim();
    const afterDate = (formData.get("afterDate") as string)?.trim();
    if (pose !== undefined && pose !== "") updates.pose = pose;
    if (beforeDate) updates.beforeDate = beforeDate;
    if (afterDate) updates.afterDate = afterDate;

    const file = formData.get("file");
    if (file && file instanceof File) {
      const storage = getAdminStorage();
      const bucket = storage.bucket();
      const path = `coach_hall_of_fame/${coachId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
      const fileRef = bucket.file(path);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fileRef.save(buffer, {
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const imageUrl = await getDownloadURL(fileRef);
      await deleteStorageFile(data.imageUrl as string, data.storagePath as string | undefined);
      updates.imageUrl = imageUrl;
      updates.storagePath = path;
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body.pose === "string") updates.pose = body.pose.trim();
    if (typeof body.beforeDate === "string") updates.beforeDate = body.beforeDate.trim() || null;
    if (typeof body.afterDate === "string") updates.afterDate = body.afterDate.trim() || null;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    await ref.update(updates);
    const updated = await ref.get();
    return NextResponse.json(entryJson(updated.id, updated.data()!));
  } catch (err) {
    console.error("[coach/hall-of-fame PATCH]", err);
    return NextResponse.json({ error: "Failed to update highlight" }, { status: 500 });
  }
}

/** DELETE: remove a hall of fame highlight. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { id } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const owned = await getOwnedEntry(coachId, id);
  if ("error" in owned) return owned.error;
  const { ref, data } = owned;

  try {
    await deleteStorageFile(data.imageUrl as string, data.storagePath as string | undefined);
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[coach/hall-of-fame DELETE]", err);
    return NextResponse.json({ error: "Failed to delete highlight" }, { status: 500 });
  }
}
