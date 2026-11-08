import Link from "next/link";
import { ArrowRight, Bot, KeyRound, Lock, PenLine, Plug, ScrollText, ShieldAlert, ShieldX, UserCheck } from "lucide-react";

export const metadata = { title: "Guided demo · Mandate" };

const BEATS = [
  { icon: PenLine, title: "Write the mandate", body: "Plain English compiles into a policy you can read and edit — budget, approval threshold, blocked merchants." },
  { icon: Lock, title: "Approve the hold with PayPal", body: "One PayPal approval places an AUTHORIZE hold for the budget. Nothing is charged yet." },
  { icon: Bot, title: "Agent shops", body: "The agent searches real catalogs and proposes purchases. Each one runs through 13 deterministic rules." },
  { icon: UserCheck, title: "Your approval", body: "Anything over your threshold escalates to a card you approve or reject — with a reason the agent learns from." },
  { icon: ShieldX, title: "Attack blocked", body: "A hostile listing tries to hijack the agent. The policy engine doesn't read prompts — it denies, and the money never moves." },
  { icon: ScrollText, title: "Released & audited", body: "The unspent hold is voided back to you, and every decision lands in the append-only ledger." },
];

const SCENARIOS = [
  {
    tone: "escalate",
    icon: ShieldAlert,
    tag: "ESCALATE",
    title: "Marathon shoes, $120, ask me above $40",
    body: "Every good shoe costs more than $40, so the agent has to ask you. Reject one with a reason and watch it adapt.",
    prompt: "Running shoes for my marathon, max $120, ask me before spending over $40.",
    beats: "Beats 1–4, 6",
  },
  {
    tone: "allow",
    icon: UserCheck,
    tag: "ALLOW + ESCALATE",
    title: "Headphones under $150, well rated, ask me above $100",
    body: "A rating floor and a higher threshold — cheaper picks go straight through, premium ones come to you.",
    prompt: "Noise-cancelling headphones under $150 for studying, well rated, ask me above $100.",
    beats: "Beats 1–4, 6",
  },
  {
    tone: "deny",
    icon: ShieldX,
    tag: "DENY",
    title: "Red team: a scam listing tries to hijack the agent",
    body: "An injected product tells the agent to ignore its rules. The deterministic engine blocks it — funds stay held.",
    prompt: "Running shoes for my marathon, max $120, ask me above $80. [red-team]",
    beats: "All 6 beats",
  },
] as const;

const TONE = {
  allow: { ring: "hover:border-allow", tag: "bg-allow-soft text-allow", icon: "bg-allow-soft text-allow" },
  escalate: { ring: "hover:border-escalate", tag: "bg-escalate-soft text-escalate", icon: "bg-escalate-soft text-escalate" },
  deny: { ring: "hover:border-deny", tag: "bg-deny-soft text-deny", icon: "bg-deny-soft text-deny" },
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-faint">Guided demo · about 2 minutes</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Watch an AI agent shop on a leash.</h1>
        <p className="mt-2 text-muted">Pick a scenario. It prefills the mandate — you still review it and click create. Everything runs on the PayPal sandbox.</p>
      </header>

      <section aria-labelledby="beats">
        <h2 id="beats" className="sr-only">The six beats</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BEATS.map((b, i) => (
            <li key={b.title} className="relative rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
                <p className="flex items-center gap-1.5 font-medium"><b.icon size={15} className={i === 4 ? "text-deny" : "text-accent"} />{b.title}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{b.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="scenarios">
        <h2 id="scenarios" className="mb-3 text-xl font-semibold tracking-tight">Choose a scenario</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((s) => {
            const t = TONE[s.tone];
            return (
              <Link
                key={s.title}
                href={`/?prompt=${encodeURIComponent(s.prompt)}#compose`}
                className={`group flex flex-col rounded-2xl border border-line bg-surface p-5 transition ${t.ring}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.icon}`}><s.icon size={18} /></span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${t.tag}`}>{s.tag}</span>
                </div>
                <p className="mt-3 font-semibold leading-snug">{s.title}</p>
                <p className="mt-1.5 flex-1 text-sm text-muted">{s.body}</p>
                <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">“{s.prompt}”</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-xs text-faint">{s.beats}</span>
                  <span className="flex items-center gap-1 font-semibold text-accent">Prefill <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="mcp" aria-labelledby="mcp-h" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white"><Plug size={18} /></span>
          <div>
            <h2 id="mcp-h" className="font-semibold">Bring your own agent (MCP)</h2>
            <p className="text-sm text-muted">Any AI agent can shop under your mandate — it gets the same rules and the same PayPal hold, nothing more.</p>
          </div>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Write a mandate", "Create it on the home page, as in any scenario above."],
            ["Choose “Connect my own AI agent”", "Pick it next to the PayPal button, then approve the hold."],
            ["Paste the URL into your client", "Claude Code, Claude Desktop or any MCP client. Its purchases hit the same policy engine."],
          ].map(([t, b], i) => (
            <li key={t} className="rounded-xl bg-surface-2/60 p-3">
              <p className="text-sm font-medium"><span className="num mr-1.5 text-accent">{i + 1}</span>{t}</p>
              <p className="mt-1 text-xs text-muted">{b}</p>
            </li>
          ))}
        </ol>
        <p className="num mt-3 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-muted">claude mcp add --transport http mandate &quot;https://…/api/mcp?token=mdt_…&quot;</p>
      </section>

      <aside className="flex gap-3 rounded-2xl border border-paypal/30 bg-surface p-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paypal/10 text-paypal"><KeyRound size={18} /></span>
        <div className="min-w-0">
          <p className="font-semibold">Sandbox buyer for beat 2</p>
          <p className="mt-1 text-sm text-muted">
            Log in to PayPal with sandbox buyer{" "}
            <span className="num break-all rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-ink">sb-u4310o53776285@personal.example.com</span>{" "}
            (password in README). No real money moves.
          </p>
        </div>
      </aside>
    </div>
  );
}
