import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getMandate, logEvent } from "@/lib/ledger";
import { createEnvelopeOrder } from "@/lib/paypal/envelope";

export const runtime = "nodejs";

/** Step 1 of the envelope: create a PayPal AUTHORIZE order for the budget cap. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["DRAFT", "AWAITING_AUTH"].includes(m.status))
    return NextResponse.json({ error: "Mandate already authorized" }, { status: 409 });

  try {
    // A fresh order each time the button is clicked (the previous popup may have been cancelled).
    const order = await createEnvelopeOrder({
      mandateId: `${id}-${Date.now()}`,
      budget: m.budgetTotal,
      description: `Mandate budget: ${m.policy.goal}`,
    });
    await db.update(schema.mandates).set({ status: "AWAITING_AUTH", paypalOrderId: order.id }).where(eq(schema.mandates.id, id));
    await logEvent({ mandateId: id, type: "PAYPAL", title: `Created PayPal order for a $${m.budgetTotal.toFixed(2)} budget authorization`, paypalId: order.id, amount: m.budgetTotal });
    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("[order]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
