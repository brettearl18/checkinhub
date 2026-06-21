import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { resolveClientOwnerIds } from "@/lib/client-assignment-ownership";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

/** GET: recently missed (skipped) check-ins the client can undo. */
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const db = getAdminDb();
    const idsToQuery = [...(await resolveClientOwnerIds(db, identity))];
    const allDocs: {
      id: string;
      formTitle: string | null;
      reflectionWeekStart: string | null;
      updatedAt: string | null;
    }[] = [];

    for (const id of idsToQuery) {
      const snap = await db
        .collection("check_in_assignments")
        .where("clientId", "==", id)
        .where("status", "==", "skipped")
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        allDocs.push({
          id: d.id,
          formTitle: (data.formTitle as string | null) ?? null,
          reflectionWeekStart: (data.reflectionWeekStart as string | null) ?? null,
          updatedAt: toIso(data.skippedAt ?? data.updatedAt),
        });
      }
    }

    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    unique.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json(unique.slice(0, 50));
  } catch (err) {
    console.error("[check-in/missed-assignments]", err);
    return NextResponse.json({ error: "Failed to load missed check-ins" }, { status: 500 });
  }
}
