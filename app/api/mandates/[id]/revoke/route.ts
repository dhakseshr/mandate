import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeMandate } from "@/lib/purchase";

export const runtime = "nodejs";

/** Kill switch: revoke a mandate and its entire delegation subtree. A revoked root voids the PayPal hold. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { reason } = z.object({ reason: z.string().max(200).default("Kill switch") }).parse(await req.json().catch(() => ({})));
  try {
    const ids = await revokeMandate((await params).id, reason || "Kill switch");
    return NextResponse.json({ ok: true, revoked: ids });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
