import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";

function isAllowedProgressImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
    if (parsed.hostname === "firebasestorage.googleapis.com") return true;
    if (parsed.hostname === "storage.googleapis.com") return true;
    if (bucket && parsed.hostname === "storage.googleapis.com" && parsed.pathname.includes(bucket)) {
      return true;
    }
    if (parsed.hostname.endsWith(".firebasestorage.app")) return true;
    return false;
  } catch {
    return false;
  }
}

/** Proxy progress photos for canvas export (avoids CORS on Firebase Storage). */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

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

  if (!isAllowedProgressImageUrl(url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Image not found" }, { status: upstream.status });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
