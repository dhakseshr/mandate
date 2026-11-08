// Writ Tab: agents pay for API calls (HTTP 402) without a side wallet.
// Every call inherits the root mandate, the sub-agent's slice and every delegation limit: it is
// evaluated by the SAME engine at EVERY level of the chain. Approved calls accrue on a tab and settle
// as ONE real PayPal partial capture from the root hold (micro-charges aren't economical one by one).
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { evaluateChain } from "@/lib/policy/chain";
import type { Product } from "@/lib/policy/schema";
import { captureFromEnvelope } from "@/lib/paypal/envelope";
import { getChain, getDescendants, getMandate, logEvent, newId, treeKey, withMandateLock, type Mandate } from "@/lib/ledger";
import { signMandate } from "@/lib/signing";
import { fulfil, issueChallenge, providerById, verifyChallenge, type Challenge } from "./providers";

export const TAB_SETTLE_AT = 1.0; // USD — batch micro-charges into one PayPal capture
const r2 = (n: number) => Math.round(n * 100) / 100;

export type TabOutcome =
  | { status: "PAID"; amount: number; provider: string; data: string; receipt_sha256: string; tab_unsettled: number; settled?: { capture_id: string; amount: number; calls: number } }
  | { status: "ESCALATED"; approval_id: string; rule: string; message: string }
  | { status: "DENIED"; rule: string; message: string }
  | { status: "ERROR"; message: string };

/** API calls aren't "items" and have no rating/delivery: those clauses don't apply; money, provider and category rules do. */
const forApiCall = (chain: Mandate[]) =>
  chain.map((m) => ({ ...m, itemsBought: 0, policy: { ...m.policy, max_items: 1_000_000, min_rating: null, deliver_by: null } }));

export async function buyApiCall(p: {
  mandateId: string;
  runId?: string | null;
  providerId: string;
  resource: string;
  purpose: string;
  humanApproved?: boolean;
  /** Test hook: present a tampered challenge (price changed after signing). */
  tamper?: boolean;
}): Promise<TabOutcome> {
  const m0 = await getMandate(p.mandateId);
  if (!m0) return { status: "ERROR", message: "Mandate not found" };
  const provider = providerById(p.providerId);
  if (!provider) return { status: "DENIED", rule: "UNKNOWN_PROVIDER", message: `No such provider: ${p.providerId}` };

  return withMandateLock(treeKey(m0), async () => {
    const m = (await getMandate(p.mandateId))!;
    const chain = await getChain(m);
    const root = chain[chain.length - 1];

    // 1. Provider answers 402 with a signed price. 2. Writ verifies the signature (no tampered prices).
    const offer = issueChallenge(provider.id, p.resource)!;
    if (p.tamper) offer.challenge = { ...offer.challenge, price: { currency_code: "USD", value: "0.01" } };
    const sig = verifyChallenge(offer);
    await logEvent({
      mandateId: m.id,
      runId: p.runId,
      type: "TOOL_CALL",
      tool: "tab",
      title: `402 from ${provider.name}: “${p.resource.slice(0, 80)}” — $${offer.challenge.price.value} (signed challenge ${sig.ok ? "verified" : "REJECTED"})`,
      amount: Number(offer.challenge.price.value),
      merchant: provider.id,
      detail: { challenge: offer.challenge, signature_valid: sig.ok, simulated_provider: true },
    });
    if (!sig.ok) {
      await logEvent({ mandateId: m.id, runId: p.runId, type: "POLICY_VERDICT", tool: "tab", verdict: "DENY", rule: "PROVIDER_SIGNATURE", title: `Blocked — ${sig.reason}` , merchant: provider.id });
      return { status: "DENIED", rule: "PROVIDER_SIGNATURE", message: sig.reason };
    }
    const price = Number(offer.challenge.price.value);

    // 3. The same engine, at every level of the delegation chain.
    const product: Product = {
      id: `api:${provider.id}:${createHash("sha1").update(p.resource).digest("hex").slice(0, 10)}`,
      title: `${provider.name} — ${p.resource.slice(0, 80)}`,
      brand: null,
      price,
      currency: "USD",
      merchant: provider.id,
      category: provider.category,
      rating: null,
      delivery_days: 0,
      url: null,
      image: null,
      in_stock: true,
      description: p.resource,
    };
    const { ev, levels, decidedBy } = evaluateChain(forApiCall(chain), product, 1);
    const verdict = ev.verdict === "ESCALATE" && p.humanApproved ? "ALLOW" : ev.verdict;
    await logEvent({
      mandateId: m.id,
      runId: p.runId,
      type: "POLICY_VERDICT",
      tool: "tab",
      verdict: p.humanApproved && ev.verdict === "ESCALATE" ? "APPROVED" : ev.verdict,
      rule: ev.rule,
      amount: price,
      merchant: provider.id,
      title: verdict === "ALLOW" ? `Allowed on the tab — ${ev.message}` : verdict === "ESCALATE" ? `Needs your approval — ${ev.message}` : `Blocked — ${ev.message}`,
      detail: {
        product,
        checks: ev.checks,
        rationale: p.purpose,
        ...(chain.length > 1 ? { chain: levels.map((l) => ({ mandateId: l.mandate.id, name: l.name, verdict: l.ev.verdict, rule: l.ev.rule, message: l.ev.message })), decidedBy } : {}),
      },
    });
    if (verdict === "DENY") return { status: "DENIED", rule: ev.rule, message: ev.message };
    if (verdict === "ESCALATE") {
      const approvalId = newId("apr");
      await db.insert(schema.approvals).values({ id: approvalId, mandateId: m.id, runId: p.runId, product, quantity: 1, rationale: p.purpose, evaluation: ev });
      return { status: "ESCALATED", approval_id: approvalId, rule: ev.rule, message: ev.message };
    }

    // 4. Accrue on the tab (spend reserved at every level), issue a signed receipt, get the data.
    const purchaseId = newId("tab");
    const receipt = { type: "writ.tab_receipt", purchase_id: purchaseId, mandate_id: m.id, root_sha256: root.signatureHash, provider: provider.id, nonce: offer.challenge.nonce, amount: offer.challenge.price.value, resource: p.resource.slice(0, 200), expires_at: new Date(Date.now() + 60_000).toISOString() };
    const rsig = signMandate(receipt);
    const response = fulfil(provider.id, offer.challenge as Challenge, receipt);
    if (response.status !== 200) return { status: "ERROR", message: response.error };
    await db.insert(schema.purchases).values({
      id: purchaseId,
      mandateId: m.id,
      product: { ...product, description: p.resource },
      merchant: provider.id,
      quantity: 1,
      amount: price,
      status: "ACCRUED",
      rationale: p.purpose,
    });
    for (const level of chain)
      await db.update(schema.mandates).set({ spentTotal: r2(level.spentTotal + price) }).where(eq(schema.mandates.id, level.id));
    await logEvent({
      mandateId: m.id,
      runId: p.runId,
      type: "SYSTEM",
      tool: "tab",
      title: `Paid ${provider.name} $${price.toFixed(2)} on the tab — receipt #${rsig.hash.slice(0, 8)}, data returned`,
      amount: price,
      merchant: provider.id,
      detail: { purchase_id: purchaseId, receipt, receipt_sha256: rsig.hash, response: response.data, manipulated_provider: response.manipulated, simulated_provider: true },
    });

    // 5. Batch-settle through PayPal once the tab is worth a capture.
    const unsettled = await unsettledTotal(root.id);
    let settled: { capture_id: string; amount: number; calls: number } | undefined;
    if (unsettled >= TAB_SETTLE_AT) settled = (await settleTabLocked(root.id, p.runId)) ?? undefined;
    return {
      status: "PAID",
      amount: price,
      provider: provider.id,
      data: response.data,
      receipt_sha256: rsig.hash,
      tab_unsettled: settled ? 0 : unsettled,
      ...(settled ? { settled } : {}),
    };
  });
}

