// Capability attenuation for delegation. A sub-mandate may only ever be NARROWER than its parent:
// less money, a lower approval line, fewer items, a subset of merchants/categories, a superset of
// blocks, a stricter rating, an earlier deadline. Pure and deterministic — no AI decides this.
import type { Policy } from "./schema";

export interface AttenuationResult {
  ok: boolean;
  violations: { field: keyof Policy | "budget"; message: string }[];
}

const norm = (s: string) => s.toLowerCase().trim();
const subset = (child: string[], parent: string[]) => child.every((c) => parent.map(norm).includes(norm(c)));
const superset = (child: string[], parent: string[]) => parent.every((p) => child.map(norm).includes(norm(p)));

/**
 * @param available  money the parent can still delegate (its budget minus spent minus live allocations)
 * @param itemsLeft  items the parent can still buy
 */
export function attenuate(parent: Policy, child: Policy, available: number, itemsLeft: number): AttenuationResult {
  const v: AttenuationResult["violations"] = [];
  const usd = (n: number) => `$${n.toFixed(2)}`;

  if (child.currency !== parent.currency) v.push({ field: "currency", message: `Currency must stay ${parent.currency}` });
  if (child.budget_total > available + 1e-9)
    v.push({ field: "budget", message: `Asks for ${usd(child.budget_total)} but only ${usd(Math.max(0, available))} is left to delegate` });

  // Approval line: a child can never auto-spend more than the parent would allow without asking.
  if (parent.approval_threshold != null && (child.approval_threshold == null || child.approval_threshold > parent.approval_threshold))
    v.push({ field: "approval_threshold", message: `Approval line must be at or below the parent's ${usd(parent.approval_threshold)}` });
  if (parent.max_per_item != null && (child.max_per_item == null || child.max_per_item > parent.max_per_item))
    v.push({ field: "max_per_item", message: `Per-item cap must be at or below ${usd(parent.max_per_item)}` });
  if (child.max_items > itemsLeft) v.push({ field: "max_items", message: `At most ${itemsLeft} item(s) left in the parent mandate` });

  if (parent.merchants_allow.length && (!child.merchants_allow.length || !subset(child.merchants_allow, parent.merchants_allow)))
    v.push({ field: "merchants_allow", message: `Merchants must be a subset of: ${parent.merchants_allow.join(", ")}` });
  if (!superset(child.merchants_block, parent.merchants_block))
    v.push({ field: "merchants_block", message: `Must keep blocking: ${parent.merchants_block.join(", ")}` });
  if (!superset(child.brands_block, parent.brands_block))
    v.push({ field: "brands_block", message: `Must keep blocking brands: ${parent.brands_block.join(", ")}` });
  if (parent.categories_allow.length && (!child.categories_allow.length || !child.categories_allow.every((c) => parent.categories_allow.some((p) => norm(c).includes(norm(p)) || norm(p).includes(norm(c))))))
    v.push({ field: "categories_allow", message: `Categories must stay within: ${parent.categories_allow.join(", ")}` });

  if (parent.min_rating != null && (child.min_rating == null || child.min_rating < parent.min_rating))
    v.push({ field: "min_rating", message: `Minimum rating must be at least ${parent.min_rating}` });
  if (parent.deliver_by && (!child.deliver_by || new Date(child.deliver_by) > new Date(parent.deliver_by)))
    v.push({ field: "deliver_by", message: `Deadline must be on or before ${parent.deliver_by}` });
  if (child.expires_in_hours > parent.expires_in_hours)
    v.push({ field: "expires_in_hours", message: `Must expire within ${parent.expires_in_hours}h, like its parent` });

  return { ok: v.length === 0, violations: v };
}

/** Build a child policy that inherits every restriction of the parent, then narrows it. */
export function inherit(parent: Policy, patch: Partial<Policy>): Policy {
  const union = (a: string[], b: string[] = []) => Array.from(new Set([...a, ...b]));
  return {
    ...parent,
    ...patch,
    merchants_block: union(parent.merchants_block, patch.merchants_block),
    brands_block: union(parent.brands_block, patch.brands_block),
    approval_threshold:
      patch.approval_threshold != null
        ? parent.approval_threshold != null ? Math.min(patch.approval_threshold, parent.approval_threshold) : patch.approval_threshold
        : parent.approval_threshold,
    max_per_item:
      patch.max_per_item != null
        ? parent.max_per_item != null ? Math.min(patch.max_per_item, parent.max_per_item) : patch.max_per_item
        : parent.max_per_item,
    expires_in_hours: Math.min(patch.expires_in_hours ?? parent.expires_in_hours, parent.expires_in_hours),
    ambiguities: [],
  };
}
