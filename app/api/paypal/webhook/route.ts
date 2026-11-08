// PayPal webhooks: PayPal's own confirmation of money movement, reconciled into the audit ledger.
// Signature-verified via PayPal's verify-webhook-signature API; idempotent on the event id.
import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { paypal } from "@/lib/paypal/client";
import { logEvent } from "@/lib/ledger";

export const runtime = "nodejs";

type WebhookEvent = {
  id: string;
  event_type: string;
  summary?: string;
  resource: {
    id: string;
    status?: string;
    amount?: { value: string; currency_code: string };
    supplementary_data?: { related_ids?: { order_id?: string; authorization_id?: string; capture_id?: string } };
    links?: { href: string; rel: string }[];
    custom_id?: string;
  };
};

async function verify(req: Request, body: unknown): Promise<boolean> {
  const webhookId = env.paypal.webhookId();
  if (!webhookId) return false;
  const h = (k: string) => req.headers.get(k) ?? "";
  const r = await paypal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    body: {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: body,
    },
  });
  return r.verification_status === "SUCCESS";
}

/** Find which mandate a PayPal resource belongs to. */
async function findMandateId(ev: WebhookEvent): Promise<string | null> {
  const rel = ev.resource.supplementary_data?.related_ids ?? {};
  const upId = ev.resource.links?.find((l) => l.rel === "up")?.href.split("/").pop();
  const ids = [rel.authorization_id, rel.order_id, ev.resource.id, upId].filter(Boolean) as string[];
  for (const id of ids) {
    const [m] = await db
      .select({ id: schema.mandates.id })
      .from(schema.mandates)
      .where(or(eq(schema.mandates.authorizationId, id), eq(schema.mandates.paypalOrderId, id)));
    if (m) return m.id;
    const [p] = await db
      .select({ mandateId: schema.purchases.mandateId })
      .from(schema.purchases)
      .where(or(eq(schema.purchases.captureId, id), eq(schema.purchases.refundId, id)));
    if (p) return p.mandateId;
  }
  return null;
}

const LABEL: Record<string, string> = {
  "PAYMENT.AUTHORIZATION.CREATED": "PayPal confirmed the budget authorization",
  "PAYMENT.AUTHORIZATION.VOIDED": "PayPal confirmed the unspent authorization was voided",
  "PAYMENT.CAPTURE.COMPLETED": "PayPal confirmed the capture completed",
  "PAYMENT.CAPTURE.REFUNDED": "PayPal confirmed the refund",
  "PAYMENT.CAPTURE.DENIED": "PayPal denied a capture",
  "CUSTOMER.DISPUTE.CREATED": "A buyer opened a dispute",
};

export async function POST(req: Request) {
  const body = (await req.json()) as WebhookEvent;
  if (!(await verify(req, body).catch(() => false))) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  const inserted = await db
    .insert(schema.webhookEvents)
    .values({ id: body.id, type: body.event_type, payload: body })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvents.id });
  if (!inserted.length) return NextResponse.json({ ok: true, duplicate: true });

  const mandateId = await findMandateId(body);
  if (mandateId) {
    const amount = body.resource.amount ? Number(body.resource.amount.value) : undefined;
    await logEvent({
      mandateId,
      type: "PAYPAL",
      tool: "webhook",
      title: `${LABEL[body.event_type] ?? body.event_type}${amount ? ` ($${amount.toFixed(2)})` : ""} — webhook verified`,
      amount,
      paypalId: body.resource.id,
      detail: { event_type: body.event_type, event_id: body.id, status: body.resource.status },
    });
  }
  return NextResponse.json({ ok: true });
}
