import { NextResponse } from "next/server";
import { z } from "zod";
import { checkReceipt, verifyOrder } from "@/lib/verify";

export const runtime = "nodejs";

const Body = z.object({
  mandate_id: z.string(),
  merchant: z.string().min(3),
  items: z
    .array(z.object({ title: z.string(), price: z.number().nonnegative(), quantity: z.number().int().positive().optional(), brand: z.string().nullable().optional(), category: z.string().nullable().optional() }))
    .min(1),
});

/**
 * Merchant verification. POST an agent's order → signed receipt { authorized, receipt, proof }.
 * POST { receipt, signature, public_key_pem } with ?check → re-verify a receipt's signature.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (new URL(req.url).searchParams.has("check")) {
    const c = z.object({ receipt: z.unknown(), signature: z.string(), public_key_pem: z.string() }).safeParse(body);
    if (!c.success) return NextResponse.json({ error: "Provide receipt, signature, public_key_pem" }, { status: 400 });
    try {
      return NextResponse.json(checkReceipt(c.data.receipt, c.data.signature, c.data.public_key_pem));
    } catch {
      return NextResponse.json({ valid: false, error: "Malformed public key" }, { status: 400 });
    }
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const out = await verifyOrder(parsed.data);
  if ("reason" in out) return NextResponse.json(out, { status: 404 });
  const { _ev, ...rest } = out;
  void _ev;
  return NextResponse.json(rest);
}
