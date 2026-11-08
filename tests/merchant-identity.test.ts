import { describe, expect, it } from "vitest";
import { impersonates, merchantIdentity } from "@/lib/policy/merchant-identity";

describe("know your merchant", () => {
  it("allows official domains and ordinary merchants", () => {
    expect(merchantIdentity("amazon.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("smile.amazon.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("kickscrew.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("shoebacca.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("6ave.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("staples.com", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("adidas.ca", []).verdict).toBe("ALLOW");
    expect(merchantIdentity("apple.co.uk", []).verdict).toBe("ALLOW");
  });
  it("catches homoglyph and typo look-alikes", () => {
    expect(impersonates("amaz0n.com", "amazon")).not.toBeNull();
    expect(impersonates("arnazon.com", "amazon")).not.toBeNull();
    expect(impersonates("paypa1.com", "paypal")).not.toBeNull();
    expect(impersonates("bestbuy-outlet.shop", "bestbuy")).not.toBeNull();
    expect(impersonates("amazon.com.deals.example", "amazon")).not.toBeNull();
  });
  it("blocks look-alikes of merchants the human blocked", () => {
    const r = merchantIdentity("temu-dea1s.shop", ["temu"]);
    expect(r.verdict).toBe("DENY");
  });
});
