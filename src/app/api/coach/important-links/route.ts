import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

const COLLECTION = "coachImportantLinks";

export interface ImportantLink {
  name: string;
  url: string;
}

function isValidUrl(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/coach/important-links
 * Returns the coach's saved important links (e.g. payment options).
 */
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json({ links: [] });
  }

  const db = getAdminDb();
  const doc = await db.collection(COLLECTION).doc(coachId).get();
  const data = doc.exists ? doc.data() : null;
  const links = Array.isArray(data?.links) ? data.links : [];
  const normalized = links
    .filter((l: unknown) => l && typeof (l as { name?: string }).name === "string" && typeof (l as { url?: string }).url === "string")
    .map((l: { name: string; url: string }) => ({ name: (l.name || "").trim(), url: (l.url || "").trim() }))
    .filter((l) => l.name || l.url);

  return NextResponse.json({ links: normalized });
}

/**
 * PATCH /api/coach/important-links
 * Body: { links: { name: string, url: string }[] }
 * Replaces the coach's saved links.
 */
export async function PATCH(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: { links?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.links) ? body.links : [];
  const links: ImportantLink[] = [];
  for (const item of raw) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!name && !url) continue;
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: `Invalid URL for "${name || "link"}". Use a full URL (e.g. https://...).` },
        { status: 400 }
      );
    }
    links.push({ name: name || "Link", url });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const db = getAdminDb();
  await db.collection(COLLECTION).doc(coachId).set({ links, updatedAt: new Date() }, { merge: true });

  return NextResponse.json({ ok: true, links });
}
