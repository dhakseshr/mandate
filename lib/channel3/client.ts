// Channel3 product search (https://docs.trychannel3.com), normalised into our Product type.
// Results are cached in Postgres to stay within the free quota and keep demos deterministic.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Product } from "@/lib/policy/schema";

const API = "https://api.trychannel3.com/v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface SearchFilters {
  max_price?: number;
  min_price?: number;
  limit?: number;
}

export async function searchProducts(query: string, filters: SearchFilters = {}): Promise<Product[]> {
  const limit = Math.min(filters.limit ?? 6, 10);
  const key = createHash("sha1").update(JSON.stringify({ query: query.toLowerCase().trim(), filters, limit })).digest("hex");

  const [hit] = await db.select().from(schema.searchCache).where(eq(schema.searchCache.key, key));
  if (hit && Date.now() - hit.createdAt.getTime() < CACHE_TTL_MS) return hit.results;

  const apiKey = env.channel3Key()?.trim();
  if (!apiKey) throw new Error("CHANNEL3_API_KEY is not set");

  const body: Record<string, unknown> = { query, limit, config: { mode: "agentic" } };
  if (filters.max_price != null || filters.min_price != null)
    body.filters = { price: { ...(filters.min_price != null && { min_price: filters.min_price }), ...(filters.max_price != null && { max_price: filters.max_price }) } };

  const r = await fetch(`${API}/search`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`Channel3 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = (await r.json()) as { products: C3Product[] };

  const products = json.products.flatMap(normalise).slice(0, limit);
  await db
    .insert(schema.searchCache)
    .values({ key, results: products })
    .onConflictDoUpdate({ target: schema.searchCache.key, set: { results: products, createdAt: new Date() } });
  return products;
}

// ---- Channel3 response shape (fields we use) ----
interface C3Product {
  id: string;
  title: string;
  description?: string;
  brands?: { id: string; name: string }[];
  images?: { url: string; is_main_image?: boolean }[];
  category?: { slug: string; title: string; path?: { title: string }[] } | null;
  key_features?: string[];
  offers?: {
    url: string;
    domain: string;
    price: { price: number; compare_at_price: number | null; currency: string };
    availability?: string;
  }[];
  ratings?: { average?: number; rating?: number; value?: number } | null;
}

function normalise(p: C3Product): Product[] {
  const offer = [...(p.offers ?? [])]
    .filter((o) => o.price?.price != null)
    .sort((a, b) => a.price.price - b.price.price)[0];
  if (!offer) return [];
  const rating = p.ratings?.average ?? p.ratings?.rating ?? p.ratings?.value ?? null;
  const categoryPath = [...(p.category?.path?.map((c) => c.title) ?? []), p.category?.title].filter(Boolean);
  return [
    {
      id: p.id,
      title: p.title,
      brand: p.brands?.[0]?.name ?? null,
      price: offer.price.price,
      currency: offer.price.currency ?? "USD",
      merchant: offer.domain,
      category: categoryPath.length ? categoryPath.join(" > ").toLowerCase() : null,
      rating: typeof rating === "number" ? rating : null,
      delivery_days: estimateDeliveryDays(offer.domain),
      url: offer.url,
      image: (p.images?.find((i) => i.is_main_image) ?? p.images?.[0])?.url ?? null,
      in_stock: !offer.availability || /instock|limited|preorder/i.test(offer.availability),
    },
  ];
}

/**
 * Channel3 does not return shipping estimates, and fulfilment in this sandbox demo is simulated.
 * We use a deterministic per-merchant estimate (2–6 days) so delivery-deadline rules are testable.
 * Shown in the UI as "est.".
 */
export function estimateDeliveryDays(domain: string): number {
  const h = createHash("md5").update(domain).digest()[0];
  return 2 + (h % 5);
}
