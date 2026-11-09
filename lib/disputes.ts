// Writ answers real PayPal disputes.
//
// A buyer opens a dispute on one of Writ's captures (PayPal Resolution Center). Writ:
//   1. syncs it from PayPal (webhook CUSTOMER.DISPUTE.* or an explicit check),
//   2. rebuilds the Forensics evidence graph for that capture and investigates the buyer's complaint,
//   3. RECOMMENDS a response — contest with signed evidence, or accept the claim —
//   4. and only when the human approves, calls the Disputes API (provide-evidence / accept-claim).
// If Forensics finds the agent or the provider at fault, the honest answer is to accept the claim.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { buildEvidence, investigate, latestReport, signedEvidencePack, type ForensicsReport } from "@/lib/forensics";
import { getMandate, logEvent, treeKey, withMandateLock } from "@/lib/ledger";
import { callToolkit } from "@/lib/paypal/toolkit";
import { PayPalError } from "@/lib/paypal/client";
import {
  acceptClaimRest,
  getDispute,
  hasLink,
  listDisputesFor,
  listRecentDisputes,
  provideEvidence,
  requireSellerEvidence,
  type EvidenceItem,
  type PayPalDispute,
} from "@/lib/paypal/disputes";
import { textPdf } from "@/lib/pdf";

export type DisputeRow = typeof schema.disputes.$inferSelect;
export type DisputeResponse = "SUBMIT_EVIDENCE" | "ACCEPT_CLAIM";

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "item or service not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "not as described",
  UNAUTHORISED: "unauthorized payment",
  CREDIT_NOT_PROCESSED: "credit not processed",
  DUPLICATE_TRANSACTION: "duplicate transaction",
  INCORRECT_AMOUNT: "incorrect amount",
  CANCELED_RECURRING_BILLING: "cancelled recurring billing",
  PAYMENT_BY_OTHER_MEANS: "paid by other means",
  PROBLEM_WITH_REMITTANCE: "problem with remittance",
  OTHER: "other",
};
export const reasonText = (r?: string | null) => (r ? (REASON[r] ?? r.replace(/_/g, " ").toLowerCase()) : "unspecified");

