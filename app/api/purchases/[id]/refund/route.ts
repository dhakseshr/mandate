import { NextResponse } from "next/server";
import { z } from "zod";
import { refundPurchase } from "@/lib/refund";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { reason } = z.object({ reason: z.string().max(255).default("") }).parse(await req.json().catch(() => ({})));
  try {
    return NextResponse.json(await refundPurchase((await params).id, reason));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
