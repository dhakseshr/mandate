// Merchant-side verification: before shipping an agent's order, a merchant asks Mandate
// "is this order authorized by a human, within its limits, right now?" and receives a signed receipt
// it can verify offline with Mandate's public key. This makes agent orders chargeback-defensible.
import { createPublicKey } from "node:crypto";
import { getChain, getMandate, logEvent } from "@/lib/ledger";
import { evaluateChain } from "@/lib/policy/chain";
import type { Product } from "@/lib/policy/schema";
import { canonical, signMandate, verifyMandate } from "@/lib/signing";

/** Checks a merchant can't be expected to attest to (they're the agent's/catalog's concern). */
const MERCHANT_SKIPS = new Set(["MIN_RATING", "DELIVERY_DEADLINE", "IN_STOCK"]);

export interface VerifyRequest {
  mandate_id: string;
  merchant: string;
  items: { title: string; price: number; quantity?: number; brand?: string | null; category?: string | null }[];
}

export async function verifyOrder(req: VerifyRequest, opts: { log?: boolean } = { log: true }) {
  const m = await getMandate(req.mandate_id);
  if (!m) return { authorized: false, reason: "UNKNOWN_MANDATE" as const };
  const chain = await getChain(m);
  const root = chain[chain.length - 1];

  const total = Math.round(req.items.reduce((a, i) => a + i.price * (i.quantity ?? 1), 0) * 100) / 100;
  // Evaluate the whole order as one proposal so totals, item counts and approval lines all apply.
  const product: Product = {
    id: "merchant-order",
    title: req.items.map((i) => i.title).join(" + ").slice(0, 200),
    brand: req.items[0]?.brand ?? null,
    price: total,
    currency: "USD",
    merchant: req.merchant,
    category: req.items[0]?.category ?? null,
    rating: null,
    delivery_days: null,
    url: null,
    image: null,
    in_stock: true,
  };
  const { ev, levels } = evaluateChain(chain, product, 1);
  // A merchant can't be expected to know our category taxonomy: only check categories it declares.
  const skips = new Set(MERCHANT_SKIPS);
  if (!req.items.some((i) => i.category)) skips.add("CATEGORY_ALLOW");
  const relevant = levels.flatMap((l) => l.ev.checks.filter((c) => !skips.has(c.rule)).map((c) => ({ ...c, level: l.name })));
  const blocking = relevant.find((c) => c.verdict === "DENY") ?? relevant.find((c) => c.verdict === "ESCALATE");
  const verdict = blocking?.verdict ?? "ALLOW";

  const receipt = {
    "receipt.type": "mandate.order_verification",
    "receipt.issued_at": new Date().toISOString(),
    mandate: { id: m.id, sha256: m.signatureHash, status: m.status, root: { id: root.id, sha256: root.signatureHash, paypal_authorization_id: root.authorizationId } },
    order: { merchant: req.merchant, total: { currency_code: "USD", value: total.toFixed(2) }, items: req.items.length },
    // ALLOW = ship it; ESCALATE = the human must approve first; DENY = do not fulfil.
    verdict,
    rule: blocking?.rule ?? "ALL_CHECKS_PASSED",
    message: blocking ? `${blocking.level}: ${blocking.message}` : "Authorized by a signed human mandate, within its limits",
  };
  const sig = signMandate(receipt);
  if (opts.log)
    await logEvent({
      mandateId: m.id,
      type: "SYSTEM",
      tool: "verify",
      verdict: verdict === "ALLOW" ? "ALLOW" : verdict,
      title: `Merchant ${req.merchant} verified an order of $${total.toFixed(2)} — ${verdict === "ALLOW" ? "authorized" : verdict === "ESCALATE" ? "needs the human's approval" : "rejected"}`,
      amount: total,
      merchant: req.merchant,
      detail: { receipt_sha256: sig.hash, rule: receipt.rule },
    });
  return {
    authorized: verdict === "ALLOW",
    receipt,
    proof: { type: "Ed25519Signature", canonicalization: "sorted-keys JSON", sha256: sig.hash, signature: sig.signature, public_key_pem: sig.publicKey },
    _ev: ev.verdict,
  };
}

/** Anyone can re-check a receipt offline; this endpoint is a convenience. */
export function checkReceipt(receipt: unknown, signature: string, publicKeyPem: string) {
  createPublicKey(publicKeyPem); // throws on a malformed key
  return verifyMandate(receipt, signature, publicKeyPem);
}

export const receiptBody = canonical;
