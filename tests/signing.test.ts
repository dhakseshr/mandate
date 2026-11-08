import { describe, expect, it } from "vitest";
import { canonical, signMandate, verifyMandate } from "@/lib/signing";

describe("canonical signing", () => {
  it("is key-order independent", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(canonical({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }));
  });

  it("a document signed in memory still verifies after a JSON round-trip (incl. Dates)", () => {
    const doc = { id: "x", valid_until: new Date("2026-11-12T10:00:00Z"), nested: { at: new Date(0) }, n: null };
    const s = signMandate(doc);
    const transported = JSON.parse(JSON.stringify(doc));
    expect(verifyMandate(transported, s.signature, s.publicKey).valid).toBe(true);
  });

  it("detects tampering", () => {
    const doc = { amount: "120.00", to: "shop.example" };
    const s = signMandate(doc);
    expect(verifyMandate({ ...doc, amount: "999.00" }, s.signature, s.publicKey).valid).toBe(false);
  });
});
