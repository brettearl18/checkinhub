import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage, isAdminConfigured } from "@/lib/firebase-admin";
import { getDownloadURL } from "firebase-admin/storage";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_IMAGE_TYPES = new Set([
  "before_front",
  "before_side",
  "before_back",
  "after_front",
  "after_side",
  "after_back",
  "before",
  "progress",
  "after",
  "other",
]);

function parsePhotoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function assertCoachOwnsClient(coachId: string, clientId: string) {
  const db = getAdminDb();
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  if ((snap.data() as { coachId?: string }).coachId !== coachId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

/** Coach upload for legacy / backfill progress photos with a custom photo date. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const coachId = authResult.identity.coachId!;
  const { clientId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const access = await assertCoachOwnsClient(coachId, clientId);
  if (access.error) return access.error;

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
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const imageType = (formData.get("imageType") as string)?.trim() || "before_front";
  if (!ALLOWED_IMAGE_TYPES.has(imageType)) {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
  }

  const photoDate = parsePhotoDate(formData.get("photoDate") as string | null);
  if (!photoDate) {
    return NextResponse.json(
      { error: "photoDate is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (photoDate > today) {
    return NextResponse.json({ error: "Photo date cannot be in the future" }, { status: 400 });
  }

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
    const now = new Date();

    const db = getAdminDb();
    const docRef = await db.collection("progress_images").add({
      clientId,
      coachId,
      imageUrl,
      imageType,
      caption,
      uploadedAt: photoDate,
      importedByCoach: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id: docRef.id,
      imageUrl,
      imageType,
      caption,
      uploadedAt: photoDate.toISOString(),
    });
  } catch (err) {
    console.error("[coach/clients/progress-images POST]", err);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
