// Day-1 spike: does the "budget envelope" mechanic work in PayPal sandbox?
// authorize $120 -> capture $40 (partial) -> capture $35 (partial) -> void remainder
// Run: node --env-file=.env scripts/spike-envelope.mjs
import { randomUUID } from "node:crypto";

const BASE = "https://api-m.sandbox.paypal.com";
const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;

async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  return (await r.json()).access_token;
}

const t = await token();
async function pp(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  console.log(`${r.status} POST ${path}`);
  if (!r.ok) { console.log(JSON.stringify(json, null, 2)); process.exit(1); }
  return json;
}

// 1. Envelope: AUTHORIZE order, buyer approves via PayPal (the app uses PayPal Buttons for this)
const created = await pp("/v2/checkout/orders", {
  intent: "AUTHORIZE",
  purchase_units: [{
    reference_id: "mandate_spike",
    description: "Mandate budget envelope (spike)",
    amount: { currency_code: "USD", value: "120.00" },
  }],
  payment_source: { paypal: { experience_context: {
    user_action: "CONTINUE", shipping_preference: "NO_SHIPPING",
    return_url: "https://example.com/approved", cancel_url: "https://example.com/cancel",
  } } },
});
const approve = created.links.find(l => l.rel === "payer-action" || l.rel === "approve").href;
console.log("\n👉 Open this link, log in with your SANDBOX PERSONAL account, approve:\n" + approve + "\n");
console.log("(after approving you'll land on example.com — that's fine)\nwaiting for approval...");
for (;;) {
  await new Promise(r => setTimeout(r, 4000));
  const o = await fetch(`${BASE}/v2/checkout/orders/${created.id}`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
  if (o.status === "APPROVED") break;
}
const order = await pp(`/v2/checkout/orders/${created.id}/authorize`);
console.log("order status:", order.status);
const auth = order.purchase_units[0].payments.authorizations[0];
console.log("authorization:", auth.id, auth.status, auth.amount.value, "expires", auth.expiration_time);

// 2. Partial captures
const c1 = await pp(`/v2/payments/authorizations/${auth.id}/capture`, {
  amount: { currency_code: "USD", value: "40.00" }, final_capture: false, invoice_id: "spike-" + randomUUID(),
});
console.log("capture 1:", c1.id, c1.status, c1.amount.value);
const c2 = await pp(`/v2/payments/authorizations/${auth.id}/capture`, {
  amount: { currency_code: "USD", value: "35.00" }, final_capture: false, invoice_id: "spike-" + randomUUID(),
});
console.log("capture 2:", c2.id, c2.status, c2.amount.value);

// 3. Void leftover
await pp(`/v2/payments/authorizations/${auth.id}/void`);
const after = await fetch(`${BASE}/v2/payments/authorizations/${auth.id}`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
console.log("authorization after void:", after.status);

// 4. Refund capture 2 (post-purchase path)
const ref = await pp(`/v2/payments/captures/${c2.id}/refund`, { amount: { currency_code: "USD", value: "35.00" }, note_to_payer: "Wrong size" });
console.log("refund:", ref.id, ref.status);
console.log("\nSPIKE PASSED ✅");
