// The only code path that moves money. Every purchase — agent-initiated or human-approved —
// goes through the policy engine, under a per-mandate lock, then captures from the PayPal envelope.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { evaluate } from "@/lib/policy/engine";
import type { Product } from "@/lib/policy/schema";
import { captureFromEnvelope, voidEnvelope } from "@/lib/paypal/envelope";
import { PayPalError } from "@/lib/paypal/client";
import { registerShipment } from "@/lib/tracking";
import { getMandate, ledgerStateOf, logEvent, newId, withMandateLock } from "@/lib/ledger";

export type PurchaseOutcome =
  | { status: "PURCHASED"; purchase_id: string; capture_id: string; amount: number; remaining_budget: number }
  | { status: "ESCALATED"; approval_id: string; rule: string; message: string }
  | { status: "DENIED"; rule: string; message: string; remaining_budget: number }
  | { status: "ERROR"; message: string };

export async function executePurchase(p: {
  mandateId: string;
  runId?: string | null;
  product: Product;
  quantity: number;
  rationale: string;
  humanApproved?: boolean;
}): Promise<PurchaseOutcome> {
  return withMandateLock(p.mandateId, async () => {
    const m = await getMandate(p.mandateId);
    if (!m) return { status: "ERROR", message: "Mandate not found" };
    const ev = evaluate(m.policy, ledgerStateOf(m), { product: p.product, quantity: p.quantity });
    const remaining = round2(Math.min(m.budgetTotal, m.authorizedAmount) - m.spentTotal);

    // A human may approve an ESCALATE. Nobody — not the agent, not the human — can override a DENY.
    const verdict = ev.verdict === "ESCALATE" && p.humanApproved ? "ALLOW" : ev.verdict;
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
      detail: { product: p.product, checks: ev.checks, rationale: p.rationale },
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

    // ALLOW → capture from the PayPal authorization.
    if (!m.authorizationId) return { status: "ERROR", message: "No PayPal authorization on this mandate" };
    const purchaseId = newId("pur");
    try {
      const cap = await captureFromEnvelope({
        authorizationId: m.authorizationId,
        amount: ev.amount,
        purchaseId,
        note: `${p.product.title} (${p.product.merchant}) — bought by your Mandate agent`,
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
      const spent = round2(m.spentTotal + ev.amount);
      await db
        .update(schema.mandates)
        .set({ spentTotal: spent, itemsBought: m.itemsBought + p.quantity })
        .where(eq(schema.mandates.id, p.mandateId));
      await logEvent({
        mandateId: p.mandateId,
        runId: p.runId,
        type: "PAYPAL",
        title: `Captured $${ev.amount.toFixed(2)} from your PayPal authorization`,
        amount: ev.amount,
        merchant: p.product.merchant,
        paypalId: cap.captureId,
        detail: { capture: cap, product: p.product.title },
      });
      // Off the critical path: don't hold the lock or the agent while PayPal registers tracking.
      void registerShipment({ mandateId: p.mandateId, runId: p.runId, purchaseId, orderId: m.paypalOrderId, captureId: cap.captureId });
      return {
        status: "PURCHASED",
        purchase_id: purchaseId,
        capture_id: cap.captureId,
        amount: ev.amount,
        remaining_budget: round2(Math.min(m.budgetTotal, m.authorizedAmount) - spent),
      };
    } catch (err) {
      const msg = err instanceof PayPalError ? `${err.message} (debug_id ${err.debugId})` : String(err);
      await logEvent({ mandateId: p.mandateId, runId: p.runId, type: "PAYPAL", title: `Capture failed: ${msg}`, detail: { error: msg } });
      return { status: "ERROR", message: msg };
    }
  });
}

/** Close the mandate: void whatever is left of the PayPal authorization. */
export async function closeMandate(mandateId: string, summary: string, runId?: string | null) {
  return withMandateLock(mandateId, async () => {
    const m = await getMandate(mandateId);
    if (!m || !["ACTIVE"].includes(m.status)) return m;
    let voided = 0;
    if (m.authorizationId) {
      try {
        await voidEnvelope(m.authorizationId);
        voided = round2(m.authorizedAmount - m.spentTotal);
        await logEvent({
          mandateId,
          runId,
          type: "PAYPAL",
          title: `Voided remaining $${voided.toFixed(2)} — released back to you`,
          amount: voided,
          paypalId: m.authorizationId,
        });
      } catch (err) {
        await logEvent({ mandateId, runId, type: "PAYPAL", title: `Void failed: ${String(err)}` });
      }
    }
    await db.update(schema.mandates).set({ status: "FULFILLED", summary }).where(eq(schema.mandates.id, mandateId));
    await logEvent({ mandateId, runId, type: "SYSTEM", title: "Mandate closed", detail: { summary } });
    return getMandate(mandateId);
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
