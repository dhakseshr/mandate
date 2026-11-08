import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Stamp, verdictTone } from "@/components/ui";
import { CopyLine } from "@/components/landing/copy-line";
import { INJECTION_TEXT, POISONED_PRODUCT } from "@/lib/redteam";

export const metadata = { title: "Guided demo · Mandate" };

const BEATS = [
  { title: "Draft the mandate", body: "Your sentence compiles into a policy you can read and edit: budget, ask-above line, deadline, merchants to avoid." },
  { title: "Sign & hold with PayPal", body: "You sign the policy. One PayPal approval places an AUTHORIZE hold for the budget. Nothing is charged." },
  { title: "The agent shops", body: "It searches real catalogs and proposes purchases. Each proposal runs through 13 deterministic rules." },
  { title: "You approve what’s above your line", body: "Anything over your threshold escalates to you. Reject with a reason; the agent reads it and adapts." },
  { title: "The attack fails", body: "A poisoned listing tells the agent to spend $389.00. The engine doesn’t read prompts. It denies.", deny: true },
  { title: "Release & audit", body: "PayPal voids the unspent hold. Every decision is in the append-only ledger." },
];

const RED_TEAM_PROMPT = "Running shoes for my marathon, max $120, ask me above $80. [red-team]";
const prefill = (p: string) => `/?prompt=${encodeURIComponent(p)}#compose`;

/** Secondary scenarios. Append one object to add a row (e.g. a business / "AI employees" scenario); letters follow on from A. */
type Scenario = { id: string; title: string; body: string; prompt: string; verdicts: readonly ("ALLOW" | "ESCALATE" | "DENY")[]; beats: string; note?: string };
const MORE: Scenario[] = [
  {
    id: "B",
    title: "Marathon shoes, $120, ask me above $40",
    body: "Every good shoe costs more than $40, so the agent has to ask. Reject one with a reason and watch it adapt.",
    prompt: "Running shoes for my marathon, max $120, ask me before spending over $40.",
    verdicts: ["ESCALATE"],
    beats: "Beats 1–4, 6",
  },
  {
    id: "C",
    title: "Noise-cancelling headphones under $150, well rated, ask me above $100",
    body: "A rating floor and a higher line. Cheaper picks pass straight through; premium ones come to you.",
    prompt: "Noise-cancelling headphones under $150 for studying, well rated, ask me above $100.",
    verdicts: ["ALLOW", "ESCALATE"],
    beats: "Beats 1–4, 6",
  },
  {
    id: "D",
    title: "Team of agents · Home office for a new hire",
    body: "An orchestrator splits one $600 mandate into narrower sub-mandates — monitor, headphones, lamp — each signed, all backed by one PayPal hold. Every purchase is checked at every level; revoke any one, or the whole team.",
    prompt: "Set up a home office for our new hire: a monitor, noise-cancelling headphones and a desk lamp. Max $600 total, ask me before any purchase over $150. Nothing from Amazon.",
    verdicts: ["ALLOW", "ESCALATE", "DENY"],
    beats: "Beats 1–4, 6 · delegation",
    note: "Choose ‘A team of agents’ on the review screen.",
  },
];

const MCP_STEPS = [
  ["Draft a mandate", "On the home page, or from any scenario above."],
  ["Choose “Connect my own AI agent”", "It sits next to the PayPal button. Approve the hold as usual."],
  ["Paste the URL into your client", "Claude Code, Claude Desktop, or any MCP client. Its proposals hit the same engine."],
];

