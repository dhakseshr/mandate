import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { syncAll } from "@/lib/disputes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → disputes Writ knows about. POST → ask PayPal for every recent dispute and sync the ones on Writ captures. */
export async function GET() {
  return NextResponse.json({ disputes: await db.select().from(schema.disputes).orderBy(desc(schema.disputes.createdAt)) });
}

export async function POST() {
  try {
    return NextResponse.json({ disputes: await syncAll() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
