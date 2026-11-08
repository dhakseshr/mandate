// The "budget envelope": a PayPal AUTHORIZE order the buyer approves once.
// The agent can only spend via partial captures against it; leftovers are voided.
// Verified end-to-end in sandbox by scripts/spike-envelope.mjs.
import { paypal } from "./client";

const money = (v: number) => ({ currency_code: "USD", value: v.toFixed(2) });

export async function createEnvelopeOrder(p: { mandateId: string; budget: number; description: string }) {
  const order = await paypal<{ id: string; status: string }>("/v2/checkout/orders", {
    body: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: `mandate_${p.mandateId}`,
          custom_id: p.mandateId,
          description: p.description.slice(0, 127),
          amount: money(p.budget),
        },
      ],
    },
    idempotencyKey: `envelope-${p.mandateId}`,
  });
  return order;
}

export async function authorizeEnvelope(orderId: string) {
  const o = await paypal<any>(`/v2/checkout/orders/${orderId}/authorize`, { body: {} });
  const auth = o.purchase_units[0].payments.authorizations[0];
  return {
    authorizationId: auth.id as string,
    status: auth.status as string,
    amount: Number(auth.amount.value),
    expiresAt: auth.expiration_time as string,
    payerEmail: o.payer?.email_address as string | undefined,
  };
}

export async function captureFromEnvelope(p: {
  authorizationId: string;
  amount: number;
  purchaseId: string;
  invoiceId?: string;
  note: string;
}) {
  const c = await paypal<any>(`/v2/payments/authorizations/${p.authorizationId}/capture`, {
    body: {
      amount: money(p.amount),
      final_capture: false,
      invoice_id: (p.invoiceId ?? `purchase_${p.purchaseId}`).slice(0, 127),
      note_to_payer: p.note.slice(0, 255),
    },
    idempotencyKey: `capture-${p.purchaseId}`,
  });
  return { captureId: c.id as string, status: c.status as string, amount: Number(c.amount.value) };
}

export async function voidEnvelope(authorizationId: string) {
  await paypal(`/v2/payments/authorizations/${authorizationId}/void`, { body: undefined, method: "POST" });
  return getAuthorization(authorizationId);
}

/**
 * Independent evidence straight from PayPal: the hold's status and the sum of completed captures
 * on the order. Used to prove an attack moved $0.00 without trusting our own database.
 */
export async function getHoldSnapshot(orderId: string) {
  const o = await paypal<any>(`/v2/checkout/orders/${orderId}`);
  const pay = o.purchase_units?.[0]?.payments ?? {};
  const captures = (pay.captures ?? []) as { id: string; status: string; amount: { value: string } }[];
  const auth = (pay.authorizations ?? [])[0] as { id: string; status: string; amount: { value: string } } | undefined;
  const captured = Math.round(captures.filter((c) => c.status === "COMPLETED").reduce((a, c) => a + Number(c.amount.value), 0) * 100) / 100;
  return {
    order_id: orderId,
    authorization_id: auth?.id ?? null,
    authorization_status: auth?.status ?? null,
    authorized: auth ? Number(auth.amount.value) : null,
    captured,
    capture_count: captures.length,
    fetched_at: new Date().toISOString(),
  };
}

export async function getAuthorization(authorizationId: string) {
  return paypal<any>(`/v2/payments/authorizations/${authorizationId}`);
}

export async function refundCapture(p: { captureId: string; amount?: number; reason: string; refundKey: string }) {
  const r = await paypal<any>(`/v2/payments/captures/${p.captureId}/refund`, {
    body: { ...(p.amount ? { amount: money(p.amount) } : {}), note_to_payer: p.reason.slice(0, 255) },
    idempotencyKey: `refund-${p.refundKey}`,
  });
  return { refundId: r.id as string, status: r.status as string };
}
