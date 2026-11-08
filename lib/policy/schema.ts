import { z } from "zod";

/** A compiled mandate: what the human authorised, in machine-checkable form. */
export const PolicySchema = z.object({
  goal: z.string().default("").describe("What the user wants bought, one sentence"),
  search_query: z.string().describe("A good product search query for the goal"),
  currency: z.literal("USD").default("USD"),
  budget_total: z.number().positive().describe("Hard cap on total spend in USD"),
  max_per_item: z.number().positive().nullable().default(null),
  approval_threshold: z
    .number()
    .positive()
    .nullable()
    .default(null)
    .describe("Purchases above this USD amount need explicit human approval"),
  max_items: z.number().int().positive().default(1),
  categories_allow: z.array(z.string()).default([]).describe("Lowercase product categories allowed; empty = any"),
  brands_block: z.array(z.string()).default([]),
  merchants_allow: z.array(z.string()).default([]).describe("Merchant domains allowed; empty = any"),
  merchants_block: z.array(z.string()).default([]),
  min_rating: z.number().min(0).max(5).nullable().default(null),
  deliver_by: z.string().nullable().default(null).describe("ISO date the item must arrive by, or null"),
  must_have: z.array(z.string()).default([]).describe("Soft preferences, e.g. 'waterproof'"),
  expires_in_hours: z.number().positive().default(72),
  ambiguities: z.array(z.string()).default([]).describe("Questions to ask the user if anything is unclear"),
  /** Filled by code, not the model: corrections the deterministic cross-check made to the AI's output. */
  cross_check_fixes: z.array(z.string()).default([]),
});
export type Policy = z.infer<typeof PolicySchema>;

/** A normalised product, from Channel3 or the demo catalog. */
export const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  brand: z.string().nullable(),
  price: z.number(),
  currency: z.string().default("USD"),
  merchant: z.string().describe("merchant domain"),
  category: z.string().nullable(),
  rating: z.number().nullable(),
  delivery_days: z.number().nullable(),
  url: z.string().nullable(),
  image: z.string().nullable(),
  in_stock: z.boolean().default(true),
  /** Merchant-supplied text. UNTRUSTED — may contain prompt injection. */
  description: z.string().nullable().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

export type Verdict = "ALLOW" | "ESCALATE" | "DENY";

export type RuleId =
  | "MANDATE_ACTIVE"
  | "CURRENCY"
  | "IN_STOCK"
  | "BUDGET_REMAINING"
  | "MAX_PER_ITEM"
  | "MAX_ITEMS"
  | "MERCHANT_BLOCK"
  | "MERCHANT_ALLOW"
  | "BRAND_BLOCK"
  | "CATEGORY_ALLOW"
  | "MIN_RATING"
  | "DELIVERY_DEADLINE"
  | "APPROVAL_THRESHOLD"
  | "ALL_CHECKS_PASSED";

export interface RuleResult {
  rule: RuleId;
  verdict: Verdict;
  message: string;
}

export interface Evaluation {
  verdict: Verdict;
  /** The rule that decided the verdict (first DENY, else first ESCALATE, else ALL_CHECKS_PASSED). */
  rule: RuleId;
  message: string;
  amount: number;
  /** Every rule that was checked, for the audit trail. */
  checks: RuleResult[];
}

export interface LedgerState {
  status: "ACTIVE" | "AWAITING_AUTH" | "DRAFT" | "FULFILLED" | "EXPIRED" | "VOIDED" | "REVOKED";
  authorized: number;
  spent: number;
  itemsBought: number;
  expiresAt: Date;
  now?: Date;
}
