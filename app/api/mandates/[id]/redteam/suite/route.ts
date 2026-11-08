import { NextResponse } from "next/server";
import { getMandate, logEvent } from "@/lib/ledger";
import { runRedTeamSuite } from "@/lib/redteam-suite";

export const runtime = "nodejs";

/**
 * Run the red-team suite against a live mandate: a compromised agent gets a real signed sub-mandate
 * and attacks through the real tool paths; PayPal is queried before and after to prove $0.00 moved.
 * Runs in the background (the adversarial LLM takes ~30-60s); the scorecard lands in the ledger.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.status !== "ACTIVE") return NextResponse.json({ error: "Authorize the PayPal hold first — the attack needs a live hold to prove nothing moves." }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  void runRedTeamSuite(id, { adversary: body?.adversary !== false }).catch(async (e) => {
    console.error("[redteam]", e);
    await logEvent({ mandateId: id, type: "SYSTEM", tool: "redteam", title: `Red-team run failed: ${String((e as Error).message).slice(0, 160)}` });
  });
  return NextResponse.json({ started: true }, { status: 202 });
}
