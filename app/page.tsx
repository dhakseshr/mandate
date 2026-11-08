import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, Bot, Lock, PenLine, PlayCircle, Plug, ScrollText, ShieldCheck, Undo2 } from "lucide-react";
import { Composer } from "@/components/composer";
import { HeroSequence } from "@/components/hero-sequence";

const STEPS = [
  { icon: PenLine, title: "Write the rule", body: "Plain English becomes a strict policy: budget, when to ask you, deadlines, merchants to avoid." },
  { icon: Lock, title: "PayPal holds the budget", body: "You authorize the cap once. The agent can only capture from that hold — never more." },
  { icon: Bot, title: "The agent shops", body: "It searches real catalogs and explains its picks. Every purchase passes 13 deterministic checks — no AI in the loop." },
  { icon: Undo2, title: "Leftovers come back", body: "When it's done, the unspent hold is voided. Every cent is in an append-only audit ledger." },
];

const TRUST = [
  { icon: Lock, text: "Funds held by PayPal" },
  { icon: ShieldCheck, text: "Rules enforced without AI" },
  { icon: ScrollText, text: "Every cent audited" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="grid items-center gap-10 pb-10 pt-2 sm:pt-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="text-center lg:text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-allow" /> A permission slip for AI shopping agents
          </p>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Your AI can shop.
            <br />
            <span className="text-accent">It can&apos;t overspend.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-base text-muted sm:text-lg lg:mx-0">
            Write the rule in plain English. PayPal holds the budget. A deterministic policy engine — not the AI — approves every cent.
          </p>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              <PlayCircle size={18} /> Run the guided demo
            </Link>
            <a href="#compose" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-2">
              Write your own mandate <ArrowDown size={16} />
            </a>
          </div>
          <Link href="/demo#mcp" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent">
            <Plug size={14} /> Or connect your own agent (MCP)
          </Link>
        </div>
        <HeroSequence />
      </section>

      <ul className="grid gap-2 rounded-2xl border border-line bg-surface px-4 py-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line">
        {TRUST.map((t) => (
          <li key={t.text} className="flex items-center justify-center gap-2 text-sm font-medium sm:px-3">
            <t.icon size={16} className="shrink-0 text-allow" /> {t.text}
          </li>
        ))}
      </ul>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-1 text-xl font-semibold tracking-tight">Write a mandate</h2>
        <p className="mb-4 text-sm text-muted">Say what to buy, your budget, and when the agent must ask you first. You&apos;ll review the compiled rules before any money is held.</p>
        <Suspense fallback={<div className="h-48 rounded-2xl border border-line bg-surface" />}>
          <Composer />
        </Suspense>
      </section>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <s.icon size={18} />
              </span>
              <div>
                <p className="font-medium">
                  <span className="num mr-1.5 text-faint">{i + 1}</span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-xs text-muted">
          An implementation of the <span className="font-medium text-ink">Intent Mandate</span> idea from AP2, enforced on real PayPal rails.
        </p>
        <p className="mt-2 text-center text-xs text-faint">Built on PayPal Orders v2 · Agent Toolkit · JS SDK v6 · Channel3 · AG Grid</p>
      </section>
    </div>
  );
}
