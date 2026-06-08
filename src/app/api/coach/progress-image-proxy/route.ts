import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb, getAdminStorage, isAdminConfigured } from "@/lib/firebase-admin";

function decodeUrlParam(raw: string): string {
  let url = raw;
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(url);
      if (next === url) break;
      url = next;
    }
  } catch {
    url = raw;
  }
  return url;
}

function isAllowedProgressImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "firebasestorage.googleapis.com") return true;
    if (parsed.hostname === "storage.googleapis.com") return true;
    if (parsed.hostname.endsWith(".firebasestorage.app")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Parse Firebase Storage download URL → bucket + object path. */
function parseFirebaseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname === "firebasestorage.googleapis.com") {
      const match = u.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) return null;
      const bucket = decodeURIComponent(match[1]);
      const path = decodeURIComponent(match[2].replace(/\+/g, " "));
      return { bucket, path };
    }
    if (u.hostname === "storage.googleapis.com") {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return null;
      return { bucket: segments[0]!, path: segments.slice(1).join("/") };
    }
    return null;
  } catch {
    return null;
  }
}

function clientIdFromStoragePath(path: string): string | null {
  const match = /^progress_images\/([^/]+)\//.exec(path);
  return match ? match[1]! : null;
}

async function coachCanAccessClient(coachId: string, clientId: string): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) return false;
  return snap.data()?.coachId === coachId;
}

async function downloadViaAdminSdk(url: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const parsed = parseFirebaseStorageUrl(url);
  if (!parsed) return null;

  const storage = getAdminStorage();
  const bucket = storage.bucket(parsed.bucket);
  const file = bucket.file(parsed.path);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [metadata] = await file.getMetadata();
  const [bytes] = await file.download();
  const contentType =
    typeof metadata.contentType === "string" && metadata.contentType.startsWith("image/")
      ? metadata.contentType
      : "image/jpeg";
  return { bytes, contentType };
}

/** Proxy progress photos for canvas export (server-side Firebase download). */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const url = decodeUrlParam(raw);
  if (!isAllowedProgressImageUrl(url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const parsed = parseFirebaseStorageUrl(url);
  if (parsed) {
    const clientId = clientIdFromStoragePath(parsed.path);
    if (clientId) {
      const allowed = await coachCanAccessClient(authResult.identity.coachId!, clientId);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  try {
    const fromAdmin = await downloadViaAdminSdk(url);
    if (fromAdmin) {
      return new NextResponse(new Uint8Array(fromAdmin.bytes), {
        headers: {
          "Content-Type": fromAdmin.contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Image not found (${upstream.status})` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[coach/progress-image-proxy]", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
