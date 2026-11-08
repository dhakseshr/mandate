// Run: npx tsx --env-file=.env scripts/try-compiler.mts "your mandate"
import { compileMandate } from "@/lib/policy/compiler";

const text =
  process.argv[2] ??
  "Get me running shoes for my marathon, max $120, must arrive by Saturday, only well rated ones, ask me before spending more than $80. Nothing from Amazon.";
const t0 = Date.now();
const policy = await compileMandate(text);
console.log(JSON.stringify(policy, null, 2));
console.log(`compiled in ${Date.now() - t0}ms`);
