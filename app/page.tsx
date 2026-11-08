import { Composer } from "@/components/composer";
import { Bot, Lock, ShieldCheck, Undo2 } from "lucide-react";

const STEPS = [
  { icon: Lock, title: "You set the mandate", body: "Plain English becomes a strict policy: budget, approval threshold, deadlines, merchants." },
  { icon: ShieldCheck, title: "PayPal holds the budget", body: "You authorize the cap once. The agent can only capture from that hold — never more." },
  { icon: Bot, title: "The agent shops", body: "It searches real catalogs, compares, explains. Every purchase passes a deterministic policy check." },
  { icon: Undo2, title: "Leftovers come back", body: "When done, the unspent authorization is voided. Every decision is in your audit ledger." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="pb-8 pt-6 text-center">
        <p className="mb-3 text-sm font-medium text-accent">Agentic commerce, with guardrails</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Let AI shop for you.
          <br />
          <span className="text-muted">Never a cent you didn&apos;t authorize.</span>
        </h1>
      </section>
      <Composer />
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex gap-3 rounded-2xl border border-line p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <s.icon size={18} />
            </span>
            <div>
              <p className="font-medium">
                <span className="mr-1 text-faint">{i + 1}.</span>
                {s.title}
              </p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
