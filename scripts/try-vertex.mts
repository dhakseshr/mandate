// Smoke test for the Vertex AI provider: tool calling, structured output, the real mandate compiler.
// Run: GOOGLE_VERTEX_PROJECT=<project> AI_PROVIDER=vertex npx tsx --env-file=.env scripts/try-vertex.mts
import { generateText, Output, tool, stepCountIs } from "ai";
import { z } from "zod";
import { model, modelLabel } from "@/lib/ai/provider";
import { compileMandate } from "@/lib/policy/compiler";

console.log("model:", modelLabel());
let t = Date.now();
const r = await generateText({
  model: model(),
  stopWhen: stepCountIs(4),
  tools: { price: tool({ description: "Get the price of an item", inputSchema: z.object({ item: z.string() }), execute: async ({ item }) => ({ item, price: 42 }) }) },
  prompt: "What does a webcam cost? Use the tool, then answer in one sentence.",
});
console.log("tool loop:", r.steps.length, "steps —", r.text.slice(0, 100), `(${Date.now() - t} ms)`);
t = Date.now();
const p = await compileMandate("Onboarding kit for the design team, $1,500, ask me above $200, nothing from Amazon");
console.log("compiled:", JSON.stringify({ budget: p.budget_total, approval: p.approval_threshold, blocked: p.merchants_block, q: p.search_query }), `(${Date.now() - t} ms)`);
process.exit(0);
