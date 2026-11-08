import Link from "next/link";

const AUDIENCE = [
  {
    who: "Procurement teams",
    rank: "Primary",
    line: "Give an AI procurement agent a $1,500 budget, an approval line and a blocklist. It delegates to narrower sub-agents; finance reads every cent in the ledger.",
  },
  {
    who: "People & families",
    rank: "Secondary",
    line: "An assistant buys the shoes, the headphones, the school supplies — up to the amount you signed, and asks you above your line.",
  },
  {
    who: "Agent developers",
    rank: "Tertiary",
    line: "Point any MCP client at a mandate-scoped token. Your agent proposes; the same rules and the same PayPal hold decide.",
  },
];

/** Who it's for: three ruled statement rows. No cards, no icons. */
export function Audience() {
  return (
    <div className="min-w-0" role="table" aria-label="Who Writ is for">
      <div role="rowgroup" className="border-t border-ink">
        {AUDIENCE.map((a) => (
          <div
            role="row"
            key={a.who}
            className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-b border-line py-4 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-baseline"
          >
            <span role="rowheader" className="min-w-0">
              <span className="display block text-[1.35rem] leading-tight text-ink">{a.who}</span>
              <span className="label mt-1.5 block text-[10px]">{a.rank}</span>
            </span>
            <span role="cell" className="min-w-0 text-[15px] leading-relaxed text-muted">
              {a.line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DIFF: { what: string; how: string; proof: string; href?: string; blue?: boolean }[] = [
  {
    what: "Runtime, deterministic enforcement",
    how: "Every proposal runs thirteen rules at the moment of purchase. No model sits in the decision path.",
    proof: "13 checks logged per verdict",
  },
  {
    what: "Limits held by a real PayPal authorization",
    how: "The budget is an AUTHORIZE hold, not a number in our database. The agent can only ask to capture from it.",
    proof: "PayPal authorization ID",
    blue: true,
  },
  {
    what: "Capability attenuation across delegation trees",
    how: "A sub-agent's mandate must be narrower than its parent on every rule. A wider request is refused, not trimmed.",
    proof: "ATTENUATION verdicts",
  },
  {
    what: "Merchant-verifiable receipts",
    how: "Each capture carries an Ed25519-signed receipt a merchant checks against the mandate without trusting us.",
    proof: "Verify desk",
    href: "/verify",
  },
  {
    what: "Revocation, with the unspent hold released",
    how: "One kill switch stops every agent under a mandate. PayPal voids what wasn't spent.",
    proof: "VOID on the hold",
    blue: true,
  },
];

const DCOLS = "md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.8fr)]";

/** Differentiators as a ruled schedule, numbered like clauses. */
export function Differentiators() {
  return (
    <div className="min-w-0" role="table" aria-label="What makes the boundary hold">
      <div role="row" className={`hidden border-y border-ink py-2.5 md:grid md:gap-x-6 ${DCOLS}`}>
        {["§", "Clause", "What it means", "Proof"].map((h) => (
          <span role="columnheader" key={h} className="label">
            {h}
          </span>
        ))}
      </div>
      <div role="rowgroup" className="border-t border-ink md:border-t-0">
        {DIFF.map((d, i) => (
          <div role="row" key={d.what} className={`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-line py-4 md:items-baseline md:gap-x-6 ${DCOLS}`}>
            <span role="cell" className="num row-span-3 text-sm text-muted md:row-span-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span role="cell" className="min-w-0 text-[15px] font-medium leading-snug text-ink">
              {d.what}
            </span>
            <span role="cell" className="min-w-0 text-sm leading-relaxed text-muted">
              {d.how}
            </span>
            <span role="cell" className={`num min-w-0 text-[13px] ${d.blue ? "text-paypal" : "text-ink"}`}>
              {d.href ? (
                <Link href={d.href} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                  {d.proof}
                </Link>
              ) : (
                d.proof
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Tested the hard way: a compromised agent gets a real sub-mandate and is told to steal.{" "}
        <Link href="/demo#red-team" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
          See the red-team scorecard →
        </Link>
      </p>
    </div>
  );
}
