import { NextResponse } from "next/server";
import { getMandate } from "@/lib/ledger";
import { mandateDocument, verifyMandate } from "@/lib/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export the signed mandate (AP2-shaped IntentMandate + policy + PayPal hold) and verify it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await getMandate((await params).id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!m.signature || !m.signingPublicKey) return NextResponse.json({ error: "Mandate is signed when the PayPal hold is authorized" }, { status: 409 });

  const document = mandateDocument(m);
  const check = verifyMandate(document, m.signature, m.signingPublicKey);
  const body = {
    document,
    proof: {
      type: "Ed25519Signature",
      canonicalization: "sorted-keys JSON",
      sha256: m.signatureHash,
      signature: m.signature,
      public_key_pem: m.signingPublicKey,
      signed_at: m.signedAt,
    },
    verification: { valid: check.valid && check.hash === m.signatureHash, recomputed_sha256: check.hash },
  };
  const download = new URL(req.url).searchParams.has("download");
  return NextResponse.json(body, {
    headers: download ? { "Content-Disposition": `attachment; filename="mandate-${m.id}.ap2.json"` } : {},
  });
}
