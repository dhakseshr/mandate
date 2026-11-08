// Refunds go through PayPal's official Agent Toolkit (create_refund), with a direct REST fallback.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { callToolkit } from "@/lib/paypal/toolkit";
import { refundCapture } from "@/lib/paypal/envelope";
import { getMandate, logEvent, withMandateLock } from "@/lib/ledger";

export async function refundPurchase(purchaseId: string, reason: string) {
  const [p0] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
  if (!p0) throw new Error("Purchase not found");

  return withMandateLock(p0.mandateId, async () => {
    const [p] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
    if (!p || p.status !== "CAPTURED" || !p.captureId) throw new Error("Only captured purchases can be refunded");

    let refundId: string;
    let via = "PayPal Agent Toolkit";
    try {
      const r = await callToolkit<{ id: string; status: string }>("create_refund", {
        capture_id: p.captureId,
        note_to_payer: reason.slice(0, 255) || "Refund requested",
      });
      refundId = r.id;
    } catch (err) {
      console.warn("[refund] toolkit failed, using REST", err);
      via = "PayPal Payments API";
      refundId = (await refundCapture({ captureId: p.captureId, reason, refundKey: p.id })).refundId;
    }

    await db.update(schema.purchases).set({ status: "REFUNDED", refundId }).where(eq(schema.purchases.id, p.id));
    const m = (await getMandate(p.mandateId))!;
    await db
      .update(schema.mandates)
      .set({ refundedTotal: Math.round((m.refundedTotal + p.amount) * 100) / 100 })
      .where(eq(schema.mandates.id, p.mandateId));
    await logEvent({
      mandateId: p.mandateId,
      type: "PAYPAL",
      title: `Refunded $${p.amount.toFixed(2)} for ${p.product.title} via ${via}${reason ? ` — “${reason}”` : ""}`,
      amount: p.amount,
      merchant: p.merchant,
      paypalId: refundId,
      tool: "create_refund",
    });
    return { refundId, via };
  });
}
