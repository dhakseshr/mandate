// The trust core. Pure, deterministic, no LLM.
// "The LLM proposes, the policy engine decides, PayPal enforces."
import type { Evaluation, LedgerState, Policy, Product, RuleResult, Verdict } from "./schema";

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
const domainMatch = (merchant: string, entry: string) => {
  const m = norm(merchant).replace(/^www\./, "");
  const e = norm(entry).replace(/^www\./, "");
  if (!e) return false;
  // "amazon" (a bare name, as users say it) matches amazon.com, amazon.co.uk, smile.amazon.com
  if (!e.includes(".")) return m.split(".").includes(e);
  return m === e || m.endsWith("." + e);
};
const usd = (n: number) => `$${n.toFixed(2)}`;

export function evaluate(
  policy: Policy,
  ledger: LedgerState,
  proposal: { product: Product; quantity: number },
): Evaluation {
  const { product, quantity } = proposal;
  const amount = round2(product.price * quantity);
  const now = ledger.now ?? new Date();
  const remaining = round2(Math.min(policy.budget_total, ledger.authorized) - ledger.spent);
  const checks: RuleResult[] = [];
  const add = (rule: RuleResult["rule"], verdict: Verdict, message: string) => checks.push({ rule, verdict, message });

  // 1. Mandate must be live
  if (ledger.status !== "ACTIVE") add("MANDATE_ACTIVE", "DENY", `Mandate is ${ledger.status}, not ACTIVE`);
  else if (now > ledger.expiresAt) add("MANDATE_ACTIVE", "DENY", "Mandate has expired");
  else add("MANDATE_ACTIVE", "ALLOW", "Mandate is active");

  // 2. Currency
  if (product.currency.toUpperCase() !== policy.currency)
    add("CURRENCY", "DENY", `Price is in ${product.currency}, mandate is ${policy.currency}`);
  else add("CURRENCY", "ALLOW", policy.currency);

  // 3. Stock
  add("IN_STOCK", product.in_stock ? "ALLOW" : "DENY", product.in_stock ? "In stock" : "Out of stock");

  // 4. Budget (hard cap, enforced again by the PayPal authorization amount)
  if (amount > remaining)
    add("BUDGET_REMAINING", "DENY", `${usd(amount)} exceeds remaining budget ${usd(Math.max(0, remaining))}`);
  else add("BUDGET_REMAINING", "ALLOW", `${usd(amount)} of ${usd(remaining)} remaining`);

  // 5. Per-item cap
  if (policy.max_per_item != null && product.price > policy.max_per_item)
    add("MAX_PER_ITEM", "DENY", `Item price ${usd(product.price)} exceeds per-item cap ${usd(policy.max_per_item)}`);
  else add("MAX_PER_ITEM", "ALLOW", "Within per-item cap");

  // 6. Item count
  if (ledger.itemsBought + quantity > policy.max_items)
    add("MAX_ITEMS", "DENY", `Would buy ${ledger.itemsBought + quantity} items; mandate allows ${policy.max_items}`);
  else add("MAX_ITEMS", "ALLOW", "Within item limit");

  // 7. Merchant block / allow lists
  if (policy.merchants_block.some((b) => domainMatch(product.merchant, b)))
    add("MERCHANT_BLOCK", "DENY", `Merchant ${product.merchant} is blocked`);
  else add("MERCHANT_BLOCK", "ALLOW", "Merchant not blocked");

  if (policy.merchants_allow.length && !policy.merchants_allow.some((a) => domainMatch(product.merchant, a)))
    add("MERCHANT_ALLOW", "DENY", `Merchant ${product.merchant} is not on the allow-list`);
  else add("MERCHANT_ALLOW", "ALLOW", "Merchant permitted");

  // 8. Brand block
  if (product.brand && policy.brands_block.some((b) => norm(b) === norm(product.brand)))
    add("BRAND_BLOCK", "DENY", `Brand ${product.brand} is blocked`);
  else add("BRAND_BLOCK", "ALLOW", "Brand permitted");

  // 9. Category
  if (policy.categories_allow.length) {
    const cat = norm(product.category);
    const ok = cat && policy.categories_allow.some((c) => cat.includes(norm(c)) || norm(c).includes(cat));
    if (!cat) add("CATEGORY_ALLOW", "ESCALATE", "Product category unknown; needs human check");
    else if (!ok) add("CATEGORY_ALLOW", "DENY", `Category "${product.category}" not in mandate`);
    else add("CATEGORY_ALLOW", "ALLOW", `Category "${product.category}" permitted`);
  } else add("CATEGORY_ALLOW", "ALLOW", "Any category");

  // 10. Rating
  if (policy.min_rating != null) {
    if (product.rating == null) add("MIN_RATING", "ESCALATE", `No rating available; mandate requires ≥ ${policy.min_rating}`);
    else if (product.rating < policy.min_rating)
      add("MIN_RATING", "DENY", `Rating ${product.rating} below required ${policy.min_rating}`);
    else add("MIN_RATING", "ALLOW", `Rating ${product.rating} ≥ ${policy.min_rating}`);
  } else add("MIN_RATING", "ALLOW", "No rating requirement");

  // 11. Delivery deadline
  if (policy.deliver_by) {
    const deadline = new Date(policy.deliver_by);
    if (product.delivery_days == null) add("DELIVERY_DEADLINE", "ESCALATE", "Delivery estimate unknown");
    else {
      const eta = new Date(now.getTime() + product.delivery_days * 86_400_000);
      if (eta > endOfDay(deadline))
        add("DELIVERY_DEADLINE", "DENY", `Arrives ~${eta.toDateString()}, after deadline ${deadline.toDateString()}`);
      else add("DELIVERY_DEADLINE", "ALLOW", `Arrives ~${eta.toDateString()}`);
    }
  } else add("DELIVERY_DEADLINE", "ALLOW", "No deadline");

  // 12. Human approval threshold
  if (policy.approval_threshold != null && amount > policy.approval_threshold)
    add("APPROVAL_THRESHOLD", "ESCALATE", `${usd(amount)} is above your approval threshold ${usd(policy.approval_threshold)}`);
  else add("APPROVAL_THRESHOLD", "ALLOW", "Below approval threshold");

  const deny = checks.find((c) => c.verdict === "DENY");
  const esc = checks.find((c) => c.verdict === "ESCALATE");
  const decisive = deny ?? esc;
  return {
    verdict: deny ? "DENY" : esc ? "ESCALATE" : "ALLOW",
    rule: decisive?.rule ?? "ALL_CHECKS_PASSED",
    message: decisive?.message ?? "All mandate rules satisfied",
    amount,
    checks,
  };
}

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e;
}
