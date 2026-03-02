import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const clientId = authResult.identity.clientId!;
  const { assignmentId } = await params;

  if (!isAdminConfigured()) {
    return NextResponse.json({
      assignment: {
        id: assignmentId,
        formId: "form-1",
        formTitle: "Weekly check-in",
        status: "pending",
      },
      form: { id: "form-1", title: "Weekly check-in", questions: ["q1", "q2"] },
      questions: [
        { id: "q1", text: "How are you feeling this week? (1-10)", type: "scale" },
        { id: "q2", text: "Any notes for your coach?", type: "text" },
      ],
    });
  }

  const db = getAdminDb();
  const assignmentSnap = await db.collection("check_in_assignments").doc(assignmentId).get();
  if (!assignmentSnap.exists) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  const assignmentData = assignmentSnap.data()!;
  if (assignmentData.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reflectionWeekStart = assignmentData.reflectionWeekStart as string | undefined;
  if (reflectionWeekStart) {
    const thisMonday = thisMondayPerth();
    if (reflectionWeekStart >= thisMonday && !isWeekOpenPerth(reflectionWeekStart)) {
      const [y, m, d] = reflectionWeekStart.split("-").map(Number);
      const mon = new Date(y, m - 1, d);
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);
      const friStr = fri.toISOString().slice(0, 10);
      return NextResponse.json(
        { error: `This check-in opens Friday 9am Perth (${friStr}). Please come back then.` },
        { status: 403 }
      );
    }
  }

  const formId = assignmentData.formId as string;
  const formSnap = await db.collection("forms").doc(formId).get();
  if (!formSnap.exists) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  const formData = formSnap.data()!;
  const questionIds = (formData.questions as string[]) ?? [];
  const questionSnaps = await Promise.all(
    questionIds.map((id) => db.collection("questions").doc(id).get())
  );
  const questions = questionSnaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data() }));

  return NextResponse.json({
    assignment: { id: assignmentSnap.id, ...assignmentData },
    form: { id: formSnap.id, ...formData },
    questions,
  });
}
