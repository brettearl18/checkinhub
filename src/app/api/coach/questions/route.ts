import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

// GET: list questions owned by this coach.
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "q-1", text: "How are you feeling?", type: "scale", options: null },
      { id: "q-2", text: "Any notes?", type: "textarea", options: null },
    ]);
  }

  const db = getAdminDb();
  const snap = await db
    .collection("questions")
    .where("coachId", "==", coachId)
    .get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      text: data.text ?? data.title ?? "",
      type: data.type ?? "text",
      options: data.options ?? null,
      description: data.description ?? null,
      questionWeight: data.questionWeight ?? null,
      isRequired: data.isRequired ?? data.required ?? false,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
  return NextResponse.json(list);
}

// POST: create question.
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: {
    text?: string;
    title?: string;
    type?: string;
    description?: string;
    category?: string;
    options?: string[] | Array<{ text: string; weight?: number }>;
    questionWeight?: number;
    yesNoWeight?: number;
    yesIsPositive?: boolean;
    isRequired?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? body.title ?? "").toString().trim();
  const type = (body.type ?? "text").toString();
  if (!text) {
    return NextResponse.json({ error: "text or title required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "q-mock-1" });
  }

  const db = getAdminDb();
  const now = new Date();
  const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await db.collection("questions").doc(questionId).set({
    id: questionId,
    text,
    title: text,
    type,
    description: (body.description ?? "").toString().trim() || null,
    category: (body.category ?? "").toString().trim() || null,
    coachId,
    options: body.options ?? null,
    questionWeight: body.questionWeight ?? null,
    yesNoWeight: body.yesNoWeight ?? null,
    yesIsPositive: body.yesIsPositive ?? true,
    isRequired: body.isRequired ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: questionId });
}
