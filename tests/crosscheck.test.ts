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

  it("restores a per-call cap and a lowercase domain exclusion", () => {
    const r = crossCheck("Research GPU providers. Max $5 total, at most $0.20 per call, never use insight-wire.example.", base);
    expect(r.policy.max_per_item).toBe(0.2);
    expect(r.policy.merchants_block).toContain("insight-wire.example");
  });

  it("keeps the user's own scope phrase as an allowed category", () => {
    const r = crossCheck("Research cloud GPU demand. Max $5 total, research data only.", { ...base, categories_allow: ["market research", "industry data"] });
    expect(r.policy.categories_allow).toContain("research data");
    const none = crossCheck("Shoes, only well rated ones, max $120.", { ...base, categories_allow: ["shoes"] });
    expect(none.policy.categories_allow).toEqual(["shoes"]);
  });
});
