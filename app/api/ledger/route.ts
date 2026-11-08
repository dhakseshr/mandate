import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every audit event across all mandates, joined with mandate context, plus per-mandate rollups. */
export async function GET() {
  const e = schema.agentEvents;
  const m = schema.mandates;
  const [events, mandates] = await Promise.all([
    db
      .select({
        id: e.id,
        ts: e.ts,
        mandateId: e.mandateId,
        goal: m.policy,
        type: e.type,
        tool: e.tool,
        title: e.title,
        verdict: e.verdict,
        rule: e.rule,
        amount: e.amount,
        merchant: e.merchant,
        paypalId: e.paypalId,
        detail: e.detail,
      })
      .from(e)
      .innerJoin(m, eq(m.id, e.mandateId))
      .orderBy(desc(e.ts))
      .limit(2000),
    db
      .select({
        id: m.id,
        createdAt: m.createdAt,
        rawText: m.rawText,
        status: m.status,
        budgetTotal: m.budgetTotal,
        authorizedAmount: m.authorizedAmount,
        spentTotal: m.spentTotal,
        refundedTotal: m.refundedTotal,
        itemsBought: m.itemsBought,
        authorizationId: m.authorizationId,
        summary: m.summary,
      })
      .from(m)
      .orderBy(desc(m.createdAt))
      .limit(500),
  ]);
  return NextResponse.json({
    events: events.map(({ goal, ...r }) => ({ ...r, goal: (goal as { goal?: string })?.goal ?? "" })),
    mandates,
  });
}
