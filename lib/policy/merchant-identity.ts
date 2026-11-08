// Know Your Merchant: deterministic detection of look-alike / impersonating merchant domains.
// Catches typosquats of merchants the human blocked ("amaz0n.com", "arnazon-deals.shop") and
// impersonation of major retailers and payment brands ("paypa1.com", "bestbuy-outlet.shop",
// "apple.com.deals.example"). Pure, no network, no AI.

/** Brands commonly impersonated in shopping / payment scams. */
export const PROTECTED_BRANDS = ["amazon", "walmart", "bestbuy", "target", "apple", "paypal", "ebay", "costco", "newegg", "nike", "adidas", "samsung", "microsoft", "google"];

/** The real registrable domains for protected brands (exact or subdomain of these is legitimate). */
const OFFICIAL: Record<string, string[]> = {
  amazon: ["amazon.com", "amazon.co.uk", "amazon.in", "amazon.de", "amazon.ca"],
  walmart: ["walmart.com"],
  bestbuy: ["bestbuy.com", "bestbuy.ca"],
  target: ["target.com"],
  apple: ["apple.com"],
  paypal: ["paypal.com"],
  ebay: ["ebay.com", "ebay.co.uk"],
  costco: ["costco.com"],
  newegg: ["newegg.com"],
  nike: ["nike.com"],
  adidas: ["adidas.com"],
  samsung: ["samsung.com"],
  microsoft: ["microsoft.com"],
  google: ["google.com", "store.google.com"],
};

const HOMOGLYPHS: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "|": "l" };

/** Normalise a label for comparison: lowercase, homoglyphs, "rn"→"m", "vv"→"w", strip separators. */
export function skeleton(s: string) {
  let x = s.toLowerCase().replace(/[0-9@$|]/g, (c) => HOMOGLYPHS[c] ?? c);
  x = x.replace(/rn/g, "m").replace(/vv/g, "w").replace(/[^a-z]/g, "");
  return x;
}

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const host = (m: string) => m.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
// Brands own their country/generic TLDs: "adidas.ca", "apple.co.uk", "nike.de" are the brand itself.
const TLDISH = /^(?:com|net|org|co|us|ca|uk|de|fr|in|au|jp|it|es|nl|se|ch|ie|nz|sg|mx|br)$/;
const isBrandTld = (h: string, brand: string) => {
  const [first, ...rest] = h.split(".");
  return first === brand && rest.length >= 1 && rest.length <= 2 && rest.every((r) => TLDISH.test(r));
};
const isOfficial = (h: string, brand: string) =>
  isBrandTld(h, brand) || (OFFICIAL[brand] ?? []).some((d) => h === d || h.endsWith("." + d));

/**
 * Returns a reason string if `merchant` looks like an impersonation of `brand` (a blocked merchant
 * or a protected retailer) without being that brand's real domain; otherwise null.
 */
export function impersonates(merchant: string, brand: string): string | null {
  const h = host(merchant);
  const b = skeleton(brand.replace(/\.(com|net|co|shop|store|in|uk)$/, ""));
  if (!h || b.length < 3) return null;
  if (isOfficial(h, b)) return null;
  const labels = h.split(".");
  for (const label of labels) {
    const s = skeleton(label);
    if (!s) continue;
    if (s === b) return `“${h}” uses the name “${brand}” but isn't its official domain`;
    if (s.length >= 4 && editDistance(s, b) <= (b.length >= 7 ? 2 : 1)) return `“${h}” is a look-alike of “${brand}”`;
    // brand glued to bait words: "bestbuy-outlet", "amazondeals"
    if (s.startsWith(b) && s.length > b.length && /^(deals?|outlet|store|shop|sale|official|support|clearance|discount|direct)/.test(s.slice(b.length)))
      return `“${h}” impersonates “${brand}” (“${label}”)`;
  }
  return null;
}

/** Merchant-identity verdict for one listing against the policy's blocks + protected brands. */
export function merchantIdentity(merchant: string, blocked: string[]): { verdict: "DENY" | "ALLOW"; message: string } {
  for (const b of blocked) {
    const r = impersonates(merchant, b);
    if (r) return { verdict: "DENY", message: `Look-alike of a blocked merchant: ${r}` };
  }
  for (const b of PROTECTED_BRANDS) {
    const r = impersonates(merchant, b);
    if (r) return { verdict: "DENY", message: `Possible impersonation: ${r}` };
  }
  return { verdict: "ALLOW", message: "Merchant not blocked; no impersonation detected" };
}
