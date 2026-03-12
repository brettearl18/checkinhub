import { NextResponse } from "next/server";
import { requireClient } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";
import { thisMondayPerth, isWeekOpenPerth } from "@/lib/perth-date";

// reflectionWeekStart = Monday YYYY-MM-DD
function nextMondayAfter(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const authResult = await requireClient(request);
  if ("error" in authResult) return authResult.error;
  const { identity } = authResult;

  let body: { formId: string; reflectionWeekStart: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { formId, reflectionWeekStart } = body;
  if (!formId || !reflectionWeekStart) {
    return NextResponse.json(
      { error: "formId and reflectionWeekStart required" },
      { status: 400 }
    );
  }

  const clientId = identity.clientId!;

  if (!isAdminConfigured()) {
    const mockId = `mock-assignment-${formId}-${reflectionWeekStart}`;
    return NextResponse.json({ assignmentId: mockId });
  }

  // This week and next week open Friday 9am Perth only; past weeks are always open.
  const thisMonday = thisMondayPerth();
  if (reflectionWeekStart >= thisMonday && !isWeekOpenPerth(reflectionWeekStart)) {
    return NextResponse.json(
      { error: "This check-in opens Friday 9am Perth. Please try again then." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const clientSnapForStart = await db.collection("clients").doc(clientId).get();
  if (clientSnapForStart.exists) {
    const clientData = clientSnapForStart.data() as { createdAt?: unknown; programStartDate?: string };
    const toDate = (v: unknown): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return v;
      const t = v as { toDate?: () => Date };
      if (typeof t.toDate === "function") return t.toDate();
      try {
        return new Date(String(v));
      } catch {
        return null;
      }
    };
    const mondayOfWeek = (d: Date): string => {
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setUTCDate(d.getUTCDate() + diff);
      return mon.toISOString().slice(0, 10);
    };
    const createdAt = toDate(clientData.createdAt);
    const programStart =
      clientData.programStartDate && /^\d{4}-\d{2}-\d{2}/.test(clientData.programStartDate)
        ? new Date(clientData.programStartDate + "T12:00:00Z")
        : null;
    let startDate: Date | null = createdAt ?? null;
    if (programStart && startDate && programStart.getTime() > startDate.getTime()) startDate = programStart;
    else if (programStart) startDate = programStart;
    if (startDate) {
      const startWeek = mondayOfWeek(startDate);
      if (reflectionWeekStart < startWeek) {
        return NextResponse.json(
          { error: "You can only fill in check-ins for weeks from when you started." },
          { status: 400 }
        );
      }
    }
  }

  const existing = await db
    .collection("check_in_assignments")
    .where("clientId", "==", clientId)
    .where("formId", "==", formId)
    .where("reflectionWeekStart", "==", reflectionWeekStart)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ assignmentId: existing.docs[0].id });
  }

  const formSnap = await db.collection("forms").doc(formId).get();
  const formTitle = formSnap.exists ? (formSnap.data()?.title as string) ?? "Check-in" : "Check-in";
  const clientSnap = clientSnapForStart;
  const coachId = (clientSnap.data()?.coachId as string) ?? null;

  const dueDate = new Date(reflectionWeekStart);
  dueDate.setDate(dueDate.getDate() + 4);
  const assignedAt = new Date();

  const ref = await db.collection("check_in_assignments").add({
    formId,
    formTitle,
    clientId,
    coachId,
    assignedAt,
    dueDate,
    reflectionWeekStart,
    status: "pending",
    responseId: null,
    createdAt: assignedAt,
    updatedAt: assignedAt,
  });

  return NextResponse.json({ assignmentId: ref.id });
}