const appOrigin = () => (process.env.APP_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The buyer's own words, from the dispute messages, as the Forensics complaint. */
function complaintOf(d: PayPalDispute) {
  const buyer = (d.messages ?? []).filter((m) => m.posted_by === "BUYER").map((m) => m.content).join(" ");
  return `PayPal dispute ${d.dispute_id} (${reasonText(d.reason)}): ${buyer || "the buyer opened a dispute without a message"}`.slice(0, 600);
}

/** Purchases that a capture paid for. Writ Tab settlements share one capture across many calls. */
async function purchasesFor(captureId: string) {
  return db.select().from(schema.purchases).where(eq(schema.purchases.captureId, captureId));
}

/**
 * Pull one dispute from PayPal and upsert it. A dispute on a capture Writ doesn't know is ignored.
 * New disputes get their evidence assembled and an investigation started in the background.
 */
export async function syncDispute(disputeId: string, opts: { investigate?: boolean } = { investigate: true }) {
  const d = await getDispute(disputeId);
  const captureId = d.disputed_transactions?.find((t) => t.seller_transaction_id)?.seller_transaction_id;
  if (!captureId) return null;
  const rows = await purchasesFor(captureId);
  if (!rows.length) return null;
  const primary = [...rows].sort((a, b) => b.amount - a.amount)[0];
  const amount = d.dispute_amount ? Number(d.dispute_amount.value) : null;

  const [existing] = await db.select().from(schema.disputes).where(eq(schema.disputes.id, d.dispute_id));
  const values = {
    purchaseId: primary.id,
    mandateId: primary.mandateId,
    captureId,
    reason: d.reason ?? null,
    status: d.status,
    amount,
    outcome: d.dispute_outcome?.outcome_code ?? existing?.outcome ?? null,
    raw: d,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(schema.disputes).set(values).where(eq(schema.disputes.id, d.dispute_id));
    if (existing.status !== d.status)
      await logEvent({
        mandateId: primary.mandateId,
        type: "PAYPAL",
        tool: "dispute",
        title: `PayPal dispute ${d.dispute_id} is now ${d.status.replace(/_/g, " ").toLowerCase()}${values.outcome ? ` — outcome ${values.outcome.replace(/_/g, " ").toLowerCase()}` : ""}`,
        paypalId: d.dispute_id,
        detail: { dispute_id: d.dispute_id, status: d.status, outcome: values.outcome },
      });
  } else {
    await db.insert(schema.disputes).values({ id: d.dispute_id, ...values });
    await logEvent({
      mandateId: primary.mandateId,
      type: "PAYPAL",
      tool: "dispute",
      title: `A buyer opened PayPal dispute ${d.dispute_id} (${reasonText(d.reason)}) on capture ${captureId}${amount ? ` for $${amount.toFixed(2)}` : ""} — Writ is assembling the evidence`,
      amount: amount ?? undefined,
      merchant: primary.merchant,
      paypalId: d.dispute_id,
      detail: { dispute_id: d.dispute_id, capture_id: captureId, reason: d.reason, purchase_id: primary.id, purchases: rows.map((r) => r.id) },
    });
    if (opts.investigate !== false)
      void investigate(primary.id, complaintOf(d)).catch((err) => console.error("[dispute] investigation failed", err));
  }
  const [row] = await db.select().from(schema.disputes).where(eq(schema.disputes.id, d.dispute_id));
  return row;
}

/** Ask PayPal for disputes on this purchase's capture (works without webhooks). */
export async function syncForPurchase(purchaseId: string) {
  const [p] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
  if (!p) throw new Error("Purchase not found");
  if (!p.captureId) return [];
  const items = await listDisputesFor(p.captureId);
  const out: DisputeRow[] = [];
  for (const it of items) {
    const row = await syncDispute(it.dispute_id);
    if (row) out.push(row);
  }
  return out.length ? out : disputesForPurchase(purchaseId);
}

/** Ask PayPal for every recent dispute on the account and sync the ones on Writ captures. */
export async function syncAll() {
  const items = await listRecentDisputes();
  const out: DisputeRow[] = [];
  for (const it of items) {
    const row = await syncDispute(it.dispute_id).catch((err) => (console.error("[dispute] sync", it.dispute_id, err), null));
    if (row) out.push(row);
  }
  return out;
}

export async function disputesForPurchase(purchaseId: string) {
  const [p] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
  if (!p?.captureId) return [];
  return db.select().from(schema.disputes).where(eq(schema.disputes.captureId, p.captureId)).orderBy(desc(schema.disputes.createdAt));
}

/**
 * Forensics → dispute response. If the records show the payment was authorized AND the agent and the
 * merchant/provider did what was agreed, contest with evidence. If Writ's side (agent or provider) was
 * at fault, the buyer is right: accept the claim.
 */
export function recommendedResponse(report: ForensicsReport | null): DisputeResponse | null {
  if (!report) return null;
  if (report.responsible === "AGENT_DEVIATED_FROM_MANDATE" || report.responsible === "MERCHANT_OR_PROVIDER_FAULT") return "ACCEPT_CLAIM";
  return "SUBMIT_EVIDENCE";
}

export function packLines(ev: Awaited<ReturnType<typeof buildEvidence>>, d: PayPalDispute, report: ForensicsReport | null, proof: { sha256: string; signature: string; publicKey: string }, packJson: string) {
  const L: string[] = [];
  L.push("WRIT EVIDENCE PACK", "==================", "");
  L.push(`PayPal dispute:   ${d.dispute_id} (${reasonText(d.reason)})`);
  L.push(`Capture:          ${ev.purchase.capture_id}`);
  L.push(`Purchase:         ${ev.purchase.id}  ${ev.purchase.merchant}  $${ev.purchase.amount.toFixed(2)}`);
  L.push(`Signed mandate:   ${ev.root.id}  sha256 ${ev.root.sha256 ?? "-"}`);
  L.push(`Pack sha256:      ${proof.sha256}`);
  L.push(`Verify:           ${appOrigin()}/forensics/${ev.purchase.id}`, "");
  L.push("SUMMARY", "-------");
  L.push(
    "This payment was made by an AI agent under a mandate the account holder signed. Every capture is checked by a deterministic policy engine (13 rules) against that mandate before PayPal is asked to capture. The records below are numbered (E1, E2, ...) and signed with Ed25519.",
    "",
  );
  if (report) L.push(`Investigation:    ${report.responsible.replace(/_/g, " ").toLowerCase()} (confidence ${report.confidence})`, report.summary, "");
  L.push("DETERMINISTIC CHECKS", "--------------------");
  for (const f of ev.findings) L.push(`[${f.result}] ${f.check}: ${f.detail}  (evidence ${f.evidence.join(", ") || "-"})`);
  L.push("");
  if (report?.findings.length) {
    L.push("CITED FINDINGS", "--------------");
    report.findings.forEach((f, i) => L.push(`${i + 1}. ${f.claim}  [${f.evidence.join(", ")}]`));
    L.push("");
  }
  L.push("EVIDENCE GRAPH", "--------------");
  for (const n of ev.nodes) {
    L.push(`${n.id}  ${n.kind}  ${n.at ?? ""}`, `    ${n.title}`, `    source: ${n.source}`);
    for (const [k, v] of Object.entries(n.facts ?? {})) {
      if (k === "policy" || k === "checks" || k === "chain") continue;
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (s && s !== "null") L.push(`    ${k}: ${s.slice(0, 400)}`);
    }
  }
  L.push("", "SIGNATURE (Ed25519 over canonical JSON of the pack below)", "---------------------------------------------------------");
  L.push(`signature: ${proof.signature}`, "public key:", ...proof.publicKey.trim().split("\n"), "", "PACK (canonical source)", "-----------------------", packJson);
  return L;
}

/** Human-approved response to a PayPal dispute. */
export async function respondToDispute(disputeId: string, action: DisputeResponse, note = "") {
  const [row0] = await db.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId));
  if (!row0?.purchaseId || !row0.mandateId) throw new Error("Unknown dispute — check PayPal for disputes first");
  if (row0.response) throw new Error(`Already answered: ${row0.response.replace(/_/g, " ").toLowerCase()}`);
  const owner = await getMandate(row0.mandateId);

  return withMandateLock(owner ? treeKey(owner) : row0.mandateId, async () => {
    const [row] = await db.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId));
    if (row!.response) throw new Error(`Already answered: ${row!.response.replace(/_/g, " ").toLowerCase()}`);
    let d = await getDispute(disputeId);
    if (d.status === "RESOLVED") throw new Error("PayPal has already resolved this dispute");
    const purchaseId = row!.purchaseId!;
    const mandateId = row!.mandateId!;

    if (action === "ACCEPT_CLAIM") {
      const msg = (note || "Writ Forensics found the fault on our side (agent or provider). Accepting the claim; PayPal refunds you.").slice(0, 2000);
      let via = "PayPal Agent Toolkit";
      try {
        await callToolkit("accept_dispute_claim", { dispute_id: disputeId, note: msg });
      } catch (err) {
        console.warn("[dispute] toolkit accept_dispute_claim failed, using REST", err);
        via = "PayPal Disputes API";
        await acceptClaimRest(disputeId, msg, `accept-${disputeId}`);
      }
      await db.update(schema.disputes).set({ response: "CLAIM_ACCEPTED", updatedAt: new Date() }).where(eq(schema.disputes.id, disputeId));
      // PayPal refunds the buyer from the merchant balance. Reflect it on the purchases this capture paid for
      // when the claim covers them in full; otherwise PayPal's refund webhook is the record.
      const rows = (await purchasesFor(row!.captureId)).filter((p) => ["CAPTURED", "SETTLED"].includes(p.status));
      const total = rows.reduce((s, p) => s + p.amount, 0);
      const covered = row!.amount == null || row!.amount + 0.005 >= total;
      if (covered && rows.length) {
        await db.update(schema.purchases).set({ status: "REFUNDED" }).where(inArray(schema.purchases.id, rows.map((p) => p.id)));
        for (const p of rows) {
          const m = (await getMandate(p.mandateId))!;
          await db.update(schema.mandates).set({ refundedTotal: Math.round((m.refundedTotal + p.amount) * 100) / 100 }).where(eq(schema.mandates.id, p.mandateId));
        }
      }
      await logEvent({
        mandateId,
        type: "HUMAN",
        tool: "dispute",
        title: `You accepted PayPal dispute ${disputeId} via ${via} — PayPal refunds the buyer${row!.amount ? ` $${row!.amount.toFixed(2)}` : ""}`,
        amount: row!.amount ?? undefined,
        paypalId: disputeId,
        detail: { api: via === "PayPal Agent Toolkit" ? "Agent Toolkit accept_dispute_claim → POST /v1/customer/disputes/{id}/accept-claim" : `POST /v1/customer/disputes/${disputeId}/accept-claim`, note: msg },
      });
      return { action, via, dispute: (await syncDispute(disputeId, { investigate: false })) ?? row };
    }

    // SUBMIT_EVIDENCE
    let sandboxNote: string | null = null;
    if (!hasLink(d, "provide_evidence") && d.status !== "WAITING_FOR_SELLER_RESPONSE" && env.paypal.sandbox()) {
      // In the sandbox a fresh dispute sits in the inquiry stage; PayPal's sandbox-only require-evidence
      // call advances it to the point where a merchant may submit evidence.
      await requireSellerEvidence(disputeId);
      sandboxNote = "Sandbox: moved the dispute to WAITING_FOR_SELLER_RESPONSE with PayPal's sandbox-only require-evidence call";
      d = await getDispute(disputeId);
    }
    if (!hasLink(d, "provide_evidence") && d.status !== "WAITING_FOR_SELLER_RESPONSE")
      throw new Error(`PayPal isn't accepting evidence on this dispute right now (status ${d.status.replace(/_/g, " ").toLowerCase()})`);

    const ev = await buildEvidence(purchaseId);
    const report = await latestReport(purchaseId);
    const { pack, sig } = signedEvidencePack(ev, note, { paypal_dispute: { id: disputeId, reason: d.reason, capture_id: row!.captureId }, report });
    const packJson = JSON.stringify(pack, null, 1);
    const pdf = textPdf(packLines(ev, d, report, { sha256: sig.hash, signature: sig.signature, publicKey: sig.publicKey }, packJson));

    const notes = [
      `Writ evidence pack #${sig.hash.slice(0, 12)} (Ed25519-signed, attached as PDF).`,
      `This payment was authorized by the account holder under signed mandate ${ev.root.id} (sha256 ${(ev.root.sha256 ?? "").slice(0, 16)}...) and passed all ${ev.findings.length ? "deterministic" : ""} policy checks before capture.`,
      ...ev.findings.map((f) => `[${f.result}] ${f.check}`),
      report ? `Investigation: ${report.summary}` : "",
      ev.nodes.find((n) => n.kind === "FULFILMENT") ? `Tracking: ${(ev.nodes.find((n) => n.kind === "FULFILMENT")!.facts as { tracking_number?: string }).tracking_number}` : "",
      note ? `Note: ${note}` : "",
      `Full evidence: ${appOrigin()}/forensics/${purchaseId}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);

    // Answer what PayPal asked for when we can; otherwise submit as general evidence.
    const requested = (d.evidences ?? []).filter((e) => e.source === "REQUESTED_FROM_SELLER").map((e) => e.evidence_type);
    const tracking = (ev.nodes.find((n) => n.kind === "FULFILMENT")?.facts as { tracking_number?: string } | undefined)?.tracking_number;
    const preferred: EvidenceItem[] =
      requested.includes("PROOF_OF_FULFILLMENT") && tracking
        ? [{ evidence_type: "PROOF_OF_FULFILLMENT", evidence_info: { tracking_info: [{ carrier_name: "USPS", tracking_number: tracking }] }, notes }]
        : [{ evidence_type: requested.find((t) => t !== "PROOF_OF_FULFILLMENT" && t !== "PROOF_OF_REFUND" && t !== "PROOF_OF_RETURN") ?? "OTHER", notes }];
    const file = { name: `writ-evidence-${disputeId}.pdf`, bytes: pdf };
    let submitted = preferred;
    try {
      await provideEvidence(disputeId, preferred, file, `evidence-${disputeId}-${sig.hash.slice(0, 8)}`);
    } catch (err) {
      if (!(err instanceof PayPalError) || err.status !== 400 || preferred[0].evidence_type === "OTHER") throw err;
      submitted = [{ evidence_type: "OTHER", notes }];
      await provideEvidence(disputeId, submitted, file, `evidence-${disputeId}-${sig.hash.slice(0, 8)}-other`);
    }

    await db.update(schema.disputes).set({ response: "EVIDENCE_SUBMITTED", packSha256: sig.hash, updatedAt: new Date() }).where(eq(schema.disputes.id, disputeId));
    if (sandboxNote) await logEvent({ mandateId, type: "SYSTEM", tool: "dispute", title: sandboxNote, paypalId: disputeId });
    await logEvent({
      mandateId,
      type: "HUMAN",
      tool: "dispute",
      title: `You approved Writ's answer — signed evidence pack #${sig.hash.slice(0, 8)} submitted to PayPal dispute ${disputeId} (${submitted[0].evidence_type.replace(/_/g, " ").toLowerCase()})`,
      paypalId: disputeId,
      detail: { api: `POST /v1/customer/disputes/${disputeId}/provide-evidence`, pack_sha256: sig.hash, evidence_type: submitted[0].evidence_type, pdf_bytes: pdf.length },
    });
    return {
      action,
      evidence_pack: { pack, proof: { sha256: sig.hash, signature: sig.signature, public_key_pem: sig.publicKey } },
      dispute: (await syncDispute(disputeId, { investigate: false })) ?? row,
    };
  });
}

/** Disputes for a mandate's whole tree (Mission Control / ledger). */
export async function disputesForMandates(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(schema.disputes).where(and(inArray(schema.disputes.mandateId, ids))).orderBy(desc(schema.disputes.createdAt));
}
