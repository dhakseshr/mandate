// Writ Forensics: when a purchase goes wrong, reconstruct the WHOLE decision chain and separate
// three questions an authorized payment doesn't answer on its own:
//   1. Did the human authorize it?            (signed mandate, passkey, delegation chain, 13 checks)
//   2. Did the agent follow the instruction?  (what the agent saw and chose vs. the human's words)
//   3. Did the merchant/provider deliver it?  (listing / response vs. what arrived)
// The investigation LLM may only make claims that CITE evidence node ids; uncited claims are dropped by
// code. It recommends; a human approves; the refund executes through the PayPal Agent Toolkit.
import { generateText, Output } from "ai";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { model } from "@/lib/ai/provider";
import { getChain, getMandate, logEvent, newId } from "@/lib/ledger";
import { refundPurchase } from "@/lib/refund";
import { signMandate } from "@/lib/signing";

export interface EvidenceNode {
  id: string; // E1, E2, …
  kind:
    | "INTENT" | "HUMAN_SIGNATURE" | "MANDATE_SEAL" | "DELEGATION" | "LISTING" | "AGENT_DECISION"
    | "POLICY_CHECKS" | "MERCHANT_RECEIPT" | "PAYMENT" | "PROVIDER_RESPONSE" | "FULFILMENT" | "WEBHOOK" | "COMPLAINT" | "REFUND";
  title: string;
  at: string | null;
  facts: Record<string, unknown>;
  source: string; // where it comes from (table / event id)
}

export interface DeterministicFinding {
  check: string;
  result: "PASS" | "FAIL" | "UNKNOWN";
  detail: string;
  evidence: string[];
}

