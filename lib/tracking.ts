// After a capture, register the (simulated) shipment with PayPal via the Agent Toolkit.
// Fulfilment is simulated in this sandbox demo — the tracking number is generated, clearly labelled.
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { callToolkit } from "@/lib/paypal/toolkit";
import { logEvent } from "@/lib/ledger";

export async function registerShipment(p: { mandateId: string; runId?: string | null; purchaseId: string; orderId: string | null; captureId: string }) {
  if (!p.orderId) return;
  const tracking = `9400${Array.from({ length: 18 }, () => randomInt(10)).join("")}`;
  try {
    await callToolkit("create_shipment_tracking", {
      order_id: p.orderId,
      transaction_id: p.captureId,
      tracking_number: tracking,
      carrier: "USPS",
      status: "SHIPPED",
    });
    await db.update(schema.purchases).set({ trackingNumber: tracking }).where(eq(schema.purchases.id, p.purchaseId));
    await logEvent({
      mandateId: p.mandateId,
      runId: p.runId,
      type: "PAYPAL",
      tool: "create_shipment_tracking",
      title: `Shipment registered with PayPal (simulated USPS ${tracking})`,
      paypalId: p.captureId,
      detail: { api: `Agent Toolkit create_shipment_tracking → POST /v2/checkout/orders/${p.orderId}/track` },
    });
  } catch (err) {
    console.warn("[tracking]", err);
    await logEvent({ mandateId: p.mandateId, runId: p.runId, type: "PAYPAL", title: `Tracking not registered: ${String(err).slice(0, 140)}` });
  }
}
