import { describe, expect, it } from "vitest";
import { crossCheck } from "@/lib/policy/crosscheck";
import { PolicySchema } from "@/lib/policy/schema";

const base = PolicySchema.parse({ goal: "x", search_query: "x", budget_total: 600 });

describe("deterministic cross-check of the AI-compiled policy", () => {
  it("restores an exclusion the model dropped", () => {
    const r = crossCheck("Monitor and lamp. Max $600, ask me over $150. Nothing from Amazon.", base);
    expect(r.policy.merchants_block).toContain("amazon");
    expect(r.fixes.some((f) => f.includes("amazon"))).toBe(true);
  });

  it("restores an approval line and lowers an inflated budget", () => {
    const r = crossCheck("Running shoes, max $120, ask me before spending over $40.", { ...base, budget_total: 200 });
    expect(r.policy.budget_total).toBe(120);
    expect(r.policy.approval_threshold).toBe(40);
  });

  it("changes nothing when the model got it right", () => {
    const ok = { ...base, budget_total: 120, approval_threshold: 80, merchants_block: ["amazon"] };
    const r = crossCheck("Shoes, max $120, ask me above $80. Nothing from Amazon.", ok);
    expect(r.fixes).toEqual([]);
  });

  it("never raises the budget", () => {
    const r = crossCheck("Headphones under $150", { ...base, budget_total: 100 });
    expect(r.policy.budget_total).toBe(100);
  });
});
