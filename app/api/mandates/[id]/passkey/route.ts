import { NextResponse } from "next/server";
import { finishRegistration, finishSigning, startPasskey } from "@/lib/passkey";

export const runtime = "nodejs";

/**
 * Passkey signing, in up to three steps:
 *  { step: "start", credentialId? }  → { mode: "register" | "authenticate", options }
 *  { step: "register", response }    → { mode: "authenticate", credentialId, options }
 *  { step: "sign", response }        → { signed: true, intentHash }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.step === "start") return NextResponse.json(await startPasskey(id, req, body.credentialId));
    if (body.step === "register") return NextResponse.json(await finishRegistration(id, req, body.response));
    if (body.step === "sign") return NextResponse.json(await finishSigning(id, req, body.response));
    return NextResponse.json({ error: "step must be start | register | sign" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