async function treeIds(rootId: string) {
  return [rootId, ...(await getDescendants(rootId)).map((d) => d.id)];
}

export async function unsettledTotal(rootId: string) {
  const rows = await db.select().from(schema.purchases).where(and(inArray(schema.purchases.mandateId, await treeIds(rootId)), eq(schema.purchases.status, "ACCRUED")));
  return r2(rows.reduce((a, r) => a + r.amount, 0));
}

/**
 * Settle every accrued API call in the tree as ONE PayPal partial capture from the root hold.
 * Caller must hold the tree lock (used by buyApiCall, closeMandate and revokeMandate).
 */
export async function settleTabLocked(rootId: string, runId?: string | null) {
  const root = await getMandate(rootId);
  if (!root?.authorizationId) return null;
  const rows = await db.select().from(schema.purchases).where(and(inArray(schema.purchases.mandateId, await treeIds(rootId)), eq(schema.purchases.status, "ACCRUED")));
  if (!rows.length) return null;
  const amount = r2(rows.reduce((a, r) => a + r.amount, 0));
  const settlementId = newId("set");
  try {
    const cap = await captureFromEnvelope({
      authorizationId: root.authorizationId,
      amount,
      purchaseId: settlementId,
      invoiceId: root.signatureHash ? `T-${root.signatureHash.slice(0, 12)}-${settlementId}` : undefined,
      note: `Writ Tab settlement: ${rows.length} paid API call${rows.length === 1 ? "" : "s"}`,
    });
    await db.update(schema.purchases).set({ status: "SETTLED", captureId: cap.captureId }).where(inArray(schema.purchases.id, rows.map((r) => r.id)));
    await logEvent({
      mandateId: rootId,
      runId,
      type: "PAYPAL",
      tool: "tab",
      title: `Settled the tab: ${rows.length} API call${rows.length === 1 ? "" : "s"}, $${amount.toFixed(2)} in one PayPal capture`,
      amount,
      paypalId: cap.captureId,
      detail: { calls: rows.map((r) => ({ id: r.id, provider: r.merchant, amount: r.amount })), api: `POST /v2/payments/authorizations/${root.authorizationId}/capture` },
    });
    return { capture_id: cap.captureId, amount, calls: rows.length };
  } catch (err) {
    await logEvent({ mandateId: rootId, runId, type: "PAYPAL", tool: "tab", title: `Tab settlement failed: ${String(err).slice(0, 140)} — calls stay accrued` });
    return null;
  }
}
