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

// GET: one question.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { questionId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: questionId, text: "Sample", type: "text" });
  }

  const db = getAdminDb();
  const snap = await db.collection("questions").doc(questionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = snap.data()!;
  if ((data.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: snap.id,
    text: data.text ?? data.title ?? "",
    type: data.type ?? "text",
    options: data.options ?? null,
    description: data.description ?? null,
    questionWeight: data.questionWeight ?? null,
    yesNoWeight: data.yesNoWeight ?? null,
    yesIsPositive: data.yesIsPositive ?? true,
    isRequired: data.isRequired ?? data.required ?? false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  });
}

// PUT: update question.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { questionId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const ref = db.collection("questions").doc(questionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((snap.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = ["text", "title", "type", "description", "category", "options", "questionWeight", "yesNoWeight", "yesIsPositive", "isRequired"];
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (update.text !== undefined) update.title = update.text;

  await ref.update(update);
  return NextResponse.json({ ok: true });
}

// DELETE: delete question (caller should remove from forms first).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { questionId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const snap = await db.collection("questions").doc(questionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((snap.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.collection("questions").doc(questionId).delete();
  return NextResponse.json({ ok: true });
}
