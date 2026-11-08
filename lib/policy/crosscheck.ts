// Deterministic cross-check of an AI-compiled policy against the human's literal words.
// The model interprets; this catches the cases where it silently drops an explicit instruction
// (a dollar cap, an approval line, an exclusion). Every fix is recorded and shown to the human.
import type { Policy } from "./schema";

const money = (s: string) => Number(s.replace(/[,$\s]/g, ""));
const AMOUNT = String.raw`\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)`;

export function crossCheck(text: string, policy: Policy): { policy: Policy; fixes: string[] } {
  const p: Policy = { ...policy, merchants_block: [...policy.merchants_block], brands_block: [...policy.brands_block] };
  const fixes: string[] = [];
  const t = text.replace(/\s+/g, " ");

  // Approval line: "ask me before spending over $40", "ask me above $80", "check with me over $150"
  const ask = new RegExp(String.raw`(?:ask|check with|confirm with|ping)\s+me[^$.]{0,40}?(?:above|over|more than|beyond|exceeding)?\s*${AMOUNT}`, "i").exec(t);
  if (ask) {
    const v = money(ask[1]);
    if (p.approval_threshold !== v) {
      fixes.push(`Approval line set to $${v.toFixed(2)} — you wrote “${ask[0].trim()}”`);
      p.approval_threshold = v;
    }
  }

  // Hard cap: "max $120", "under $150", "up to $600", "no more than $50", "budget of $500"
  const cap = new RegExp(String.raw`(?:max(?:imum)?|under|up to|no more than|at most|budget(?: of| is)?|cap(?: of)?|within)\s*(?:of\s*)?${AMOUNT}`, "i").exec(t);
  if (cap) {
    const v = money(cap[1]);
    if (v > 0 && p.budget_total > v + 1e-9) {
      fixes.push(`Budget lowered to $${v.toFixed(2)} — you wrote “${cap[0].trim()}”`);
      p.budget_total = v;
    }
  }

  // Exclusions: "nothing from Amazon", "no Walmart", "avoid Temu", "not from eBay", "except Shein"
  // Keywords are case-insensitive; the excluded name must be Capitalized (a proper noun) to avoid
  // false positives like "no more than".
  const exclusion = /\b(?:[Nn]othing|[Nn]ot|[Nn]ever|[Aa]void(?:ing)?|[Ee]xclud(?:e|ing)|[Ee]xcept|[Nn]o)\s+(?:from\s+|at\s+|on\s+|via\s+)?([A-Z][A-Za-z0-9&.-]{2,})/g;
  for (const m of t.matchAll(exclusion)) {
    const name = m[1].toLowerCase().replace(/[.&-]+$/, "").replace(/\.(com|net|co|shop|store)$/, "");
    if (["i", "the", "a", "ai", "usd", "pm", "am"].includes(name)) continue;
    const covered = [...p.merchants_block, ...p.brands_block].some((b) => b.toLowerCase().includes(name) || name.includes(b.toLowerCase()));
    if (!covered) {
      p.merchants_block.push(name);
      fixes.push(`Blocked merchant “${name}” — you wrote “${m[0].trim()}”`);
    }
  }

  if (p.approval_threshold != null && p.approval_threshold > p.budget_total) {
    fixes.push(`Approval line can't exceed the budget — capped at $${p.budget_total.toFixed(2)}`);
    p.approval_threshold = p.budget_total;
  }
  return { policy: p, fixes };
}
