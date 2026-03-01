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

// GET: list forms owned by this coach (for builder and assign dropdown).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  if (!isAdminConfigured()) {
    return NextResponse.json([
      { id: "form-1", title: "Weekly check-in", description: "Standard weekly reflection", category: "wellness", questions: [], isActive: true },
      { id: "form-2", title: "Progress check", description: "Monthly progress review", category: "progress", questions: [], isActive: true },
    ]);
  }

  const db = getAdminDb();
  const formsSnap = await db
    .collection("forms")
    .where("coachId", "==", coachId)
    .get();
  const forms = formsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? "",
      description: data.description ?? "",
      category: data.category ?? "",
      questions: Array.isArray(data.questions) ? data.questions : [],
      estimatedTime: data.estimatedTime ?? null,
      isStandard: data.isStandard ?? false,
      isActive: data.isActive !== false,
      isArchived: data.isArchived ?? false,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  });
  return NextResponse.json(forms);
}

// POST: create form (or copy from standard).
export async function POST(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;

  let body: {
    title: string;
    description?: string;
    category?: string;
    questionIds?: string[];
    estimatedTime?: number;
    isActive?: boolean;
    isCopyingStandard?: boolean;
    sourceFormId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, description = "", category = "", questionIds = [], estimatedTime, isActive = true, isCopyingStandard, sourceFormId } = body;
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ id: "form-mock-1" });
  }

  const db = getAdminDb();
  const now = new Date();
  const formId = `form-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let questions: string[] = [];

  let finalTitle = title.trim();
  if (isCopyingStandard && sourceFormId) {
    const sourceSnap = await db.collection("forms").doc(sourceFormId).get();
    if (!sourceSnap.exists) {
      return NextResponse.json({ error: "Source form not found" }, { status: 404 });
    }
    const sourceData = sourceSnap.data()!;
    if (finalTitle === "Copy" || !finalTitle) {
      finalTitle = `${sourceData.title ?? "Form"} (Copy)`;
    }
    const sourceQuestions = (sourceData.questions as string[]) ?? [];
    for (const qid of sourceQuestions) {
      const qSnap = await db.collection("questions").doc(qid).get();
      if (!qSnap.exists) continue;
      const qData = qSnap.data()!;
      const newQid = `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await db.collection("questions").doc(newQid).set({
        ...qData,
        id: newQid,
        coachId,
        createdAt: now,
        updatedAt: now,
      });
      questions.push(newQid);
    }
  } else {
    questions = Array.isArray(questionIds) ? questionIds : [];
  }

  await db.collection("forms").doc(formId).set({
    id: formId,
    title: finalTitle,
    description: (description ?? "").toString().trim(),
    category: (category ?? "").toString().trim(),
    coachId,
    questions,
    estimatedTime: estimatedTime ?? null,
    isStandard: false,
    isActive: isActive !== false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: formId });
}
