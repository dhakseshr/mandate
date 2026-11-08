// Evaluate a proposal against every level of a delegation chain [self, parent, …, root].
// DENY anywhere wins; then ESCALATE; then ALLOW. Pure.
import { evaluate } from "./engine";
import type { Evaluation, Product } from "./schema";
import { ledgerStateOf, type Mandate } from "@/lib/ledger";

const levelName = (m: Mandate, i: number) => (i === 0 ? m.name ?? "this mandate" : m.name ?? (m.parentId ? "parent mandate" : "root mandate"));

export function evaluateChain(chain: Mandate[], product: Product, quantity: number) {
  const levels = chain.map((m, i) => ({ mandate: m, name: levelName(m, i), ev: evaluate(m.policy, ledgerStateOf(m), { product, quantity }) }));
  const decisive = levels.find((l) => l.ev.verdict === "DENY") ?? levels.find((l) => l.ev.verdict === "ESCALATE") ?? levels[0];
  const ev: Evaluation = {
    ...levels[0].ev,
    verdict: decisive.ev.verdict,
    rule: decisive.ev.rule,
    message: decisive === levels[0] ? decisive.ev.message : `${decisive.name}: ${decisive.ev.message}`,
  };
  return { ev, levels, decidedBy: decisive.mandate.id };
}
