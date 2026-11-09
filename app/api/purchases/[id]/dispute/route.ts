import { NextResponse } from "next/server";
import { z } from "zod";
import { disputesForPurchase, recommendedResponse, respondToDispute, syncForPurchase } from "@/lib/disputes";
import { latestReport } from "@/lib/forensics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → PayPal disputes on this purchase's capture (from the local record) + Writ's recommended response. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ disputes: await disputesForPurchase(id), recommendation: recommendedResponse(await latestReport(id)) });
}

/**
 * POST { action: "sync" }                                  → ask PayPal's Disputes API for disputes on this capture
 * POST { action: "SUBMIT_EVIDENCE" | "ACCEPT_CLAIM", dispute_id, note } → the human's decision, carried out on PayPal
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z
    .object({ action: z.enum(["sync", "SUBMIT_EVIDENCE", "ACCEPT_CLAIM"]), dispute_id: z.string().max(64).optional(), note: z.string().max(500).optional() })
    .parse(await req.json().catch(() => ({})));
  try {
    if (body.action === "sync") return NextResponse.json({ disputes: await syncForPurchase(id) });
    if (!body.dispute_id) return NextResponse.json({ error: "dispute_id is required" }, { status: 400 });
    const mine = await disputesForPurchase(id);
    if (!mine.some((d) => d.id === body.dispute_id)) return NextResponse.json({ error: "That dispute isn't on this purchase" }, { status: 404 });
    return NextResponse.json(await respondToDispute(body.dispute_id, body.action, body.note));
  } catch (err) {
    console.error("[dispute]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
