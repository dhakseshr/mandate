// Verifiable mandates. When the user authorizes the PayPal hold, the policy is frozen and signed
// (Ed25519) as an AP2-shaped IntentMandate (https://ap2-protocol.org), bound to the PayPal
// authorization id. The hash is stamped into every PayPal capture's invoice_id as evidence.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import type { Mandate } from "@/lib/ledger";

let keys: { priv: KeyObject; pubPem: string } | null = null;

/** MANDATE_SIGNING_KEY = base64 PKCS#8 DER Ed25519 private key. If unset, an ephemeral key is used
 *  (signatures stay verifiable because the public key is stored with each mandate). */
function signingKeys() {
  if (keys) return keys;
  const b64 = process.env.MANDATE_SIGNING_KEY?.trim();
  const priv = b64
    ? createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" })
    : generateKeyPairSync("ed25519").privateKey;
  keys = { priv, pubPem: createPublicKey(priv).export({ type: "spki", format: "pem" }).toString() };
  return keys;
}

/** Deterministic JSON (sorted keys) so the hash is reproducible by anyone. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/** AP2 IntentMandate (human-not-present) + the enforceable policy + the PayPal hold that backs it. */
export function mandateDocument(
  m: Pick<Mandate, "id" | "rawText" | "policy" | "authorizationId" | "authorizedAmount" | "expiresAt"> &
    Partial<Pick<Mandate, "signedWith" | "passkeyIntentHash" | "passkeyCredentialId">>,
) {
  const p = m.policy;
  return {
    "ap2.mandates.IntentMandate": {
      natural_language_description: m.rawText.replace(/\[red-team\]/gi, "").trim(),
      // false: the agent may buy without per-item confirmation *when policy allows* (ESCALATE still asks)
      user_cart_confirmation_required: false,
      merchants: p.merchants_allow.length ? p.merchants_allow : null,
      skus: null,
      requires_refundability: false,
      intent_expiry: (m.expiresAt ?? new Date()).toISOString(),
    },
    "mandate.policy": p,
    "mandate.payment": {
      processor: "paypal",
      environment: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
      authorization_id: m.authorizationId,
      amount: { currency_code: "USD", value: m.authorizedAmount.toFixed(2) },
    },
    "mandate.id": m.id,
    // The human's own signature (WebAuthn assertion over sha256 of the intent document), if present.
    ...(m.signedWith === "passkey"
      ? { "mandate.user_signature": { type: "webauthn", intent_sha256: m.passkeyIntentHash, credential_id: m.passkeyCredentialId } }
      : {}),
  };
}

export function signMandate(doc: unknown) {
  const body = canonical(doc);
  const hash = createHash("sha256").update(body).digest("hex");
  const { priv, pubPem } = signingKeys();
  const signature = sign(null, Buffer.from(body), priv).toString("base64");
  return { hash, signature, publicKey: pubPem };
}

export function verifyMandate(doc: unknown, signature: string, publicKeyPem: string) {
  const body = canonical(doc);
  return {
    hash: createHash("sha256").update(body).digest("hex"),
    valid: verify(null, Buffer.from(body), createPublicKey(publicKeyPem), Buffer.from(signature, "base64")),
  };
}