const NEGATION = /\b(?:never|not|no|without|avoid|don't|do not)\s+(?:buy\s+|get\s+|use\s+)?([a-z][a-z-]{2,}(?:\s[a-z][a-z-]{2,})?)/gi;
const STOP = new Set(["more", "more than", "amazon", "the", "any", "one", "need", "ask", "longer", "later"]);

export async function buildEvidence(purchaseId: string, complaint?: string) {
  const [p] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
  if (!p) throw new Error("Purchase not found");
  const m = (await getMandate(p.mandateId))!;
  const chain = await getChain(m);
  const root = chain[chain.length - 1];
  const ids = chain.map((c) => c.id);
  const events = await db.select().from(schema.agentEvents).where(inArray(schema.agentEvents.mandateId, ids)).orderBy(asc(schema.agentEvents.ts));

  const nodes: EvidenceNode[] = [];
  const add = (n: Omit<EvidenceNode, "id">) => {
    const node = { id: `E${nodes.length + 1}`, ...n };
    nodes.push(node);
    return node.id;
  };
  const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

  add({ kind: "INTENT", title: "The human's own words", at: iso(root.createdAt), facts: { instruction: root.rawText, cross_check_fixes: root.policy.cross_check_fixes }, source: `mandates/${root.id}.raw_text` });
  if (root.signedWith === "passkey")
    add({ kind: "HUMAN_SIGNATURE", title: "Passkey signature over the intent", at: null, facts: { method: "webauthn", intent_sha256: root.passkeyIntentHash, credential_id: root.passkeyCredentialId }, source: `mandates/${root.id}.passkey_assertion` });
  add({ kind: "MANDATE_SEAL", title: "Signed mandate bound to the PayPal hold", at: iso(root.signedAt), facts: { sha256: root.signatureHash, paypal_authorization_id: root.authorizationId, policy: root.policy }, source: `mandates/${root.id}.signature` });
  for (const level of chain.slice(0, -1).reverse())
    add({ kind: "DELEGATION", title: `Delegated to ${level.name ?? level.id}`, at: iso(level.createdAt), facts: { mandate_id: level.id, sha256: level.signatureHash, budget: level.budgetTotal, approval_line: level.policy.approval_threshold, goal: level.policy.goal }, source: `mandates/${level.id}` });

  const product = p.product;
  add({ kind: "LISTING", title: p.id.startsWith("tab_") ? "What the provider offered (signed 402 price)" : "What the merchant advertised", at: null, facts: { title: product.title, description: product.description ?? null, merchant: p.merchant, price: product.price, category: product.category, rating: product.rating }, source: `purchases/${p.id}.product` });

  const verdict = [...events].reverse().find((e) => e.type === "POLICY_VERDICT" && (e.detail as { product?: { id?: string } } | null)?.product?.id === product.id && e.ts <= p.createdAt);
  if (verdict?.detail && (verdict.detail as { rationale?: string }).rationale)
    add({ kind: "AGENT_DECISION", title: `Agent's stated reason (${chain[0].name ?? "agent"})`, at: iso(verdict.ts), facts: { rationale: (verdict.detail as { rationale?: string }).rationale, mandate_id: verdict.mandateId }, source: `agent_events/${verdict.id}` });
  if (verdict)
    add({
      kind: "POLICY_CHECKS",
      title: `Policy engine verdict: ${verdict.verdict} (${verdict.rule})`,
      at: iso(verdict.ts),
      facts: { verdict: verdict.verdict, rule: verdict.rule, checks: (verdict.detail as { checks?: unknown }).checks, chain: (verdict.detail as { chain?: unknown }).chain ?? null },
      source: `agent_events/${verdict.id}`,
    });

  const receiptEv = events.find((e) => e.tool === "verify" && (e.detail as { capture_id?: string } | null)?.capture_id === p.captureId && p.captureId);
  if (receiptEv) add({ kind: "MERCHANT_RECEIPT", title: "Merchant verification receipt (signed)", at: iso(receiptEv.ts), facts: { receipt_sha256: (receiptEv.detail as { receipt_sha256?: string }).receipt_sha256, verdict: (receiptEv.detail as { verdict?: string }).verdict }, source: `agent_events/${receiptEv.id}` });

  const tabPaid = events.find((e) => e.tool === "tab" && (e.detail as { purchase_id?: string } | null)?.purchase_id === p.id);
  if (tabPaid)
    add({
      kind: "PROVIDER_RESPONSE",
      title: "What the provider actually returned",
      at: iso(tabPaid.ts),
      facts: { response: (tabPaid.detail as { response?: string }).response, receipt_sha256: (tabPaid.detail as { receipt_sha256?: string }).receipt_sha256, simulated_provider: true },
      source: `agent_events/${tabPaid.id}`,
    });

  if (p.captureId) {
    const cap = events.find((e) => e.type === "PAYPAL" && e.paypalId === p.captureId && /Captured|Settled/.test(e.title));
    add({ kind: "PAYMENT", title: p.status === "SETTLED" || p.id.startsWith("tab_") ? "Settled through PayPal (tab batch capture)" : "Captured through PayPal", at: iso(cap?.ts ?? p.createdAt), facts: { capture_id: p.captureId, amount: p.amount, status: p.status }, source: cap ? `agent_events/${cap.id}` : `purchases/${p.id}` });
    const hooks = events.filter((e) => e.tool === "webhook" && e.paypalId === p.captureId);
    for (const h of hooks) add({ kind: "WEBHOOK", title: h.title, at: iso(h.ts), facts: { paypal_id: h.paypalId }, source: `agent_events/${h.id}` });
  } else {
    add({ kind: "PAYMENT", title: "Accrued on the tab (not yet settled through PayPal)", at: iso(p.createdAt), facts: { amount: p.amount, status: p.status }, source: `purchases/${p.id}` });
  }
  if (p.trackingNumber) add({ kind: "FULFILMENT", title: "Shipment registered with PayPal (simulated carrier)", at: null, facts: { tracking_number: p.trackingNumber, carrier: "USPS (simulated)" }, source: `purchases/${p.id}.tracking_number` });
  if (p.refundId) add({ kind: "REFUND", title: "Refund already issued", at: null, facts: { refund_id: p.refundId }, source: `purchases/${p.id}.refund_id` });
  if (complaint) add({ kind: "COMPLAINT", title: "The human's complaint", at: new Date().toISOString(), facts: { complaint }, source: "user input" });

  // Deterministic checks (no AI): what can be proven straight from the records.
  const nid = (k: EvidenceNode["kind"]) => nodes.filter((n) => n.kind === k).map((n) => n.id);
  const findings: DeterministicFinding[] = [];
  const authorized = verdict && ["ALLOW", "APPROVED"].includes(verdict.verdict ?? "");
  findings.push({
    check: "Authorized under a signed mandate",
    result: authorized ? "PASS" : verdict ? "FAIL" : "UNKNOWN",
    detail: authorized ? `All mandate rules passed (${verdict!.rule}) at every level of the chain` : "No allowing verdict found for this purchase",
    evidence: [...nid("MANDATE_SEAL"), ...nid("DELEGATION"), ...nid("POLICY_CHECKS")],
  });
  const listingText = `${product.title} ${product.description ?? ""}`.toLowerCase();
  const excluded = [...root.rawText.matchAll(NEGATION)].map((x) => x[1].toLowerCase().trim()).filter((w) => !STOP.has(w) && !w.includes("."));
  const hit = excluded.find((w) => listingText.includes(w));
  findings.push({
    check: "Agent's pick matches the human's instruction",
    result: excluded.length === 0 ? "UNKNOWN" : hit ? "FAIL" : "PASS",
    detail: hit ? `The listing the agent chose contains “${hit}”, which the instruction excluded` : excluded.length ? `The listing contains none of the excluded terms (${excluded.join(", ")})` : "The instruction has no explicit exclusions to check against",
    evidence: [...nid("INTENT"), ...nid("LISTING"), ...nid("AGENT_DECISION")],
  });
  const resp = nodes.find((n) => n.kind === "PROVIDER_RESPONSE")?.facts.response as string | undefined;
  if (resp)
    findings.push({
      check: "Provider response free of injected instructions",
      result: /system notice|ignore previous|pre-?approved|buy .* at once/i.test(resp) ? "FAIL" : "PASS",
      detail: /system notice|ignore previous|pre-?approved/i.test(resp) ? "The paid response contains instructions addressed to AI agents (prompt injection)" : "No instructions to agents found in the response",
      evidence: nid("PROVIDER_RESPONSE"),
    });

  return { purchase: { id: p.id, amount: p.amount, status: p.status, merchant: p.merchant, capture_id: p.captureId, mandate_id: p.mandateId }, root: { id: root.id, sha256: root.signatureHash }, nodes, findings };
}

const ReportSchema = z.object({
  summary: z.string().describe("Two sentences for the human"),
  findings: z.array(z.object({ claim: z.string(), evidence: z.array(z.string()).describe("Evidence node ids like E3"), points_to: z.enum(["AGENT", "MERCHANT_OR_PROVIDER", "HUMAN_INSTRUCTION", "NONE"]) })).max(6),
  responsible: z.enum(["AGENT_DEVIATED_FROM_MANDATE", "MERCHANT_OR_PROVIDER_FAULT", "AUTHORIZED_AND_AS_DESCRIBED", "INSUFFICIENT_EVIDENCE"]),
  recommended_action: z.enum(["REFUND_FULL", "OPEN_DISPUTE", "NO_ACTION"]),
  missing_evidence: z.array(z.string()).max(4),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
export type ForensicsReport = z.infer<typeof ReportSchema> & { id: string; purchase_id: string; dropped_uncited: number; deterministic: DeterministicFinding[] };

export async function investigate(purchaseId: string, complaint: string): Promise<ForensicsReport> {
  const ev = await buildEvidence(purchaseId, complaint);
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: ReportSchema }),
    temperature: 0,
    maxRetries: 1,
    system: `You are a payments forensics investigator. Decide WHO deviated from the agreed terms, using ONLY the evidence nodes provided.
Rules: every finding must cite one or more evidence ids (E1, E2, …) that directly support it. Do not invent facts. Distinguish:
- AGENT_DEVIATED_FROM_MANDATE: the agent chose something the human's instruction excluded or didn't ask for.
- MERCHANT_OR_PROVIDER_FAULT: what was advertised/paid for differs from what was delivered/returned (incl. manipulated data).
- AUTHORIZED_AND_AS_DESCRIBED: it matches the instruction and the listing.
- INSUFFICIENT_EVIDENCE: the records can't tell.
Prefer the deterministic checks when they are conclusive. Recommend REFUND_FULL when the buyer side shouldn't bear the cost, OPEN_DISPUTE when the merchant/provider is at fault and contests are likely, NO_ACTION otherwise. A human approves any action.`,
    prompt: `Complaint: """${complaint}"""\n\nDeterministic checks:\n${JSON.stringify(ev.findings, null, 2)}\n\nEvidence nodes:\n${JSON.stringify(ev.nodes, null, 2)}`,
  });
  // Code, not the model, enforces citation: drop any finding without valid evidence ids.
  const valid = new Set(ev.nodes.map((n) => n.id));
  const kept = output.findings.map((f) => ({ ...f, evidence: f.evidence.filter((e) => valid.has(e)) })).filter((f) => f.evidence.length > 0);
  const report: ForensicsReport = {
    ...output,
    findings: kept,
    responsible: kept.length ? output.responsible : "INSUFFICIENT_EVIDENCE",
    id: newId("frx"),
    purchase_id: purchaseId,
    dropped_uncited: output.findings.length - kept.length,
    deterministic: ev.findings,
  };
  await logEvent({
    mandateId: ev.purchase.mandate_id,
    type: "POLICY_VERDICT",
    tool: "forensics",
    rule: "FORENSICS",
    verdict: report.responsible === "AUTHORIZED_AND_AS_DESCRIBED" ? "ALLOW" : report.responsible === "INSUFFICIENT_EVIDENCE" ? "ESCALATE" : "DENY",
    title: `Forensics: ${report.responsible.replace(/_/g, " ").toLowerCase()} → recommends ${report.recommended_action.replace(/_/g, " ").toLowerCase()} (awaiting your decision)`,
    amount: ev.purchase.amount,
    merchant: ev.purchase.merchant,
    detail: { report, evidence: ev },
  });
  return report;
}

