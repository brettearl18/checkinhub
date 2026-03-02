import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { getDownloadURL } from "firebase-admin/storage";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["audio/webm", "audio/webm;codecs=opus", "audio/ogg", "audio/mp4", "audio/mpeg"];

/**
 * POST: upload a single audio file for coach final voice feedback.
 * Multipart form: "file" (audio blob from MediaRecorder).
 * Returns { url: string } for use in POST .../feedback with feedbackType: "voice", content: url.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string; responseId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { clientId, responseId } = await params;

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

  const type = (file.type || "").toLowerCase();
  const allowed =
    type.startsWith("audio/webm") ||
    type.startsWith("audio/ogg") ||
    type.startsWith("audio/mp4") ||
    type.startsWith("audio/mpeg");
  if (!allowed) {
    return NextResponse.json(
      { error: "Allowed types: webm, ogg, mp4, mpeg" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists || (clientSnap.data() as { coachId?: string }).coachId !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const responseSnap = await db.collection("formResponses").doc(responseId).get();
  if (!responseSnap.exists || (responseSnap.data() as { clientId?: string }).clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = type.includes("webm") ? "webm" : type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : "m4a";
  const path = `coach-feedback/${responseId}/final-${Date.now()}.${ext}`;

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(path);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fileRef.save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "private, max-age=31536000" },
    });

    const url = await getDownloadURL(fileRef);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload-voice]", err);
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 }
    );
  }
}
