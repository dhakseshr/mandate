import type { Policy } from "@/lib/policy/schema";
import { usd } from "../ui";

/** Who enforces a clause. Only the budget is enforced by money itself (the PayPal hold). */
export type Enforcer = "paypal" | "engine" | "agent";

export type ClauseKind = "money" | "number" | "rating" | "date" | "list" | "hours";

export type ClauseField = {
  key: keyof Policy;
  kind: ClauseKind;
  /** Wording before the value, e.g. "Total spend not to exceed". */
  lead: string;
  /** Short name used in the "+ add clause" menu. */
  short: string;
  enforcer: Enforcer;
  placeholder?: string;
};

/** Every clause a mandate can carry, in instrument order. Validity (expires_in_hours) is rendered separately. */
export const CLAUSE_FIELDS: ClauseField[] = [
  { key: "budget_total", kind: "money", lead: "Total spend not to exceed", short: "Budget", enforcer: "paypal", placeholder: "120" },
  { key: "approval_threshold", kind: "money", lead: "Ask me before any purchase above", short: "Ask-me threshold", enforcer: "engine", placeholder: "40" },
  { key: "max_per_item", kind: "money", lead: "No single item above", short: "Per-item cap", enforcer: "engine", placeholder: "80" },
  { key: "max_items", kind: "number", lead: "Buy at most", short: "Item count", enforcer: "engine", placeholder: "1" },
  { key: "deliver_by", kind: "date", lead: "Must arrive by", short: "Delivery deadline", enforcer: "engine" },
  { key: "min_rating", kind: "rating", lead: "Rated at least", short: "Minimum rating", enforcer: "engine", placeholder: "4.0" },
  { key: "categories_allow", kind: "list", lead: "Only in categories", short: "Categories", enforcer: "engine", placeholder: "shoes, running shoes" },
  { key: "merchants_allow", kind: "list", lead: "Only from merchants", short: "Allowed merchants", enforcer: "engine", placeholder: "rei.com, nike.com" },
  { key: "merchants_block", kind: "list", lead: "Never from merchants", short: "Blocked merchants", enforcer: "engine", placeholder: "amazon.com" },
  { key: "brands_block", kind: "list", lead: "Never these brands", short: "Blocked brands", enforcer: "engine", placeholder: "brand, brand" },
  { key: "must_have", kind: "list", lead: "Prefer", short: "Preferences", enforcer: "agent", placeholder: "waterproof, wide fit" },
];

export const VALIDITY_FIELD: ClauseField = {
  key: "expires_in_hours",
  kind: "hours",
  lead: "Valid for",
  short: "Validity",
  enforcer: "engine",
  placeholder: "72",
};

export const ENFORCER_LABEL: Record<Enforcer, string> = {
  paypal: "PayPal hold",
  engine: "Policy engine",
  agent: "Agent guidance",
};

export function isSet(v: unknown) {
  return !(v == null || (Array.isArray(v) && v.length === 0) || v === "");
}

/** The value as it reads on the instrument (plain text so it can sit in mono). */
export function formatValue(f: ClauseField, v: unknown): string {
  if (!isSet(v)) return "—";
  switch (f.kind) {
    case "money":
      return usd(v as number);
    case "number": {
      const n = Number(v);
      return `${n} item${n === 1 ? "" : "s"}`;
    }
    case "rating":
      return `${Number(v).toFixed(1)} / 5`;
    case "date":
      return new Date(v as string).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    case "list":
      return (v as string[]).join(", ");
    case "hours":
      return `${v} h`;
  }
}

/** Raw text placed in the inline editor. */
export function editText(v: unknown): string {
  return Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
}

/** Parse an edit. `undefined` = invalid / no change; `null` = clear the clause. */
export function parseEdit(f: ClauseField, raw: string): unknown {
  const s = raw.trim();
  if (f.kind === "list") return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (!s) return f.key === "budget_total" || f.key === "max_items" || f.key === "expires_in_hours" ? undefined : null;
  if (f.kind === "date") return s;
  const n = Number(s.replace(/[$,★+h\s]/gi, ""));
  return Number.isFinite(n) ? n : undefined;
}

export type Clause = ClauseField & { value: unknown; set: boolean };

/** All clause fields paired with this policy's values. */
export function clausesOf(policy: Policy): Clause[] {
  return CLAUSE_FIELDS.map((f) => ({ ...f, value: policy[f.key], set: isSet(policy[f.key]) }));
}
