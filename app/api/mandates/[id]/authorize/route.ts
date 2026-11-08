import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getMandate, logEvent } from "@/lib/ledger";
import { authorizeEnvelope } from "@/lib/paypal/envelope";
import { startAgentInBackground } from "@/lib/agent/run";

export const runtime = "nodejs";

/** Step 2: buyer approved in PayPal → authorize the hold, activate the mandate, start the agent. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orderId } = z.object({ orderId: z.string() }).parse(await req.json());
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.status === "ACTIVE") return NextResponse.json({ ok: true });
  if (m.paypalOrderId !== orderId) return NextResponse.json({ error: "Order does not belong to this mandate" }, { status: 400 });

  try {
    const auth = await authorizeEnvelope(orderId);
    const expiresAt = new Date(Date.now() + m.policy.expires_in_hours * 3_600_000);
    await db
      .update(schema.mandates)
      .set({
        status: "ACTIVE",
        authorizationId: auth.authorizationId,
        authorizedAmount: auth.amount,
        payerEmail: auth.payerEmail,
        expiresAt,
      })
      .where(eq(schema.mandates.id, id));
    await logEvent({
      mandateId: id,
      type: "PAYPAL",
      title: `You authorized a $${auth.amount.toFixed(2)} budget with PayPal`,
      amount: auth.amount,
      paypalId: auth.authorizationId,
      detail: auth,
    });
    startAgentInBackground(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[authorize]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
