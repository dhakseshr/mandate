import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getChain, getMandate } from "@/lib/ledger";
import { signMandate } from "@/lib/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent Financial Passport: a signed, scoped, verifiable statement of an agent's financial authority
 * — who delegated it, its limits, what it has spent, its status, and its latest assurance certificate.
 * `id` is the agent's (sub-)mandate id. Verify with POST /api/verify?check.
 * (A scoped passport for this system — not a claimed universal identity standard.)
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  const chain = await getChain(m);
  const root = chain[chain.length - 1];
  const [cert] = await db
    .select()
    .from(schema.agentEvents)
    .where(and(inArray(schema.agentEvents.mandateId, chain.map((c) => c.id)), eq(schema.agentEvents.rule, "RED_TEAM_SCORECARD")))
    .orderBy(desc(schema.agentEvents.ts))
    .limit(1);
  const certificate = (cert?.detail as { scorecard?: { certificate?: { id: string; sha256: string; result: string } } } | null)?.scorecard?.certificate;
  const p = m.policy;
  const passport = {
    "passport.type": "writ.agent_passport",
    "passport.issued_at": new Date().toISOString(),
    agent: { id: m.id, name: m.name ?? (m.parentId ? "Sub-agent" : "Primary agent"), mode: m.agentMode },
    authority: {
      status: m.status,
      valid_until: m.expiresAt,
      spending_limit: { currency_code: "USD", value: m.budgetTotal.toFixed(2) },
      spent: { currency_code: "USD", value: m.spentTotal.toFixed(2) },
      remaining: { currency_code: "USD", value: Math.max(0, m.budgetTotal - m.spentTotal).toFixed(2) },
      max_per_transaction: p.max_per_item,
      ask_human_above: p.approval_threshold,
      max_items: p.max_items,
      categories: p.categories_allow,
      blocked_merchants: p.merchants_block,
      approved_merchants: p.merchants_allow,
      may_delegate: chain.length < 4 ? "narrower authority only (attenuation)" : "no (depth limit)",
    },
    delegation_chain: chain.map((c) => ({ mandate_id: c.id, name: c.name ?? (c.parentId ? null : "Human principal"), sha256: c.signatureHash })).reverse(),
    backed_by: { processor: "paypal", environment: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox", authorization_id: root.authorizationId },
    human_signature: root.signedWith === "passkey" ? { type: "webauthn", intent_sha256: root.passkeyIntentHash } : null,
    assurance_certificate: certificate ? { id: certificate.id, sha256: certificate.sha256, result: certificate.result } : null,
  };
  const sig = signMandate(passport);
  const proof = { type: "Ed25519Signature", sha256: sig.hash, signature: sig.signature, public_key_pem: sig.publicKey };
  const download = new URL(req.url).searchParams.has("download");
  return NextResponse.json({ passport, proof }, { headers: download ? { "Content-Disposition": `attachment; filename="writ-passport-${m.id}.json"` } : {} });
}
