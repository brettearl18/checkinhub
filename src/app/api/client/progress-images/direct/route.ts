import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage, isAdminConfigured } from "@/lib/firebase-admin";
import { getDownloadURL } from "firebase-admin/storage";
import { evaluateAndAwardAchievements } from "@/lib/award-achievements";
import {
  isProgressPhotoDateInFuture,
  parseProgressPhotoDateString,
} from "@/lib/progress-photo-dates";
import { processProgressPhotoToJpeg } from "@/lib/progress-photo-process-server";
import { ensureProgressPhotoUploadCors } from "@/lib/progress-photo-storage-cors";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PICK_BYTES = 20 * 1024 * 1024;
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

function safeExt(fileName: string | undefined, contentType: string): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("heif")) return "heif";
  return "bin";
}

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action === "start") {
    const contentType = String(body.contentType || "application/octet-stream");
    const fileName = String(body.fileName || "photo.jpg");
    const byteSize = Number(body.byteSize || 0);
    if (!byteSize || byteSize > MAX_PICK_BYTES) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
    }

    const origins = Array.isArray(body.origins) ? (body.origins as unknown[]).map(String) : [];
    await ensureProgressPhotoUploadCors(origins);

    const ext = safeExt(fileName, contentType);
    const storagePath = `progress_images/${clientId}/raw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const fileRef = getAdminStorage().bucket().file(storagePath);
    const [uploadUrl] = await fileRef.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    return NextResponse.json({ uploadUrl, storagePath });
  }

  if (action === "complete") {
    const storagePath = String(body.storagePath || "");
    const contentType = String(body.contentType || "application/octet-stream");
    const fileName = String(body.fileName || "photo.jpg");
    const imageType = String(body.imageType || "other").trim() || "other";
    const caption =
      typeof body.caption === "string" && body.caption.trim() ? body.caption.trim() : null;
    const photoDateKey =
      typeof body.photoDate === "string" && body.photoDate.trim() ? body.photoDate.trim() : "";

    if (!storagePath.startsWith(`progress_images/${clientId}/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(imageType)) {
      return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
    }

    const isBaselineImport = imageType.startsWith("before_");
    const parsedPhotoDate = photoDateKey ? parseProgressPhotoDateString(photoDateKey) : null;
    if (isBaselineImport && !parsedPhotoDate) {
      return NextResponse.json(
        { error: "photoDate is required for baseline photos (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (photoDateKey && isProgressPhotoDateInFuture(photoDateKey)) {
      return NextResponse.json({ error: "Photo date cannot be in the future" }, { status: 400 });
    }

    const bucket = getAdminStorage().bucket();
    const rawRef = bucket.file(storagePath);
    const [exists] = await rawRef.exists();
    if (!exists) {
      return NextResponse.json({ error: "Upload not found. Please try again." }, { status: 400 });
    }

    try {
      const [rawBuffer] = await rawRef.download();
      const processed = await processProgressPhotoToJpeg(rawBuffer, contentType, fileName);
      const finalPath = `progress_images/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
      const finalRef = bucket.file(finalPath);
      await finalRef.save(processed.buffer, {
        contentType: processed.contentType,
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      await rawRef.delete({ ignoreNotFound: true });

      const imageUrl = await getDownloadURL(finalRef);
      const recordedAt = parsedPhotoDate ?? new Date();
      const now = new Date();
      const db = getAdminDb();
      const docRef = await db.collection("progress_images").add({
        clientId,
        imageUrl,
        imageType,
        caption,
        uploadedAt: recordedAt,
        ...(isBaselineImport ? { importedBeforeCheckinHUB: true } : {}),
        createdAt: now,
        updatedAt: now,
      });
      const newlyEarned = await evaluateAndAwardAchievements(db, clientId);

      return NextResponse.json({
        id: docRef.id,
        imageUrl,
        imageType,
        caption,
        uploadedAt: recordedAt.toISOString(),
        newlyEarned,
      });
    } catch (err) {
      console.error("[client/progress-images/direct complete]", err);
      return NextResponse.json(
        {
          error:
            "Could not process this photo. Please try again, or choose the photo from Recents as a JPEG.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
