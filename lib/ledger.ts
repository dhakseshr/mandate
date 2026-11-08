// Audit ledger + mandate state helpers.
import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { LedgerState, Product } from "@/lib/policy/schema";

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

export type Mandate = typeof schema.mandates.$inferSelect;
export type EventType = "THOUGHT" | "TOOL_CALL" | "TOOL_RESULT" | "POLICY_VERDICT" | "PAYPAL" | "HUMAN" | "SYSTEM";

export async function logEvent(e: {
  mandateId: string;
  runId?: string | null;
  type: EventType;
  title: string;
  tool?: string;
  detail?: unknown;
  verdict?: string;
  rule?: string;
  amount?: number;
  merchant?: string;
  paypalId?: string;
  ts?: Date;
}) {
  const row = { id: newId("ev"), ...e, ts: e.ts ?? new Date() };
  await db.insert(schema.agentEvents).values(row);
  return row;
}

export async function getMandate(id: string): Promise<Mandate | undefined> {
  const [m] = await db.select().from(schema.mandates).where(eq(schema.mandates.id, id));
  return m;
}

export function ledgerStateOf(m: Mandate): LedgerState {
  return {
    status: m.status as LedgerState["status"],
    authorized: m.authorizedAmount,
    spent: m.spentTotal,
    itemsBought: m.itemsBought,
    expiresAt: m.expiresAt ?? new Date(0),
  };
}

export async function rememberProducts(mandateId: string, products: Product[]) {
  if (!products.length) return;
  const patch = Object.fromEntries(products.map((p) => [p.id, p]));
  await db
    .update(schema.mandates)
    .set({ catalog: sql`${schema.mandates.catalog} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(schema.mandates.id, mandateId));
}

/** Everything the Mission Control screen needs, in one call. */
export async function getMandateView(id: string) {
  const mandate = await getMandate(id);
  if (!mandate) return null;
  // A mandate's view covers its whole delegation subtree: sub-agents' events, approvals and purchases
  // appear here too (each row carries its own mandateId).
  const descendants = await getDescendants(id);
  const ids = [id, ...descendants.map((d) => d.id)];
  const [events, approvals, purchases, runs, treeRuns] = await Promise.all([
    db.select().from(schema.agentEvents).where(inArray(schema.agentEvents.mandateId, ids)).orderBy(asc(schema.agentEvents.ts)),
    db.select().from(schema.approvals).where(inArray(schema.approvals.mandateId, ids)).orderBy(asc(schema.approvals.createdAt)),
    db.select().from(schema.purchases).where(inArray(schema.purchases.mandateId, ids)).orderBy(asc(schema.purchases.createdAt)),
    db.select({ id: schema.agentRuns.id, status: schema.agentRuns.status, error: schema.agentRuns.error })
      .from(schema.agentRuns).where(eq(schema.agentRuns.mandateId, id)).orderBy(desc(schema.agentRuns.startedAt)).limit(1),
    descendants.length
      ? db.select({ mandateId: schema.agentRuns.mandateId, status: schema.agentRuns.status, startedAt: schema.agentRuns.startedAt })
          .from(schema.agentRuns).where(inArray(schema.agentRuns.mandateId, ids.slice(1))).orderBy(desc(schema.agentRuns.startedAt))
      : Promise.resolve([]),
  ]);
  const latestRun = new Map<string, string>();
  for (const r of treeRuns) if (!latestRun.has(r.mandateId)) latestRun.set(r.mandateId, r.status);
  const tree = descendants.map((d) => ({
    id: d.id,
    name: d.name,
    parentId: d.parentId,
    status: d.status,
    goal: d.policy.goal,
    budgetTotal: d.budgetTotal,
    spentTotal: d.spentTotal,
    itemsBought: d.itemsBought,
    approvalThreshold: d.policy.approval_threshold,
    agentMode: d.agentMode,
    signatureHash: d.signatureHash,
    runStatus: latestRun.get(d.id) ?? null,
  }));
  // The catalog is internal (can be large) — don't ship it to the browser. The agent token is shown
  // only to the mandate owner's page (this view), never logged.
  const rest: Omit<Mandate, "catalog"> & { catalog?: unknown } = { ...mandate };
  delete rest.catalog;
  return {
    mandate: rest as Omit<Mandate, "catalog">,
    events,
    approvals,
    purchases,
    run: runs[0] ?? null,
    /** Sub-mandates (delegation tree), empty for a plain mandate. */
    tree,
    /** True while any sub-agent is still working. */
    teamRunning: tree.some((t) => t.runStatus === "RUNNING"),
  };
}
export type MandateView = NonNullable<Awaited<ReturnType<typeof getMandateView>>>;

/** [self, parent, …, root] — every level whose policy a purchase must satisfy. */
export async function getChain(m: Mandate): Promise<Mandate[]> {
  const chain = [m];
  let cur = m;
  for (let depth = 0; cur.parentId && depth < 8; depth++) {
    const p = await getMandate(cur.parentId);
    if (!p) break;
    chain.push(p);
    cur = p;
  }
  return chain;
}

/** All descendants of a mandate (breadth-first). */
export async function getDescendants(id: string): Promise<Mandate[]> {
  const out: Mandate[] = [];
  let frontier = [id];
  for (let depth = 0; frontier.length && depth < 8; depth++) {
    const kids = await db.select().from(schema.mandates).where(inArray(schema.mandates.parentId, frontier));
    out.push(...kids);
    frontier = kids.map((k) => k.id);
  }
  return out;
}

/** An agent may only revoke mandates strictly BELOW it in the delegation tree — never itself-upward. */
export async function canRevoke(actorMandateId: string, targetMandateId: string): Promise<boolean> {
  const target = await getMandate(targetMandateId);
  if (!target) return false;
  const chain = await getChain(target);
  return chain.slice(1).some((c) => c.id === actorMandateId);
}

/** The lock key for a whole delegation tree: money ops anywhere in a tree are serialised together. */
export const treeKey = (m: Pick<Mandate, "id" | "rootId">) => m.rootId ?? m.id;

/** Money a mandate can still delegate: budget − spent − unspent allocations of its live children. */
export async function delegableOf(m: Mandate): Promise<{ money: number; items: number }> {
  const kids = await db.select().from(schema.mandates).where(eq(schema.mandates.parentId, m.id));
  const live = kids.filter((k) => k.status === "ACTIVE");
  const reserved = live.reduce((a, k) => a + Math.max(0, k.budgetTotal - k.spentTotal), 0);
  const reservedItems = live.reduce((a, k) => a + Math.max(0, k.policy.max_items - k.itemsBought), 0);
  return {
    money: Math.round((Math.min(m.budgetTotal, m.authorizedAmount) - m.spentTotal - reserved) * 100) / 100,
    items: Math.max(0, m.policy.max_items - m.itemsBought - reservedItems),
  };
}

// Per-mandate async mutex: money-moving operations are strictly serialised.
const locks = new Map<string, Promise<unknown>>();
export async function withMandateLock<T>(mandateId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(mandateId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(mandateId, next);
  try {
    return await next;
  } finally {
    if (locks.get(mandateId) === next) locks.delete(mandateId);
  }
}
