import { NextResponse } from "next/server";
import { requireCoach } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAdminConfigured } from "@/lib/firebase-admin";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate();
  try {
    return new Date(String(v));
  } catch {
    return null;
  }
}

function toTime(v: unknown): number {
  const d = toDate(v);
  return d ? d.getTime() : 0;
}

function toIso(v: unknown): string | null {
  const d = toDate(v);
  return d ? d.toISOString() : null;
}

// GET: client inventory with stats and per-client aggregates (last check-in, overdue, avg score, trend, payment, weight).
export async function GET(request: Request) {
  const authResult = await requireCoach(request);
  if ("error" in authResult) return authResult.error;
  const coachId = authResult.identity.coachId!;
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  if (!isAdminConfigured()) {
    return NextResponse.json({
      stats: { total: 0, active: 0, pending: 0, overdue: 0, avgProgress: null },
      clients: [],
    });
  }

  try {
    const db = getAdminDb();

    const clientsSnap = await db
      .collection("clients")
      .where("coachId", "==", coachId)
      .get();

    const clientIds = clientsSnap.docs.map((d) => d.id);
    const clientData = new Map(
      clientsSnap.docs.map((d) => {
        const data = d.data();
        const programStartDate = (data.programStartDate as string) || null;
        const stripeCustomerId = (data.stripeCustomerId as string) || null;
        const firstPaymentAt = toIso(data.firstPaymentAt);
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        let programWeeks: number | null = null;
        if (stripeCustomerId && firstPaymentAt) {
          const firstMs = new Date(firstPaymentAt).getTime();
          if (!Number.isNaN(firstMs)) {
            programWeeks = Math.max(0, Math.floor((Date.now() - firstMs) / msPerWeek));
          }
        }
        if (programWeeks == null && programStartDate && /^\d{4}-\d{2}-\d{2}/.test(programStartDate)) {
          programWeeks = Math.max(0, Math.floor((Date.now() - new Date(programStartDate).getTime()) / msPerWeek));
        }
        return [
          d.id,
          {
            id: d.id,
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            status: (data.status as string) ?? "active",
            programStartDate,
            programWeeks,
            paymentStatus: (data.paymentStatus as string) || null,
            lastPaymentAt: toIso(data.lastPaymentAt),
            progress: data.progress as { overallScore?: number; completedCheckins?: number; totalCheckins?: number } | undefined,
          },
        ];
      })
    );

    // Weight loss: first vs last bodyWeight per client (batch by clientId)
    const weightByClient = new Map<string, { firstKg: number; lastKg: number }>();
    for (let i = 0; i < clientIds.length; i += 30) {
      const chunk = clientIds.slice(i, i + 30);
      const measSnap = await db
        .collection("client_measurements")
        .where("clientId", "in", chunk)
        .get();
      const byClient = new Map<string, { date: number; bodyWeight: number }[]>();
      for (const doc of measSnap.docs) {
        const d = doc.data();
        const clientId = d.clientId as string;
        const date = toTime(d.date);
        const bw = typeof d.bodyWeight === "number" ? d.bodyWeight : null;
        if (clientId && date && bw != null) {
          if (!byClient.has(clientId)) byClient.set(clientId, []);
          byClient.get(clientId)!.push({ date, bodyWeight: bw });
        }
      }
      for (const [cid, arr] of byClient) {
        arr.sort((a, b) => a.date - b.date);
        const first = arr[0];
        const last = arr[arr.length - 1];
        if (first && last && first.bodyWeight != null && last.bodyWeight != null) {
          weightByClient.set(cid, { firstKg: first.bodyWeight, lastKg: last.bodyWeight });
        }
      }
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const assignmentsByClient = new Map<string, { dueDate: number; completedAt: number | null; status: string }[]>();
    const responsesByClient = new Map<string, { submittedAt: number; score: number }[]>();

    for (let i = 0; i < clientIds.length; i += 30) {
      const chunk = clientIds.slice(i, i + 30);
      const assignSnap = await db
        .collection("check_in_assignments")
        .where("clientId", "in", chunk)
        .get();

      for (const d of assignSnap.docs) {
        const data = d.data();
        const clientId = data.clientId as string;
        if (!assignmentsByClient.has(clientId)) assignmentsByClient.set(clientId, []);
        const due = toTime(data.dueDate);
        const completed = data.completedAt ? toTime(data.completedAt) : null;
        assignmentsByClient.get(clientId)!.push({
          dueDate: due,
          completedAt: completed,
          status: (data.status as string) ?? "pending",
        });
      }

      const respSnap = await db
        .collection("formResponses")
        .where("clientId", "in", chunk)
        .get();

      for (const d of respSnap.docs) {
        const data = d.data();
        const clientId = data.clientId as string;
        if (!responsesByClient.has(clientId)) responsesByClient.set(clientId, []);
        responsesByClient.get(clientId)!.push({
          submittedAt: toTime(data.submittedAt),
          score: typeof data.score === "number" ? data.score : 0,
        });
      }
    }

    let totalOverdue = 0;
    const clients = clientIds.map((id) => {
      const c = clientData.get(id)!;
      const assignments = assignmentsByClient.get(id) ?? [];
      const responses = responsesByClient.get(id) ?? [];
      responses.sort((a, b) => b.submittedAt - a.submittedAt);
      assignments.sort((a, b) => Math.max(b.dueDate, b.completedAt ?? 0) - Math.max(a.dueDate, a.completedAt ?? 0));

      const overdueCount = assignments.filter(
        (a) => (a.status === "overdue" || a.status === "pending" || a.status === "active") && a.dueDate < today && !a.completedAt
      ).length;
      totalOverdue += overdueCount;

      const lastCompleted = assignments.find((a) => a.completedAt != null);
      const lastResponse = responses[0];
      const lastCheckInAt = lastResponse ? lastResponse.submittedAt : (lastCompleted ? lastCompleted.completedAt! : null);

      const avgScore = responses.length ? responses.reduce((s, r) => s + r.score, 0) / responses.length : null;

      const trendTotal = Math.min(assignments.length, 21);
      const trendCompleted = assignments.filter((a) => a.completedAt != null).length;
      const trendPct = trendTotal > 0 ? Math.round((trendCompleted / trendTotal) * 100) : 0;

      const progressDots = responses.slice(0, 5).map((r) => {
        if (r.score >= 70) return "green";
        if (r.score >= 40) return "orange";
        return "red";
      });
      while (progressDots.length < 5) progressDots.push("empty");

      const weeks = assignments.length;
      const weight = weightByClient.get(id);
      const weightLossKg =
        weight != null ? Math.round((weight.lastKg - weight.firstKg) * 10) / 10 : null;

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone ?? null,
        status: c.status,
        programWeeks: c.programWeeks ?? null,
        paymentStatus: c.paymentStatus ?? null,
        lastPaymentAt: c.lastPaymentAt ?? null,
        weightLossKg,
        lastCheckInAt: lastCheckInAt ? new Date(lastCheckInAt).toISOString() : null,
        overdueCount,
        avgScore: avgScore != null ? Math.round(avgScore) : null,
        trendCompleted,
        trendTotal,
        trendPct,
        avgCheckInPct: trendPct,
        progressDots,
        weeks,
      };
    });

    const nonArchived = clients.filter((c) => (c.status as string) !== "archived");
    const totalOverdueNonArchived = nonArchived.reduce((sum, c) => sum + c.overdueCount, 0);
    const activeCount = nonArchived.filter((c) => c.status === "active").length;
    const pendingCount = nonArchived.filter((c) => c.status === "pending").length;
    const scores = nonArchived.map((c) => c.avgScore).filter((s): s is number => s != null);
    const avgProgress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    const stats = {
      total: nonArchived.length,
      active: activeCount,
      pending: pendingCount,
      overdue: totalOverdueNonArchived,
      avgProgress,
    };

    const clientsOut = includeArchived ? clients : nonArchived;
    return NextResponse.json({ stats, clients: clientsOut });
  } catch (err) {
    console.error("[coach/clients/inventory]", err);
    return NextResponse.json(
      { error: "Failed to load client inventory" },
      { status: 500 }
    );
  }
}
