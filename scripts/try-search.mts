// Run: npx tsx --env-file=.env scripts/try-search.mts "query" [max_price]
import { searchProducts } from "@/lib/channel3/client";

const q = process.argv[2] ?? "marathon running shoes";
const max = process.argv[3] ? Number(process.argv[3]) : undefined;
const t0 = Date.now();
const res = await searchProducts(q, { max_price: max, limit: 6 });
console.table(res.map((p) => ({ title: p.title.slice(0, 45), brand: p.brand, price: p.price, merchant: p.merchant, rating: p.rating, eta: p.delivery_days, cat: p.category?.slice(-25) })));
console.log(`${res.length} results in ${Date.now() - t0}ms`);
process.exit(0);
