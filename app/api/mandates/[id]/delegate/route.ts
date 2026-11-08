import { NextResponse } from "next/server";
import { createSubMandate, planTeam, SubMandateRequest } from "@/lib/delegation";
import { startAgentInBackground } from "@/lib/agent/run";

export const runtime = "nodejs";

/**
 * Create a sub-mandate (strictly narrower than this one), or { auto: true } to let the orchestrator
 * plan a team. Built-in sub-agents start shopping immediately.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.auto) {
      const results = await planTeam(id);
      for (const r of results) if (r.ok) startAgentInBackground(r.mandateId);
      return NextResponse.json({ results: results.map(({ ...r }) => ("agentToken" in r ? { ...r, agentToken: undefined } : r)) });
    }
    const parsed = SubMandateRequest.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const r = await createSubMandate(id, parsed.data, "human");
    if (r.ok && parsed.data.agentMode === "builtin") startAgentInBackground(r.mandateId);
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
