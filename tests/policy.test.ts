import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/policy/engine";
import { PolicySchema, type LedgerState, type Product } from "@/lib/policy/schema";

const now = new Date("2026-11-10T10:00:00Z");
const policy = PolicySchema.parse({
  goal: "Running shoes for a marathon",
  search_query: "marathon running shoes",
  budget_total: 120,
  approval_threshold: 80,
  max_items: 1,
  categories_allow: ["shoes"],
  merchants_block: ["sketchy.example"],
  min_rating: 4,
  deliver_by: "2026-11-14",
});
const ledger: LedgerState = {
  status: "ACTIVE",
  authorized: 120,
  spent: 0,
  itemsBought: 0,
  expiresAt: new Date("2026-11-12T00:00:00Z"),
  now,
};
const shoe = (o: Partial<Product> = {}): Product => ({
  id: "p1",
  title: "Pegasus 41",
  brand: "Nike",
  price: 74.99,
  currency: "USD",
  merchant: "runshop.example",
  category: "running shoes",
  rating: 4.6,
  delivery_days: 2,
  url: null,
  image: null,
  in_stock: true,
  ...o,
});

describe("policy engine", () => {
  it("allows a compliant purchase under the approval threshold", () => {
    const e = evaluate(policy, ledger, { product: shoe(), quantity: 1 });
    expect(e.verdict).toBe("ALLOW");
    expect(e.rule).toBe("ALL_CHECKS_PASSED");
    expect(e.amount).toBe(74.99);
  });

  it("escalates purchases above the approval threshold", () => {
    const e = evaluate(policy, ledger, { product: shoe({ price: 94.99 }), quantity: 1 });
    expect(e.verdict).toBe("ESCALATE");
    expect(e.rule).toBe("APPROVAL_THRESHOLD");
  });

  it("denies when over remaining budget (deny beats escalate)", () => {
    const e = evaluate(policy, ledger, { product: shoe({ price: 135 }), quantity: 1 });
    expect(e.verdict).toBe("DENY");
    expect(e.rule).toBe("BUDGET_REMAINING");
  });

  it("counts already-spent money against the budget", () => {
    const e = evaluate({ ...policy, max_items: 3 }, { ...ledger, spent: 60, itemsBought: 1 }, {
      product: shoe({ price: 70 }),
      quantity: 1,
    });
    expect(e.rule).toBe("BUDGET_REMAINING");
  });

  it("never lets the budget exceed what PayPal actually authorised", () => {
    const e = evaluate(policy, { ...ledger, authorized: 50 }, { product: shoe({ price: 60 }), quantity: 1 });
    expect(e.rule).toBe("BUDGET_REMAINING");
  });

  it("denies blocked merchants including subdomains", () => {
    const e = evaluate(policy, ledger, { product: shoe({ merchant: "www.shop.sketchy.example" }), quantity: 1 });
    expect(e.rule).toBe("MERCHANT_BLOCK");
  });

  it("matches bare merchant names the way users say them", () => {
    const p = { ...policy, merchants_block: ["Amazon"] };
    expect(evaluate(p, ledger, { product: shoe({ merchant: "amazon.com" }), quantity: 1 }).rule).toBe("MERCHANT_BLOCK");
    expect(evaluate(p, ledger, { product: shoe({ merchant: "notamazon.com" }), quantity: 1 }).verdict).toBe("ALLOW");
  });

  it("denies items that arrive after the deadline", () => {
    const e = evaluate(policy, ledger, { product: shoe({ delivery_days: 9 }), quantity: 1 });
    expect(e.rule).toBe("DELIVERY_DEADLINE");
  });

  it("denies low ratings and escalates unknown ratings", () => {
    expect(evaluate(policy, ledger, { product: shoe({ rating: 3.1 }), quantity: 1 }).rule).toBe("MIN_RATING");
    const unknown = evaluate(policy, ledger, { product: shoe({ rating: null }), quantity: 1 });
    expect(unknown.verdict).toBe("ESCALATE");
    expect(unknown.rule).toBe("MIN_RATING");
  });

  it("denies off-mandate categories", () => {
    const e = evaluate(policy, ledger, { product: shoe({ category: "headphones" }), quantity: 1 });
    expect(e.rule).toBe("CATEGORY_ALLOW");
  });

  it("denies when item limit reached", () => {
    const e = evaluate(policy, { ...ledger, itemsBought: 1 }, { product: shoe(), quantity: 1 });
    expect(e.rule).toBe("MAX_ITEMS");
  });

  it("denies everything once the mandate is voided or expired", () => {
    expect(evaluate(policy, { ...ledger, status: "VOIDED" }, { product: shoe(), quantity: 1 }).rule).toBe(
      "MANDATE_ACTIVE",
    );
    expect(
      evaluate(policy, { ...ledger, now: new Date("2026-11-13T00:00:00Z") }, { product: shoe(), quantity: 1 }).rule,
    ).toBe("MANDATE_ACTIVE");
  });

  it("records every check for the audit trail", () => {
    const e = evaluate(policy, ledger, { product: shoe(), quantity: 1 });
    expect(e.checks.length).toBe(13);
  });
});
