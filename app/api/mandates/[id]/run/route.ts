import { NextResponse } from "next/server";
import { startAgentInBackground } from "@/lib/agent/run";

export const runtime = "nodejs";

/** Manually (re)start the agent — e.g. after a transient model error. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  startAgentInBackground((await params).id, "Please continue fulfilling my mandate.");
  return NextResponse.json({ ok: true });
}
