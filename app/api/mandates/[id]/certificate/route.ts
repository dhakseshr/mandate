import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { verifyMandate } from "@/lib/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cert = { id: string; sha256: string; doc: unknown; signature: string; public_key_pem: string; result: string };

/**
 * The latest signed Assurance Certificate for a mandate: bound to the mandate's hash, its PayPal
 * authorization, the crash-test matrix, the red-team results and PayPal's own before/after snapshot.
 * Re-verified on every request. Add ?download for a file.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ev] = await db
    .select()
    .from(schema.agentEvents)
    .where(and(eq(schema.agentEvents.mandateId, id), eq(schema.agentEvents.rule, "RED_TEAM_SCORECARD")))
    .orderBy(desc(schema.agentEvents.ts))
    .limit(1);
  const cert = (ev?.detail as { scorecard?: { certificate?: Cert } } | null)?.scorecard?.certificate;
  if (!cert) return NextResponse.json({ error: "No assurance certificate yet — run the red-team suite on this mandate." }, { status: 404 });

  const check = verifyMandate(cert.doc, cert.signature, cert.public_key_pem);
  const body = {
    certificate: cert.doc,
    proof: { type: "Ed25519Signature", canonicalization: "sorted-keys JSON", sha256: cert.sha256, signature: cert.signature, public_key_pem: cert.public_key_pem },
    verification: { valid: check.valid && check.hash === cert.sha256, recomputed_sha256: check.hash },
  };
  const download = new URL(req.url).searchParams.has("download");
  return NextResponse.json(body, {
    headers: download ? { "Content-Disposition": `attachment; filename="writ-assurance-${id}-${cert.sha256.slice(0, 8)}.json"` } : {},
  });
}
