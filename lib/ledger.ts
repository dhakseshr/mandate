// Audit ledger + mandate state helpers.
import { randomUUID } from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
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
  const [events, approvals, purchases, runs] = await Promise.all([
    db.select().from(schema.agentEvents).where(eq(schema.agentEvents.mandateId, id)).orderBy(asc(schema.agentEvents.ts)),
    db.select().from(schema.approvals).where(eq(schema.approvals.mandateId, id)).orderBy(asc(schema.approvals.createdAt)),
    db.select().from(schema.purchases).where(eq(schema.purchases.mandateId, id)).orderBy(asc(schema.purchases.createdAt)),
    db.select({ id: schema.agentRuns.id, status: schema.agentRuns.status, error: schema.agentRuns.error })
      .from(schema.agentRuns).where(eq(schema.agentRuns.mandateId, id)).orderBy(desc(schema.agentRuns.startedAt)).limit(1),
  ]);
  // The catalog is internal (can be large) — don't ship it to the browser.
  const rest: Omit<Mandate, "catalog"> & { catalog?: unknown } = { ...mandate };
  delete rest.catalog;
  return { mandate: rest as Omit<Mandate, "catalog">, events, approvals, purchases, run: runs[0] ?? null };
}
export type MandateView = NonNullable<Awaited<ReturnType<typeof getMandateView>>>;

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
