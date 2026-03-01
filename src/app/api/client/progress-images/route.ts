import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { getDownloadURL } from "firebase-admin/storage";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET: list progress images for this client.
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("progress_images")
      .where("clientId", "==", clientId)
      .orderBy("uploadedAt", "desc")
      .get();

    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        clientId: data.clientId,
        imageUrl: data.imageUrl,
        imageType: data.imageType ?? null,
        orientation: data.orientation ?? null,
        caption: data.caption ?? null,
        uploadedAt: toDate(data.uploadedAt),
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("[client/progress-images GET]", err);
    return NextResponse.json(
      { error: "Failed to load progress images" },
      { status: 500 }
    );
  }
}

// POST: upload a progress image (multipart: file, imageType?, caption?).
export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Allowed types: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 }
    );
  }

  const imageType = (formData.get("imageType") as string)?.trim() || "other";
  const caption = (formData.get("caption") as string)?.trim() || null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `progress_images/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(path);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const imageUrl = await getDownloadURL(fileRef);

    const db = getAdminDb();
    const now = new Date();
    const docRef = await db.collection("progress_images").add({
      clientId,
      imageUrl,
      imageType,
      caption,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: docRef.id,
      imageUrl,
      imageType,
      caption,
      uploadedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[client/progress-images POST]", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
