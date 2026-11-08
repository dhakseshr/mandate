import { describe, expect, it } from "vitest";
import { attenuate, inherit } from "@/lib/policy/attenuate";
import { PolicySchema } from "@/lib/policy/schema";

const parent = PolicySchema.parse({
  goal: "Set up a home office for a new hire",
  search_query: "home office",
  budget_total: 1500,
  approval_threshold: 300,
  max_items: 4,
  merchants_block: ["amazon"],
  min_rating: 4,
  deliver_by: "2026-11-20",
  categories_allow: ["electronics", "furniture"],
});

describe("delegation attenuation", () => {
  it("accepts a child that only narrows the parent", () => {
    const child = inherit(parent, { goal: "A 27-inch monitor", budget_total: 400, max_items: 1, categories_allow: ["electronics"] });
    const r = attenuate(parent, child, 1500, 4);
    expect(r.ok).toBe(true);
  });

  it("inherit() always keeps the parent's blocks and approval line", () => {
    const child = inherit(parent, { budget_total: 200, approval_threshold: 900, merchants_block: ["sketchy.example"] });
    expect(child.merchants_block).toEqual(["amazon", "sketchy.example"]);
    expect(child.approval_threshold).toBe(300);
  });

  it("rejects a child asking for more money than the parent has left", () => {
    const child = inherit(parent, { budget_total: 900 });
    const r = attenuate(parent, child, 600, 4);
    expect(r.ok).toBe(false);
    expect(r.violations[0].field).toBe("budget");
  });

  it("rejects widening the approval line, dropping a block, or loosening the rating", () => {
    const child = { ...inherit(parent, { budget_total: 100 }), approval_threshold: 1000, merchants_block: [], min_rating: 3 };
    const fields = attenuate(parent, child, 1500, 4).violations.map((v) => v.field);
    expect(fields).toEqual(expect.arrayContaining(["approval_threshold", "merchants_block", "min_rating"]));
  });

  it("rejects a later deadline, longer expiry, too many items, or an out-of-scope category", () => {
    const child = { ...inherit(parent, { budget_total: 100 }), deliver_by: "2026-12-30", expires_in_hours: 999, max_items: 9, categories_allow: ["jewelry"] };
    const fields = attenuate(parent, child, 1500, 4).violations.map((v) => v.field);
    expect(fields).toEqual(expect.arrayContaining(["deliver_by", "expires_in_hours", "max_items", "categories_allow"]));
  });

  it("a child of a child can only narrow further (transitive)", () => {
    const child = inherit(parent, { budget_total: 500, approval_threshold: 200 });
    const grandchild = inherit(child, { budget_total: 300 });
    expect(attenuate(child, grandchild, 500, 4).ok).toBe(true);
    expect(attenuate(child, { ...grandchild, approval_threshold: 250 }, 500, 4).ok).toBe(false);
  });
});
