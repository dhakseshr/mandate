import { describe, expect, it } from "vitest";
import { applyAutonomy } from "@/lib/policy/autonomy";
import { PolicySchema } from "@/lib/policy/schema";

const p = PolicySchema.parse({ goal: "x", search_query: "x", budget_total: 1000, approval_threshold: 400 });

describe("autonomy profiles", () => {
  it("careful tightens relative to the budget", () => {
    const c = applyAutonomy(p, "Office kit, $1,000 total.", "careful");
    expect(c.approval_threshold).toBe(100);
    expect(c.max_per_item).toBe(300);
  });
  it("never loosens what the human explicitly wrote", () => {
    const a = applyAutonomy(p, "Office kit, $1,000 total, ask me above $40.", "autopilot");
    expect(a.approval_threshold).toBe(40);
    const b = applyAutonomy(p, "Office kit, $1,000 total, ask me above $40.", "balanced");
    expect(b.approval_threshold).toBe(40);
  });
  it("autopilot with no stated line removes only the preset, not budget or blocks", () => {
    const a = applyAutonomy({ ...p, merchants_block: ["amazon"] }, "Office kit, $1,000 total.", "autopilot");
    expect(a.approval_threshold).toBeNull();
    expect(a.budget_total).toBe(1000);
    expect(a.merchants_block).toEqual(["amazon"]);
  });
});
