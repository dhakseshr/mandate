// Natural language mandate -> structured, enforceable Policy.
import { generateText, Output } from "ai";
import { model } from "@/lib/ai/provider";
import { PolicySchema, type Policy } from "./schema";
import { crossCheck } from "./crosscheck";

const SYSTEM = `You compile a person's shopping instruction ("mandate") into a strict spending policy
for an AI purchasing agent. The policy will be enforced by code and backed by a PayPal payment
authorization, so be precise and conservative:

- budget_total: the hard maximum total spend in USD. If the user gives no budget, pick a sensible
  modest cap for the item and add an ambiguity asking them to confirm it.
- approval_threshold: only if the user asks to be consulted above an amount ("ask me above $80").
- max_per_item / max_items: infer from wording ("a pair" = 1 item). Default max_items = 1.
- categories_allow: 1-3 short lowercase category words that cover the request (e.g. ["shoes"]).
- deliver_by: resolve relative dates ("by Saturday") against TODAY into YYYY-MM-DD, else null.
- min_rating: only if the user implies quality ("well rated" = 4).
- merchants_block / brands_block: only if the user excludes them.
- must_have: soft preferences that aren't hard rules.
- search_query: a concise product search query.
- ambiguities: real questions that would change what gets bought. Keep it to 0-2.
Never invent restrictions the user did not imply.`;

export async function compileMandate(text: string, today = new Date()): Promise<Policy> {
  const { output: object } = await generateText({
    model: model(),
    output: Output.object({ schema: PolicySchema }),
    system: SYSTEM,
    prompt: `TODAY is ${today.toDateString()} (${today.toISOString().slice(0, 10)}).\n\nMandate:\n"""${text}"""`,
    temperature: 0,
    maxRetries: 1, // resilient model wrapper handles capacity retries + failover
  });
  const compiled = PolicySchema.parse(object);
  if (!compiled.goal.trim()) compiled.goal = text.trim().slice(0, 200);
  // The model interprets; deterministic code double-checks it against your literal words.
  const { policy, fixes } = crossCheck(text, compiled);
  return PolicySchema.parse({ ...policy, cross_check_fixes: fixes });
}
