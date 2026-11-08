// Headless agent test WITHOUT moving money: a fake ACTIVE mandate whose approval threshold forces
// every purchase to ESCALATE, so the loop must stop and wait for a human.
// Run: npx tsx --env-file=.env scripts/try-agent.mts
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { compileMandate } from "@/lib/policy/compiler";
import { newId } from "@/lib/ledger";
import { runAgent } from "@/lib/agent/run";

const text = "Running shoes for my marathon, max $120, ask me before buying anything over $10.";
const policy = await compileMandate(text);
const id = newId("man");
await db.insert(schema.mandates).values({
  id, rawText: text, policy, status: "ACTIVE", budgetTotal: policy.budget_total,
  authorizedAmount: policy.budget_total, authorizationId: "FAKE-NO-CAPTURE",
  expiresAt: new Date(Date.now() + 86_400_000),
});
console.log("policy:", { budget: policy.budget_total, threshold: policy.approval_threshold, q: policy.search_query });
const t0 = Date.now();
await runAgent(id);
const events = await db.select().from(schema.agentEvents).where(eq(schema.agentEvents.mandateId, id)).orderBy(asc(schema.agentEvents.ts));
for (const e of events) console.log(`${e.type.padEnd(15)} ${e.verdict ? `[${e.verdict}/${e.rule}] ` : ""}${e.title.slice(0, 150)}`);
const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.mandateId, id));
console.log(`\nrun status: ${run.status}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`, run.error ?? "");
process.exit(0);
