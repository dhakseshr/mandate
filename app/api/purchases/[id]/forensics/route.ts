import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEvidence, investigate, latestReport, resolve } from "@/lib/forensics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → { evidence graph, deterministic checks, latest report }. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ...(await buildEvidence(id)), report: await latestReport(id) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

/**
 * POST { complaint }           → run an investigation (evidence-cited report; recommends, never acts)
 * POST { resolve: ACTION, note } → the human's decision: REFUND_FULL | OPEN_DISPUTE | NO_ACTION
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z
    .object({ complaint: z.string().min(3).max(600).optional(), resolve: z.enum(["REFUND_FULL", "OPEN_DISPUTE", "NO_ACTION"]).optional(), note: z.string().max(300).optional() })
    .parse(await req.json().catch(() => ({})));
  try {
    if (body.resolve) return NextResponse.json(await resolve(id, body.resolve, body.note));
    if (!body.complaint) return NextResponse.json({ error: "Describe what went wrong (complaint)" }, { status: 400 });
    return NextResponse.json(await investigate(id, body.complaint));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
