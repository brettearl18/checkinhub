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

// GET: one form with full question docs (for builder).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { formId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      id: formId,
      title: "Sample",
      description: "",
      category: "",
      questions: [],
      questionDocs: [],
      isActive: true,
    });
  }

  const db = getAdminDb();
  const formSnap = await db.collection("forms").doc(formId).get();
  if (!formSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const formData = formSnap.data()!;
  if ((formData.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const questionIds = (formData.questions as string[]) ?? [];
  const questionDocs: Array<Record<string, unknown>> = [];
  for (const qid of questionIds) {
    const qSnap = await db.collection("questions").doc(qid).get();
    if (qSnap.exists) {
      const d = qSnap.data()!;
      questionDocs.push({
        id: qSnap.id,
        text: d.text ?? d.title ?? "",
        type: d.type ?? "text",
        options: d.options ?? null,
        description: d.description ?? null,
        questionWeight: d.questionWeight ?? null,
        isRequired: d.isRequired ?? d.required ?? false,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
      });
    }
  }

  return NextResponse.json({
    id: formSnap.id,
    title: formData.title ?? "",
    description: formData.description ?? "",
    category: formData.category ?? "",
    questions: questionIds,
    questionDocs,
    estimatedTime: formData.estimatedTime ?? null,
    isStandard: formData.isStandard ?? false,
    isActive: formData.isActive !== false,
    isArchived: formData.isArchived ?? false,
    createdAt: toDate(formData.createdAt),
    updatedAt: toDate(formData.updatedAt),
  });
}

// PATCH: update form (title, description, category, questionIds, isActive, isArchived).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { formId } = await params;

  let body: {
    title?: string;
    description?: string;
    category?: string;
    questionIds?: string[];
    isActive?: boolean;
    isArchived?: boolean;
    estimatedTime?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const ref = db.collection("forms").doc(formId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((snap.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = String(body.title).trim();
  if (body.description !== undefined) update.description = String(body.description).trim();
  if (body.category !== undefined) update.category = String(body.category).trim();
  if (body.questionIds !== undefined) update.questions = body.questionIds;
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.isArchived !== undefined) update.isArchived = body.isArchived;
  if (body.estimatedTime !== undefined) update.estimatedTime = body.estimatedTime;

  await ref.update(update);
  return NextResponse.json({ ok: true });
}

// DELETE: delete form doc only (not questions).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const authResult = await requireCoach(_request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { formId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminDb();
  const snap = await db.collection("forms").doc(formId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((snap.data()!.coachId as string) !== coachId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.collection("forms").doc(formId).delete();
  return NextResponse.json({ ok: true });
}
