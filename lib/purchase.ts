// The only code path that moves money. Every purchase — agent-initiated or human-approved —
// goes through the policy engine at EVERY level of the delegation chain, under one lock per tree,
// then captures from the ROOT mandate's PayPal authorization.
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { evaluateChain } from "@/lib/policy/chain";
import type { Product } from "@/lib/policy/schema";
import { verifyOrder } from "@/lib/verify";
import { captureFromEnvelope, voidEnvelope } from "@/lib/paypal/envelope";
import { PayPalError } from "@/lib/paypal/client";
import { registerShipment } from "@/lib/tracking";
import { isPoisoned } from "@/lib/redteam";
import { getChain, getDescendants, getMandate, logEvent, newId, treeKey, withMandateLock, type Mandate } from "@/lib/ledger";

export type PurchaseOutcome =
  | { status: "PURCHASED"; purchase_id: string; capture_id: string; amount: number; remaining_budget: number }
  | { status: "ESCALATED"; approval_id: string; rule: string; message: string }
  | { status: "DENIED"; rule: string; message: string; remaining_budget: number }
  | { status: "ERROR"; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const remainingOf = (m: Mandate) => round2(Math.min(m.budgetTotal, m.authorizedAmount) - m.spentTotal);
export { evaluateChain };

export async function executePurchase(p: {
  mandateId: string;
  runId?: string | null;
  product: Product;
  quantity: number;
  rationale: string;
  humanApproved?: boolean;
  /** Red-team "hijacked agent" simulation (proposal injected directly, not chosen by the model). */
  simulated?: boolean;
}): Promise<PurchaseOutcome> {
  const m0 = await getMandate(p.mandateId);
  if (!m0) return { status: "ERROR", message: "Mandate not found" };

  return withMandateLock(treeKey(m0), async () => {
    const m = (await getMandate(p.mandateId))!;
    const chain = await getChain(m);
    const root = chain[chain.length - 1];
    const { ev, levels, decidedBy } = evaluateChain(chain, p.product, p.quantity);
    const remaining = Math.min(...chain.map(remainingOf));

    // A human may approve an ESCALATE. Nobody — not the agent, not the human — can override a DENY.
    const verdict = ev.verdict === "ESCALATE" && p.humanApproved ? "ALLOW" : ev.verdict;
    const injection = isPoisoned(p.product)
      ? { text: p.product.description ?? "", source: p.product.merchant, followedByAgent: !p.simulated }
      : undefined;
    await logEvent({
      mandateId: p.mandateId,
      runId: p.runId,
      type: "POLICY_VERDICT",
      title:
        verdict === "ALLOW"
          ? p.humanApproved && ev.verdict === "ESCALATE"
            ? `Approved by you — ${ev.message}`
            : `Allowed — ${ev.message}`
          : verdict === "ESCALATE"
            ? `Needs your approval — ${ev.message}`
            : `Blocked — ${ev.message}`,
      verdict: p.humanApproved && ev.verdict === "ESCALATE" ? "APPROVED" : ev.verdict,
      rule: ev.rule,
      amount: ev.amount,
      merchant: p.product.merchant,
      detail: {
        product: p.product,
        checks: ev.checks,
        rationale: p.rationale,
        ...(chain.length > 1
          ? { chain: levels.map((l) => ({ mandateId: l.mandate.id, name: l.name, verdict: l.ev.verdict, rule: l.ev.rule, message: l.ev.message })), decidedBy }
          : {}),
        ...(injection ? { injection } : {}),
      },
    });

    if (verdict === "DENY") return { status: "DENIED", rule: ev.rule, message: ev.message, remaining_budget: remaining };

    if (verdict === "ESCALATE") {
      const approvalId = newId("apr");
      await db.insert(schema.approvals).values({
        id: approvalId,
        mandateId: p.mandateId,
        runId: p.runId,
        product: p.product,
        quantity: p.quantity,
        rationale: p.rationale,
        evaluation: ev,
      });
      return { status: "ESCALATED", approval_id: approvalId, rule: ev.rule, message: ev.message };
    }

    // ALLOW → capture from the ROOT's PayPal authorization (one hold backs the whole tree).
    if (!root.authorizationId) return { status: "ERROR", message: "No PayPal authorization on this mandate tree" };
    const purchaseId = newId("pur");
    // Merchant-side verification for this exact order (sandbox: performed on the merchant's behalf).
    // Read-only, so it is safe inside the tree lock. Produces a signed, chargeback-defensible receipt.
    const receipt = await verifyOrder(
      { mandate_id: p.mandateId, merchant: p.product.merchant, items: [{ title: p.product.title, price: p.product.price, quantity: p.quantity, brand: p.product.brand, category: p.product.category }] },
      { log: false },
    );
    try {
      const cap = await captureFromEnvelope({
        authorizationId: root.authorizationId,
        amount: ev.amount,
        purchaseId,
        // Mandate evidence on the PayPal record: which signed mandate authorised this capture.
        invoiceId: root.signatureHash ? `M-${root.signatureHash.slice(0, 12)}-${purchaseId}` : undefined,
        note: `${p.product.title} (${p.product.merchant}) — bought by ${m.name ?? "your Writ agent"}`,
      });
      await db.insert(schema.purchases).values({
        id: purchaseId,
        mandateId: p.mandateId,
        product: p.product,
        merchant: p.product.merchant,
        quantity: p.quantity,
        amount: ev.amount,
        captureId: cap.captureId,
        status: "CAPTURED",
        rationale: p.rationale,
      });
      // Spend counts against this mandate AND every ancestor.
      for (const level of chain) {
        await db
          .update(schema.mandates)
          .set({ spentTotal: round2(level.spentTotal + ev.amount), itemsBought: level.itemsBought + p.quantity })
          .where(eq(schema.mandates.id, level.id));
      }
      await logEvent({
        mandateId: p.mandateId,
        runId: p.runId,
        type: "PAYPAL",
        title: `Captured $${ev.amount.toFixed(2)} from your PayPal authorization`,
        amount: ev.amount,
        merchant: p.product.merchant,
        paypalId: cap.captureId,
        detail: { capture: cap, product: p.product.title, api: `POST /v2/payments/authorizations/${root.authorizationId}/capture` },
      });
      void registerShipment({ mandateId: p.mandateId, runId: p.runId, purchaseId, orderId: root.paypalOrderId, captureId: cap.captureId });
      if (receipt.proof && receipt.receipt)
        await logEvent({
          mandateId: p.mandateId,
          runId: p.runId,
          type: "SYSTEM",
          tool: "verify",
          title: `Merchant verification receipt for ${p.product.merchant} — ${receipt.authorized ? "authorized" : receipt.receipt.verdict}, signed #${receipt.proof.sha256.slice(0, 8)}`,
          merchant: p.product.merchant,
          detail: { receipt_sha256: receipt.proof.sha256, capture_id: cap.captureId, verdict: receipt.receipt.verdict },
        });
      return {
        status: "PURCHASED",
        purchase_id: purchaseId,
        capture_id: cap.captureId,
        amount: ev.amount,
        remaining_budget: round2(remaining - ev.amount),
      };
    } catch (err) {
      const msg = err instanceof PayPalError ? `${err.message} (debug_id ${err.debugId})` : String(err);
      await logEvent({ mandateId: p.mandateId, runId: p.runId, type: "PAYPAL", title: `Capture failed: ${msg}`, detail: { error: msg } });
      return { status: "ERROR", message: msg };
    }
  });
}

async function voidRoot(root: Mandate, runId?: string | null, reason = "released back to you") {
  if (!root.authorizationId) return;
  try {
    await voidEnvelope(root.authorizationId);
    const voided = round2(root.authorizedAmount - root.spentTotal);
    await logEvent({
      mandateId: root.id,
      runId,
      type: "PAYPAL",
      title: `Voided remaining $${voided.toFixed(2)} — ${reason}`,
      amount: voided,
      paypalId: root.authorizationId,
      detail: { api: `POST /v2/payments/authorizations/${root.authorizationId}/void` },
    });
  } catch (err) {
    await logEvent({ mandateId: root.id, runId, type: "PAYPAL", title: `Void failed: ${String(err)}` });
  }
}

/** When every sub-mandate of a team root is done, close the root (voiding the hold). */
async function maybeCloseTeamRoot(parentId: string | null) {
  if (!parentId) return;
  const parent = await getMandate(parentId);
  if (!parent || parent.status !== "ACTIVE" || parent.agentMode !== "team") return;
  const kids = await db.select().from(schema.mandates).where(eq(schema.mandates.parentId, parent.id));
  if (!kids.length || kids.some((k) => k.status === "ACTIVE")) return;
  const lines = kids.map((k) => `${k.name ?? k.id}: ${k.status === "REVOKED" ? "revoked" : `$${k.spentTotal.toFixed(2)} spent`}`);
  await closeMandate(parent.id, `All sub-agents finished. ${lines.join("; ")}.`);
}

/** Close a mandate. A sub-mandate returns its unspent allocation to its parent; a root voids the PayPal hold. */
export async function closeMandate(mandateId: string, summary: string, runId?: string | null) {
  const m0 = await getMandate(mandateId);
  if (!m0) return m0;
  const result = await withMandateLock(treeKey(m0), async () => {
    const m = await getMandate(mandateId);
    if (!m || m.status !== "ACTIVE") return m;
    if (m.parentId) {
      const unspent = round2(m.budgetTotal - m.spentTotal);
      await db.update(schema.mandates).set({ status: "FULFILLED", summary }).where(eq(schema.mandates.id, m.id));
      await logEvent({ mandateId: m.id, runId, type: "SYSTEM", title: `Sub-mandate closed — $${unspent.toFixed(2)} unspent returned to the parent mandate`, detail: { summary } });
      return getMandate(m.id);
    }
    await voidRoot(m, runId);
    await db.update(schema.mandates).set({ status: "FULFILLED", summary }).where(eq(schema.mandates.id, m.id));
    await logEvent({ mandateId, runId, type: "SYSTEM", title: "Mandate closed", detail: { summary } });
    return getMandate(mandateId);
  });
  if (m0.parentId) await maybeCloseTeamRoot(m0.parentId);
  return result;
}

/**
 * Kill switch. Revokes a mandate and its whole subtree instantly: pending approvals are rejected,
 * every agent's next proposal is denied (MANDATE_ACTIVE), and a revoked ROOT voids the PayPal hold.
 */
export async function revokeMandate(mandateId: string, reason: string, by: "you" | "harness" = "you") {
  const m0 = await getMandate(mandateId);
  if (!m0) throw new Error("Mandate not found");
  const revoked = await withMandateLock(treeKey(m0), async () => {
    const m = (await getMandate(mandateId))!;
    const subtree = [m, ...(await getDescendants(m.id))].filter((x) => ["ACTIVE", "DRAFT", "AWAITING_AUTH"].includes(x.status));
    if (!subtree.length) return [];
    const ids = subtree.map((x) => x.id);
    await db
      .update(schema.approvals)
      .set({ status: "REJECTED", decidedAt: new Date() })
      .where(and(inArray(schema.approvals.mandateId, ids), eq(schema.approvals.status, "PENDING")));
    await db.update(schema.mandates).set({ status: "REVOKED", revokedAt: new Date(), summary: `Revoked: ${reason}` }).where(inArray(schema.mandates.id, ids));
    for (const x of subtree)
      await logEvent({
        mandateId: x.id,
        type: by === "you" ? "HUMAN" : "SYSTEM",
        tool: "revoke",
        title: x.id === m.id ? `${by === "you" ? "You revoked" : "The red-team harness revoked"} this mandate — ${reason}` : `Revoked with its parent — ${reason}`,
      });
    if (!m.parentId && m.status === "ACTIVE") await voidRoot(m, null, "hold released by the kill switch");
    return ids;
  });
  if (m0.parentId) await maybeCloseTeamRoot(m0.parentId);
  return revoked;
}
