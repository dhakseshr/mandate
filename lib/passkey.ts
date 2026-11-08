// Passkey (WebAuthn) signing of mandates — the human's own cryptographic signature.
// The authentication challenge IS sha256(intent document), so the assertion signs exactly these rules.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db, schema } from "@/lib/db";
import { getMandate, logEvent, type Mandate } from "@/lib/ledger";
import { canonical } from "@/lib/signing";

const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/** What the human signs: their words + the enforceable policy + the budget (before PayPal exists). */
export function intentDocument(m: Pick<Mandate, "id" | "rawText" | "policy" | "budgetTotal">) {
  return {
    "ap2.mandates.IntentMandate": {
      natural_language_description: m.rawText,
      user_cart_confirmation_required: false,
      intent_expiry_hours: m.policy.expires_in_hours,
    },
    "mandate.id": m.id,
    "mandate.policy": { ...m.policy, cross_check_fixes: undefined, ambiguities: undefined },
    "mandate.budget": { currency_code: "USD", value: m.budgetTotal.toFixed(2) },
  };
}
export const intentHash = (m: Pick<Mandate, "id" | "rawText" | "policy" | "budgetTotal">) =>
  createHash("sha256").update(canonical(intentDocument(m))).digest();

/** RP id + origin come from the browser's Origin header (localhost in dev, the Render host in prod). */
export function relyingParty(req: Request) {
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const allowed = [/^http:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.onrender\.com$/, ...(process.env.APP_ORIGIN ? [new RegExp(`^${process.env.APP_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)] : [])];
  if (!allowed.some((r) => r.test(origin))) throw new Error(`Origin not allowed for passkeys: ${origin}`);
  return { origin, rpID: new URL(origin).hostname };
}

async function authOptions(m: Mandate, rpID: string, credentialId: string) {
  const challenge = intentHash(m);
  return generateAuthenticationOptions({
    rpID,
    challenge,
    allowCredentials: [{ id: credentialId }],
    userVerification: "preferred",
    timeout: 60_000,
  });
}

export async function startPasskey(mandateId: string, req: Request, credentialId?: string) {
  const m = await mustBeSignable(mandateId);
  const { rpID } = relyingParty(req);
  if (credentialId) {
    const [pk] = await db.select().from(schema.passkeys).where(eq(schema.passkeys.id, credentialId));
    if (pk) return { mode: "authenticate" as const, options: await authOptions(m, rpID, pk.id) };
  }
  const options = await generateRegistrationOptions({
    rpName: "Mandate",
    rpID,
    userName: "mandate-signer",
    userDisplayName: "Mandate signer",
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    timeout: 60_000,
  });
  await db.update(schema.mandates).set({ passkeyChallenge: options.challenge }).where(eq(schema.mandates.id, m.id));
  return { mode: "register" as const, options };
}

export async function finishRegistration(mandateId: string, req: Request, response: RegistrationResponseJSON) {
  const m = await mustBeSignable(mandateId);
  const { origin, rpID } = relyingParty(req);
  if (!m.passkeyChallenge) throw new Error("No registration in progress");
  const v = await verifyRegistrationResponse({ response, expectedChallenge: m.passkeyChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  if (!v.verified || !v.registrationInfo) throw new Error("Passkey registration could not be verified");
  const cred = v.registrationInfo.credential;
  await db
    .insert(schema.passkeys)
    .values({ id: cred.id, publicKey: b64url(cred.publicKey), counter: cred.counter, transports: cred.transports ?? null })
    .onConflictDoNothing();
  await db.update(schema.mandates).set({ passkeyChallenge: null }).where(eq(schema.mandates.id, m.id));
  return { mode: "authenticate" as const, credentialId: cred.id, options: await authOptions(m, rpID, cred.id) };
}

export async function finishSigning(mandateId: string, req: Request, response: AuthenticationResponseJSON) {
  const m = await mustBeSignable(mandateId);
  const { origin, rpID } = relyingParty(req);
  const [pk] = await db.select().from(schema.passkeys).where(eq(schema.passkeys.id, response.id));
  if (!pk) throw new Error("Unknown passkey");
  const hash = intentHash(m);
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: b64url(hash),
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: pk.id, publicKey: fromB64url(pk.publicKey), counter: pk.counter, transports: (pk.transports ?? undefined) as never },
    requireUserVerification: false,
  });
  if (!v.verified) throw new Error("Passkey signature could not be verified");
  await db.update(schema.passkeys).set({ counter: v.authenticationInfo.newCounter }).where(eq(schema.passkeys.id, pk.id));
  await db
    .update(schema.mandates)
    .set({
      signedWith: "passkey",
      passkeyCredentialId: pk.id,
      passkeyIntentHash: hash.toString("hex"),
      passkeyAssertion: { response, userVerified: v.authenticationInfo.userVerified, publicKey: pk.publicKey },
    })
    .where(eq(schema.mandates.id, m.id));
  await logEvent({
    mandateId: m.id,
    type: "HUMAN",
    tool: "passkey",
    title: `You signed this mandate with a passkey — intent #${hash.toString("hex").slice(0, 8)}`,
    detail: { intent_sha256: hash.toString("hex"), credential_id: pk.id, user_verified: v.authenticationInfo.userVerified },
  });
  return { signed: true, intentHash: hash.toString("hex") };
}

async function mustBeSignable(id: string) {
  const m = await getMandate(id);
  if (!m) throw new Error("Mandate not found");
  if (!["DRAFT", "AWAITING_AUTH"].includes(m.status)) throw new Error("Only an unauthorized mandate can be signed");
  return m;
}