/** The evidence graph + deterministic checks, Ed25519-signed so PayPal (or anyone) can verify it offline. */
export function signedEvidencePack(ev: Awaited<ReturnType<typeof buildEvidence>>, note = "", extra: Record<string, unknown> = {}) {
  const pack = { type: "writ.evidence_pack", issued_at: new Date().toISOString(), purchase: ev.purchase, mandate: ev.root, evidence: ev.nodes, deterministic_checks: ev.findings, note, ...extra };
  return { pack, sig: signMandate(pack) };
}

/** Human-approved resolution. Refunds run through the PayPal Agent Toolkit; disputes get a signed evidence pack. */
export async function resolve(purchaseId: string, action: "REFUND_FULL" | "OPEN_DISPUTE" | "NO_ACTION", note = "") {
  const ev = await buildEvidence(purchaseId);
  if (action === "REFUND_FULL") {
    const r = await refundPurchase(purchaseId, note || "Refund after Writ Forensics review");
    await logEvent({ mandateId: ev.purchase.mandate_id, type: "HUMAN", tool: "forensics", title: `You approved the forensics recommendation — refunded $${ev.purchase.amount.toFixed(2)}`, amount: ev.purchase.amount, paypalId: r.refundId });
    return { action, refund: r };
  }
  if (action === "OPEN_DISPUTE") {
    const { pack, sig } = signedEvidencePack(ev, note);
    await logEvent({ mandateId: ev.purchase.mandate_id, type: "HUMAN", tool: "forensics", title: `You approved a dispute — signed evidence pack #${sig.hash.slice(0, 8)} prepared for PayPal`, amount: ev.purchase.amount, detail: { pack_sha256: sig.hash } });
    return { action, evidence_pack: { pack, proof: { sha256: sig.hash, signature: sig.signature, public_key_pem: sig.publicKey } } };
  }
  await logEvent({ mandateId: ev.purchase.mandate_id, type: "HUMAN", tool: "forensics", title: "You closed the investigation with no action" });
  return { action };
}

export async function latestReport(purchaseId: string) {
  const [p] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, purchaseId));
  if (!p) return null;
  const rows = await db.select().from(schema.agentEvents).where(and(eq(schema.agentEvents.mandateId, p.mandateId), eq(schema.agentEvents.tool, "forensics"), eq(schema.agentEvents.rule, "FORENSICS")));
  const mine = rows.filter((r) => (r.detail as { report?: { purchase_id?: string } } | null)?.report?.purchase_id === purchaseId);
  return mine.length ? (mine[mine.length - 1].detail as { report: ForensicsReport }).report : null;
}
