import { NextResponse } from "next/server";
import { runCrashTest } from "@/lib/crashtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Policy-specific boundary matrix. Read-only, instant, works before signing (DRAFT) too. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await runCrashTest((await params).id));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
export const GET = POST;
