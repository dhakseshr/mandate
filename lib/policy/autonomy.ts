// Autonomy profiles: one-click presets for how often the agent must ask you.
// A profile adjusts the approval line and per-item cap relative to the budget, but it can NEVER
// loosen a limit the human stated in their own words (those are re-read deterministically).
import { crossCheck } from "./crosscheck";
import { PolicySchema, type Policy } from "./schema";

export type Autonomy = "careful" | "balanced" | "autopilot";

export const AUTONOMY: Record<Autonomy, { label: string; blurb: string }> = {
  careful: { label: "Careful", blurb: "Ask me above 10% of the budget; no single item over 30%." },
  balanced: { label: "Balanced", blurb: "Ask me above 25% of the budget." },
  autopilot: { label: "Autopilot", blurb: "Only my own stated limits apply. Budget and blocks are always enforced." },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the human explicitly wrote, recovered by the deterministic cross-check (not the model). */
export function explicitLimits(text: string, budget: number) {
  const blank = PolicySchema.parse({ goal: "", search_query: "", budget_total: Math.max(budget, 1e9) });
  const { policy } = crossCheck(text, blank);
  return { approval: policy.approval_threshold, perItem: policy.max_per_item };
}

const minDefined = (...xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};

export function applyAutonomy(policy: Policy, rawText: string, profile: Autonomy): Policy {
  const B = policy.budget_total;
  const ex = explicitLimits(rawText, B);
  let approval: number | null;
  let perItem: number | null;
  if (profile === "careful") {
    approval = minDefined(ex.approval, r2(B * 0.1));
    perItem = minDefined(ex.perItem, r2(B * 0.3));
  } else if (profile === "balanced") {
    approval = minDefined(ex.approval, r2(B * 0.25));
    perItem = ex.perItem;
  } else {
    approval = ex.approval;
    perItem = ex.perItem;
  }
  return PolicySchema.parse({ ...policy, approval_threshold: approval, max_per_item: perItem, autonomy: profile });
}
