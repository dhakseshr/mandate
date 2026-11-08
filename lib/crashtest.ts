// Crash Test: an exhaustive, policy-specific boundary matrix generated from THIS mandate's own clauses.
// Every case is a precise edge (budget + $0.01, approval line + $0.01, one item too many, each blocked
// merchant/brand, an out-of-scope category, rating − 0.1, deadline + 1 day, expired, revoked, and every
// way a delegation could widen authority). Each runs through the REAL engine and attenuation code.
// Pure and read-only: no money moves, no LLM is involved, results are reproducible.
import { evaluateChain } from "@/lib/policy/chain";
import { attenuate, inherit } from "@/lib/policy/attenuate";
import { PolicySchema, type Policy, type Product, type Verdict } from "@/lib/policy/schema";
import { delegableOf, getChain, getMandate, type Mandate } from "@/lib/ledger";

export interface CrashCase {
  id: string;
  clause: string; // which clause / rule the case probes
  case: string; // human description of the edge
  expected: Verdict | "REFUSED";
  verdict: Verdict | "REFUSED" | "ACCEPTED";
  rule: string;
  held: boolean; // the boundary behaved exactly as the clause requires
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${n.toFixed(2)}`;

export async function runCrashTest(mandateId: string) {
  const m = await getMandate(mandateId);
  if (!m) throw new Error("Mandate not found");
  const chain = await getChain(m);
  const p = m.policy;
  const now = new Date();
  // Evaluate as if the mandate were live (a DRAFT can be crash-tested before signing).
  const live = (x: Mandate): Mandate => ({
    ...x,
    status: "ACTIVE",
    authorizedAmount: x.authorizedAmount || x.budgetTotal,
    expiresAt: x.expiresAt ?? new Date(now.getTime() + x.policy.expires_in_hours * 3600_000),
  });
  const liveChain = chain.map(live);
  const remaining = Math.min(...liveChain.map((x) => r2(Math.min(x.budgetTotal, x.authorizedAmount) - x.spentTotal)));
  const itemsLeft = Math.min(...liveChain.map((x) => x.policy.max_items - x.itemsBought));

  // A baseline listing that satisfies every clause; each case mutates exactly one dimension.
  const okPrice = r2(Math.max(0.01, Math.min(remaining, p.approval_threshold ?? remaining, p.max_per_item ?? remaining) * 0.5));
  const base: Product = {
    id: "crash_base",
    title: "Crash-test listing",
    brand: "Neutral Brand",
    price: okPrice,
    currency: "USD",
    merchant: p.merchants_allow[0] ?? "neutral-merchant.example",
    category: p.categories_allow[0] ? `catalog > ${p.categories_allow[0]}` : "catalog > general",
    rating: Math.min(5, Math.max(4.9, p.min_rating ?? 0)),
    delivery_days: 1,
    url: null,
    image: null,
    in_stock: true,
  };

  const cases: CrashCase[] = [];
  let n = 0;
  const probe = (clause: string, what: string, expected: Verdict, mut: Partial<Product>, opts: { quantity?: number; chain?: Mandate[] } = {}) => {
    const { ev } = evaluateChain(opts.chain ?? liveChain, { ...base, ...mut }, opts.quantity ?? 1);
    cases.push({ id: `C${String(++n).padStart(2, "0")}`, clause, case: what, expected, verdict: ev.verdict, rule: ev.rule, held: ev.verdict === expected });
  };

  probe("Baseline", `An item that satisfies every clause (${usd(okPrice)})`, "ALLOW", {});

  // Money
  if (remaining > 0) {
    probe("§ Budget", `${usd(remaining + 0.01)} — one cent over the remaining ${usd(remaining)}`, "DENY", { price: r2(remaining + 0.01) });
    probe("§ Budget", `${usd(remaining * 3)} — triple the remaining budget`, "DENY", { price: r2(remaining * 3) });
  }
  if (p.approval_threshold != null && p.approval_threshold + 0.01 <= remaining && (p.max_per_item ?? Infinity) >= p.approval_threshold + 0.01) {
    probe("§ Approval line", `${usd(p.approval_threshold + 0.01)} — one cent above your line`, "ESCALATE", { price: r2(p.approval_threshold + 0.01) });
    probe("§ Approval line", `${usd(p.approval_threshold)} — exactly at your line`, "ALLOW", { price: p.approval_threshold });
  }
  if (p.max_per_item != null && p.max_per_item + 0.01 <= remaining)
    probe("§ Per-item cap", `${usd(p.max_per_item + 0.01)} — one cent over the per-item cap`, "DENY", { price: r2(p.max_per_item + 0.01) });
  if (itemsLeft >= 0) {
    const unit = r2(Math.max(0.01, Math.min(okPrice, remaining / (itemsLeft + 2))));
    probe("§ Item count", `${itemsLeft + 1} items when ${itemsLeft} may still be bought`, "DENY", { price: unit }, { quantity: itemsLeft + 1 });
  }
  probe("Currency", "Priced in EUR instead of USD", "DENY", { currency: "EUR" });
  probe("Stock", "Out-of-stock listing", "DENY", { in_stock: false });

  // Who you buy from
  for (const b of p.merchants_block) {
    const d = b.includes(".") ? b : `${b}.com`;
    probe("§ Blocked merchant", `Sold by ${d}`, "DENY", { merchant: d });
    probe("§ Blocked merchant", `Sold by a subdomain, deals.${d}`, "DENY", { merchant: `deals.${d}` });
  }
  for (const b of p.merchants_block.slice(0, 2)) {
    const base0 = b.replace(/\.(com|net|co|shop|store)$/, "");
    const look = base0.replace(/o/, "0").replace(/l/, "1") === base0 ? `${base0}-deals.shop` : `${base0.replace(/o/, "0").replace(/l/, "1")}.com`;
    probe("§ Blocked merchant", `Sold by a look-alike, ${look}`, "DENY", { merchant: look });
  }
  probe("Merchant identity", "Sold by an impersonating storefront, paypa1-official.shop", "DENY", { merchant: "paypa1-official.shop" });
  if (p.merchants_allow.length) probe("§ Approved merchants", "Sold by a merchant not on your list", "DENY", { merchant: "unlisted-store.example" });
  for (const b of p.brands_block) probe("§ Blocked brand", `Brand “${b}”`, "DENY", { brand: b });

  // What you buy
  if (p.categories_allow.length) {
    probe("§ Categories", "An out-of-scope category (jewelry)", "DENY", { category: "apparel > jewelry > rings" });
    probe("§ Categories", "A listing with no category", "ESCALATE", { category: null });
  }
  if (p.min_rating != null) {
    probe("§ Minimum rating", `Rated ${(p.min_rating - 0.1).toFixed(1)} — just under your floor`, "DENY", { rating: r2(p.min_rating - 0.1) });
    probe("§ Minimum rating", "No rating published", "ESCALATE", { rating: null });
  }
  if (p.deliver_by) {
    const days = Math.ceil((new Date(p.deliver_by).getTime() - now.getTime()) / 86_400_000) + 1;
    if (days > 0) probe("§ Deadline", `Arrives the day after ${p.deliver_by}`, "DENY", { delivery_days: days });
    probe("§ Deadline", "No delivery estimate", "ESCALATE", { delivery_days: null });
  }

  // Time and status
  const expired = liveChain.map((x, i) => (i === 0 ? { ...x, expiresAt: new Date(now.getTime() - 60_000) } : x));
  probe("§ Validity", "A purchase one minute after the mandate expires", "DENY", {}, { chain: expired });
  const revoked = liveChain.map((x, i) => (i === 0 ? { ...x, status: "REVOKED" } : x));
  probe("Kill switch", "A purchase after the mandate is revoked", "DENY", {}, { chain: revoked });
  if (liveChain.length > 1) {
    const parentRevoked = liveChain.map((x, i) => (i === 1 ? { ...x, status: "REVOKED" } : x));
    probe("Kill switch", "A purchase after the PARENT mandate is revoked", "DENY", {}, { chain: parentRevoked });
  }

  // Delegation: every way a sub-agent could try to WIDEN its authority.
  const { money: delegable, items: delegItems } = await delegableOf(live(m));
  const childOk = inherit(p, { budget_total: Math.max(0.01, r2(Math.min(delegable, okPrice))), max_items: Math.max(1, Math.min(1, delegItems)) });
  const del = (what: string, child: Policy) => {
    const r = attenuate(p, PolicySchema.parse(child), delegable, delegItems);
    cases.push({ id: `C${String(++n).padStart(2, "0")}`, clause: "§ Delegation", case: what, expected: "REFUSED", verdict: r.ok ? "ACCEPTED" : "REFUSED", rule: r.ok ? "NONE" : `ATTENUATION · ${r.violations[0].field}`, held: !r.ok });
  };
  del(`Delegate ${usd(delegable + 0.01)} — one cent more than can be delegated`, { ...childOk, budget_total: r2(delegable + 0.01) });
  if (p.approval_threshold != null) del(`Delegate with an approval line above your ${usd(p.approval_threshold)}`, { ...childOk, approval_threshold: r2(p.approval_threshold + 1) });
  if (p.approval_threshold != null) del("Delegate with no approval line at all", { ...childOk, approval_threshold: null });
  if (p.merchants_block.length) del(`Delegate without the block on ${p.merchants_block[0]}`, { ...childOk, merchants_block: p.merchants_block.slice(1) });
  if (p.brands_block.length) del(`Delegate without the block on brand ${p.brands_block[0]}`, { ...childOk, brands_block: p.brands_block.slice(1) });
  if (p.categories_allow.length) del("Delegate into an extra category (jewelry)", { ...childOk, categories_allow: [...p.categories_allow, "jewelry"] });
  if (p.min_rating != null) del(`Delegate with a lower rating floor than ${p.min_rating}`, { ...childOk, min_rating: r2(p.min_rating - 0.5) });
  if (p.deliver_by) del("Delegate with a later deadline", { ...childOk, deliver_by: new Date(new Date(p.deliver_by).getTime() + 7 * 86_400_000).toISOString().slice(0, 10) });
  del(`Delegate for longer than ${p.expires_in_hours}h`, { ...childOk, expires_in_hours: p.expires_in_hours + 24 });
  del(`Delegate ${delegItems + 1} items when ${delegItems} remain`, { ...childOk, max_items: delegItems + 1 });
  if (p.merchants_allow.length) del("Delegate to merchants outside your approved list", { ...childOk, merchants_allow: [...p.merchants_allow, "unlisted-store.example"] });

  return { mandateId: m.id, total: cases.length, held: cases.filter((c) => c.held).length, cases, ranAt: now.toISOString() };
}

export type CrashTestResult = Awaited<ReturnType<typeof runCrashTest>>;
