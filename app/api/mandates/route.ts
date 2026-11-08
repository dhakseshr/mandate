import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { compileMandate } from "@/lib/policy/compiler";
import { logEvent, newId } from "@/lib/ledger";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = z.object({ text: z.string().min(5).max(1000) }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Describe what you want bought (5-1000 chars)." }, { status: 400 });

  try {
    const policy = await compileMandate(body.data.text);
    const id = newId("man");
    await db.insert(schema.mandates).values({
      id,
      rawText: body.data.text,
      policy,
      status: "DRAFT",
      budgetTotal: policy.budget_total,
    });
    await logEvent({ mandateId: id, type: "SYSTEM", title: "Mandate compiled into policy", detail: { policy } });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("[compile]", err);
    return NextResponse.json({ error: "Couldn't understand that mandate. Try rephrasing with a budget." }, { status: 422 });
  }
}

export async function GET() {
  const rows = await db
    .select({
      id: schema.mandates.id,
      rawText: schema.mandates.rawText,
      status: schema.mandates.status,
      budgetTotal: schema.mandates.budgetTotal,
      spentTotal: schema.mandates.spentTotal,
      createdAt: schema.mandates.createdAt,
    })
    .from(schema.mandates)
    .orderBy(desc(schema.mandates.createdAt))
    .limit(30);
  return NextResponse.json(rows);
}
