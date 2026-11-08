// After a tab settles (one PayPal capture from the human's hold), pay each provider its share through
// PayPal Payouts — one batch per settlement. Sandbox receivers are placeholder emails (UNCLAIMED until
// claimed); the batch itself is a real PayPal Payouts API call.
import { paypal } from "@/lib/paypal/client";
import { logEvent } from "@/lib/ledger";
import { providerById } from "./providers";

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function payoutProviders(p: {
  rootId: string;
  runId?: string | null;
  settlementId: string;
  captureId: string;
  rows: { id: string; merchant: string; amount: number }[];
}) {
  const byProvider = new Map<string, number>();
  for (const r of p.rows) byProvider.set(r.merchant, r2((byProvider.get(r.merchant) ?? 0) + r.amount));
  const items = [...byProvider.entries()].map(([provider, amount]) => ({
    recipient_type: "EMAIL",
    amount: { value: amount.toFixed(2), currency: "USD" },
    receiver: `payouts+${provider.replace(/[^a-z0-9]/gi, "-")}@example.com`,
    note: `Writ Tab settlement ${p.settlementId} — ${providerById(provider)?.name ?? provider}`,
    sender_item_id: `${p.settlementId}-${provider}`.slice(0, 63),
  }));
  if (!items.length) return null;
  try {
    const res = await paypal<{ batch_header: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
      body: {
        sender_batch_header: {
          sender_batch_id: p.settlementId,
          email_subject: "You've received a payment from a Writ agent",
          email_message: "Settlement for paid API calls made by an AI agent under a signed Writ mandate.",
        },
        items,
      },
      idempotencyKey: `payout-${p.settlementId}`,
    });
    await logEvent({
      mandateId: p.rootId,
      runId: p.runId,
      type: "PAYPAL",
      tool: "tab",
      title: `Paid ${items.length} provider${items.length === 1 ? "" : "s"} via PayPal Payouts — batch ${res.batch_header.payout_batch_id} (${res.batch_header.batch_status})`,
      amount: r2(items.reduce((a, i) => a + Number(i.amount.value), 0)),
      paypalId: res.batch_header.payout_batch_id,
      detail: {
        api: "POST /v1/payments/payouts",
        settlement_capture_id: p.captureId,
        items: items.map((i) => ({ provider: i.note.split(" — ")[1], amount: i.amount.value, receiver: i.receiver })),
      },
    });
    return res.batch_header;
  } catch (err) {
    await logEvent({ mandateId: p.rootId, runId: p.runId, type: "PAYPAL", tool: "tab", title: `Provider payouts failed: ${String(err).slice(0, 140)} — settlement stands` });
    return null;
  }
}
