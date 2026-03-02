import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

const WHERE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone_call: "Phone Call",
  email: "Email",
  checkinhub: "CheckinHub",
  other: "Other",
};

// GET: list of coach review summaries for this client (where responded, notes, progress rating per check-in).
export async function GET(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("formResponses")
    .where("clientId", "==", clientId)
    .where("reviewedByCoach", "==", true)
    .get();

  const list = snap.docs
    .map((d) => {
      const data = d.data();
      const whereResponded = Array.isArray(data.reviewWhereResponded) ? data.reviewWhereResponded : [];
      const reviewedAt = toDate(data.reviewedAt);
      return {
        responseId: d.id,
        formTitle: (data.formTitle as string) ?? "",
        submittedAt: toDate(data.submittedAt),
        reviewedAt,
        whereResponded: whereResponded.map((k: string) => WHERE_LABELS[k] || k),
        notes: typeof data.reviewNotes === "string" ? data.reviewNotes : null,
        progressRating: typeof data.reviewProgressRating === "number" ? data.reviewProgressRating : null,
      };
    })
    .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""))
    .slice(0, 50);

  return NextResponse.json(list);
}
