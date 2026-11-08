import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PolicySchema } from "@/lib/policy/schema";
import { getMandate, getMandateView, logEvent } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const view = await getMandateView((await params).id);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}

/** Edit the compiled policy — only before the PayPal authorization exists. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["DRAFT", "AWAITING_AUTH"].includes(m.status)) return NextResponse.json({ error: "Policy is locked once the budget is authorized." }, { status: 409 });

  const parsed = PolicySchema.safeParse({ ...m.policy, ...(await req.json()).policy });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  await db.update(schema.mandates).set({ policy: parsed.data, budgetTotal: parsed.data.budget_total }).where(eq(schema.mandates.id, id));
  await logEvent({ mandateId: id, type: "HUMAN", title: "You edited the policy", detail: { policy: parsed.data } });
  return NextResponse.json({ ok: true });
}
