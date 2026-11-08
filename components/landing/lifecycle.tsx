const ROWS = [
  { n: "01", step: "Sign", what: "Your sentence compiles to a policy you read, edit and sign.", who: "You", money: "Nothing held yet", blue: false, proof: "Ed25519 seal over the policy" },
  { n: "02", step: "Hold", what: "One PayPal approval reserves the budget. Nothing is charged.", who: "PayPal", money: "AUTHORIZE $120.00 held", blue: true, proof: "PayPal authorization ID" },
  { n: "03", step: "Shop", what: "Writ’s agent, or yours over MCP, searches real catalogs and proposes.", who: "The agent", money: "$120.00 still held", blue: true, proof: "Every proposal logged" },
  { n: "04", step: "Decide", what: "Thirteen deterministic checks. Above your line, you decide.", who: "The engine; you above $80", money: "CAPTURE partial $47.95", blue: true, proof: "13 rule checks logged" },
  { n: "05", step: "Release", what: "The unspent hold returns. The mandate closes.", who: "PayPal", money: "VOID remainder $72.05", blue: true, proof: "Append-only ledger entry" },
];

const COLS = "md:grid-cols-[4.5rem_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)]";

/** The lifecycle as a bank statement: one hold, five entries. */
export function Lifecycle() {
  return (
    <div className="min-w-0" role="table" aria-label="Writ lifecycle">
      <div role="row" className={`hidden border-y border-ink py-2.5 md:grid md:gap-x-6 ${COLS}`}>
        {["Step", "Entry", "Who acts", "Money state", "Proof"].map((h) => (
          <span role="columnheader" key={h} className="label">
            {h}
          </span>
        ))}
      </div>
      <div role="rowgroup" className="border-t border-ink md:border-t-0">
        {ROWS.map((r) => (
          <div role="row" key={r.n} className={`grid grid-cols-[3rem_1fr] gap-x-4 gap-y-2 border-b border-line py-4 md:items-baseline md:gap-x-6 ${COLS}`}>
            <span role="cell" className="num row-span-4 text-sm text-muted md:row-span-1">
              {r.n}
            </span>
            <span role="cell" className="min-w-0">
              <span className="display block text-[1.35rem] leading-tight text-ink">{r.step}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{r.what}</span>
            </span>
            <span role="cell" className="min-w-0 text-sm text-ink">
              <span className="label mr-2 md:hidden">Who</span>
              {r.who}
            </span>
            <span role="cell" className={`num min-w-0 text-sm ${r.blue ? "text-paypal" : "text-muted"}`}>
              <span className="label mr-2 text-muted md:hidden">Money</span>
              {r.money}
            </span>
            <span role="cell" className="min-w-0 text-sm text-ink">
              <span className="label mr-2 md:hidden">Proof</span>
              {r.proof}
            </span>
          </div>
        ))}
      </div>
      {/* Totals under a double rule */}
      <div className="rule-double grid grid-cols-3 gap-4 py-3 md:flex md:justify-end md:gap-12">
        {[
          ["Held", "$120.00"],
          ["Captured", "$47.95"],
          ["Voided", "$72.05"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <span className="label">{k}</span>
            <p className="num mt-1.5 text-base font-medium text-paypal-navy">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
