import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getMandate, logEvent } from "@/lib/ledger";
import { executePurchase } from "@/lib/purchase";
import { buyApiCall } from "@/lib/tab/tab";
import { startAgentInBackground } from "@/lib/agent/run";

export const runtime = "nodejs";

/** Human-in-the-loop decision on an escalated purchase. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision, note } = z
    .object({ decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(300).optional() })
    .parse(await req.json());

  // Atomically claim the pending approval so double-clicks can't double-buy.
  const [a] = await db
    .update(schema.approvals)
    .set({ status: decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedAt: new Date() })
    .where(and(eq(schema.approvals.id, id), eq(schema.approvals.status, "PENDING")))
    .returning();
  if (!a) return NextResponse.json({ error: "Already decided" }, { status: 409 });

  await logEvent({
    mandateId: a.mandateId,
    type: "HUMAN",
    title: decision === "APPROVE" ? `You approved ${a.product.title}` : `You rejected ${a.product.title}${note ? `: “${note}”` : ""}`,
    amount: a.product.price * a.quantity,
    merchant: a.product.merchant,
  });

  let resumeNote: string;
  if (decision === "APPROVE" && a.product.id.startsWith("api:")) {
    // An escalated paid API call (Writ Tab): accrue it on the tab with the human's approval.
    const out = await buyApiCall({ mandateId: a.mandateId, providerId: a.product.merchant, resource: a.product.description ?? a.product.title, purpose: a.rationale ?? "", humanApproved: true });
    resumeNote = `I APPROVED the paid API call to ${a.product.merchant}. Result: ${JSON.stringify(out).slice(0, 600)}. Continue if more is needed, otherwise call finish.`;
  } else if (decision === "APPROVE") {
    const out = await executePurchase({
      mandateId: a.mandateId,
      product: a.product,
      quantity: a.quantity,
      rationale: a.rationale ?? "",
      humanApproved: true,
    });
    resumeNote = `I APPROVED "${a.product.title}". Purchase result: ${JSON.stringify(out)}. Continue the mandate if more items are needed, otherwise call finish.`;
  } else {
    resumeNote = `I REJECTED "${a.product.title}"${note ? ` — reason: ${note}` : ""}. Don't propose it again. Find a better alternative within policy, or finish if there is none.`;
  }
  const m = await getMandate(a.mandateId);
  if (m?.agentMode === "external") {
    // External (MCP) agents poll get_status and see the decision there.
    await logEvent({ mandateId: a.mandateId, type: "SYSTEM", title: "Decision shared with your connected agent (via get_status)" });
  } else {
    startAgentInBackground(a.mandateId, resumeNote);
  }
  return NextResponse.json({ ok: true });
}