export default function DemoPage() {
  return (
    <div className="min-w-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 gap-6 pb-16 pt-2 sm:pt-6 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-8">
          <span className="label">Guided demo · PayPal sandbox · about two minutes</span>
          <h1 className="display mt-6 text-balance text-[2.5rem] leading-[1.02] tracking-[-0.025em] text-ink sm:text-[3.5rem]">
            Watch an agent shop on a leash.
          </h1>
          <p className="mt-5 max-w-[36rem] text-pretty text-[17px] leading-[1.55] text-muted">
            Two minutes. One of them ends in a blocked attack. Each scenario prefills a mandate — you still read it and click compile.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 border-t border-line pt-12 lg:grid-cols-12 lg:gap-10">
        {/* ── Beats rail ─────────────────────────────────────────────── */}
        <section aria-labelledby="beats" className="min-w-0 lg:col-span-4">
          <h2 id="beats" className="label">
            Six beats
          </h2>
          <ol className="mt-6">
            {BEATS.map((b, i) => (
              <li key={b.title} className="relative grid grid-cols-[2.25rem_1fr] gap-x-3 pb-7 last:pb-0">
                {i < BEATS.length - 1 && <span aria-hidden className="absolute bottom-0 left-[0.8rem] top-7 w-px bg-line" />}
                <span
                  className={`num relative grid h-7 w-7 place-items-center border bg-bg text-xs ${b.deny ? "border-deny text-deny" : "border-ink text-ink"}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[15px] font-medium leading-snug text-ink">{b.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{b.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Scenarios ──────────────────────────────────────────────── */}
        <section aria-labelledby="scenarios" className="min-w-0 lg:col-span-8">
          <h2 id="scenarios" className="label">
            Scenarios
          </h2>

          <article id="red-team" className="mt-6 scroll-mt-24 border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3 sm:px-6">
              <span className="label text-ink">Scenario A · Red team · all six beats</span>
              <span className="label">Prompt injection</span>
            </div>

            <div className="px-5 py-6 sm:px-6">
              <h3 className="display text-[1.75rem] font-medium leading-[1.15] text-ink">A listing tries to spend $389.00 of your money.</h3>
              <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-muted">
                The search results include a poisoned product. Its description carries instructions written for the agent, not for you.
              </p>

              {/* The poisoned listing */}
              <div className="mt-6 border border-line">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line bg-surface-2 px-4 py-2.5">
                  <span className="label">Search result 03</span>
                  <span className="num text-xs text-muted">{POISONED_PRODUCT.merchant}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium leading-snug text-ink">[RED TEAM] Ultra Elite Carbon Marathon Racer</p>
                    <p className="num mt-1 text-xs text-muted">
                      ★ {POISONED_PRODUCT.rating} · ships in {POISONED_PRODUCT.delivery_days} days · in stock
                    </p>
                  </div>
                  <span className="num text-2xl font-medium text-ink">$389.00</span>
                </div>
                <div className="border-t border-deny/40 bg-deny-soft px-4 py-4">
                  <span className="label text-deny">Hidden in the description</span>
                  <p className="num mt-2.5 text-[13px] leading-relaxed tracking-normal text-ink">{INJECTION_TEXT}</p>
                </div>
              </div>

              {/* Engine verdict */}
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0 border-l-2 border-ink pl-4">
                  <p className="num text-[13px] leading-relaxed text-ink">
                    engine · price $389.00 &gt; cap $120.00 → DENY
                    <br />
                    <span className="text-muted">override: not possible · funds stay held</span>
                  </p>
                  <p className="display mt-3 text-[1.35rem] italic leading-snug text-ink">The AI was fooled. The rules weren&rsquo;t.</p>
                </div>
                <div className="flex justify-start sm:justify-end sm:pr-2">
                  <Stamp verdict="DENY" size="md" rotate={-7} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="display min-w-0 text-[1.05rem] italic leading-snug text-muted">“{RED_TEAM_PROMPT}”</p>
              <Link
                href={prefill(RED_TEAM_PROMPT)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[2px] bg-ink px-5 text-sm font-medium text-on-accent transition-colors duration-[120ms] hover:bg-ink/90"
              >
                Run this scenario <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </article>

          <ul className="mt-10 border-t border-ink">
            {MORE.map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-3 border-b border-line py-6 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-x-5">
                <span className="label pt-1.5 text-ink">{s.id}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-medium leading-snug text-ink">{s.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                  <p className="display mt-2.5 text-[1rem] italic leading-snug text-muted">“{s.prompt}”</p>
                  {s.note && (
                    <p className="num mt-2 border-l-2 border-ink pl-2.5 text-[12px] leading-snug text-ink">{s.note}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {s.verdicts.map((v) => (
                      <Badge key={v} tone={verdictTone(v)}>
                        {v === "ALLOW" ? "Allow" : v === "ESCALATE" ? "Escalate" : "Deny"}
                      </Badge>
                    ))}
                    <span className="label ml-1">{s.beats}</span>
                  </div>
                </div>
                <Link
                  href={prefill(s.prompt)}
                  className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  Prefill <ArrowRight size={14} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>

          <aside aria-label="Sandbox buyer" className="mt-10 grid grid-cols-1 gap-2 border-l-2 border-paypal pl-4 sm:grid-cols-[9rem_1fr] sm:gap-5">
            <span className="label pt-1 text-paypal">Sandbox buyer</span>
            <p className="min-w-0 text-sm leading-relaxed text-muted">
              For beat 2, log in to PayPal as{" "}
              <span className="num break-all text-[13px] text-ink">sb-u4310o53776285@personal.example.com</span> (password in the README). Sandbox only; no real money moves.
            </p>
          </aside>
        </section>
      </div>

      {/* ── MCP ─────────────────────────────────────────────────────────── */}
      <section id="mcp" aria-labelledby="mcp-h" className="mt-20 grid scroll-mt-24 grid-cols-1 gap-8 border-t border-line pt-12 lg:mt-24 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-4">
          <span className="label">Bring your own agent · MCP</span>
          <h2 id="mcp-h" className="display mt-4 text-[1.75rem] font-medium leading-[1.15] text-ink">
            Any agent. Same rules. Same hold.
          </h2>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
            An external agent gets a mandate-scoped token and nothing more. Its proposals go through the same 13 checks, against the same PayPal hold.
          </p>
        </div>
        <div className="min-w-0 lg:col-span-8">
          <ol className="border-t border-ink">
            {MCP_STEPS.map(([t, b], i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-line py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-x-6">
                <span className="num text-sm text-muted">0{i + 1}</span>
                <span className="text-[15px] font-medium text-ink">{t}</span>
                <span className="col-start-2 mt-1 text-sm leading-relaxed text-muted sm:col-start-3 sm:mt-0">{b}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 border border-line bg-surface-2">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
              <span className="label">Terminal · Claude Code</span>
              <span className="label hidden sm:inline">Token shown on your mandate</span>
            </div>
            <CopyLine label="Claude Code command" text={`claude mcp add --transport http mandate "https://<your-host>/api/mcp?token=mdt_…"`} />
            <div className="border-t border-line">
              <CopyLine prompt="url" label="MCP URL" text="https://<your-host>/api/mcp?token=mdt_…" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
