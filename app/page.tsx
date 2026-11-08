import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Composer } from "@/components/composer";
import { HeroSequence } from "@/components/hero-sequence";
import { InstrumentHero } from "@/components/landing/instrument-hero";
import { Lifecycle } from "@/components/landing/lifecycle";

function SectionHead({ n, label, title, children }: { n: string; label: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 lg:col-span-4">
      <span className="label">
        § {n} — {label}
      </span>
      <h2 className="display mt-4 text-[1.75rem] font-medium leading-[1.15] text-ink">{title}</h2>
      {children && <div className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-w-0">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-12 pb-20 pt-2 sm:pt-6 lg:grid-cols-12 lg:gap-10 lg:pb-24">
        <div className="min-w-0 lg:col-span-7 lg:pt-6">
          <p className="label leading-relaxed">
            Mandate / № 0001 — <span className="whitespace-nowrap">A permission slip for AI agents</span>
          </p>
          <h1 className="display-xl mt-8 text-balance text-ink">
            Your AI can shop.
            <br />
            <em className="italic">It can&rsquo;t overspend.</em>
          </h1>
          <p className="mt-8 max-w-[34rem] text-pretty text-[17px] leading-[1.55] text-muted">
            You write the rule. PayPal holds the budget. Thirteen deterministic checks — not a model — decide every cent.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
            <Link
              href="/demo#red-team"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[2px] bg-ink px-6 text-[15px] font-medium text-on-accent transition-colors duration-[120ms] hover:bg-ink/90"
            >
              Watch the attack fail <ArrowRight size={16} aria-hidden />
            </Link>
            <a href="#compose" className="inline-flex min-h-11 items-center justify-center text-[15px] text-ink underline decoration-line underline-offset-[6px] hover:decoration-ink sm:justify-start">
              Draft a mandate
            </a>
          </div>
          <Link href="/demo#mcp" className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
            Connect your own agent (MCP) <ArrowRight size={14} aria-hidden />
          </Link>

          <dl className="mt-14 hidden max-w-[34rem] grid-cols-3 border-t border-line pt-4 lg:grid">
            {[
              ["Decided by", "13 rules, no model"],
              ["Money held by", "PayPal"],
              ["Signed with", "Ed25519"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 pr-4">
                <dt className="label">{k}</dt>
                <dd className="mt-2 text-sm text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0 lg:col-span-5">
          <InstrumentHero />
          <HeroSequence />
        </div>
      </section>

      {/* ── Lifecycle ────────────────────────────────────────────────────── */}
      <section aria-labelledby="lifecycle" className="grid grid-cols-1 gap-8 border-t border-line py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
        <SectionHead n="02" label="Lifecycle" title="One hold. Five entries.">
          <p id="lifecycle">
            The agent never touches your card. It can only ask to capture from a hold PayPal already placed — and the engine answers.
          </p>
        </SectionHead>
        <div className="min-w-0 lg:col-span-8">
          <Lifecycle />
        </div>
      </section>

      {/* ── Compose ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="draft" className="grid grid-cols-1 gap-8 border-t border-line py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
        <SectionHead n="03" label="Draft" title="Draft a mandate.">
          <p id="draft">Say what to buy, your budget, and when the agent must ask you first.</p>
          <p className="mt-3">You review the compiled rules before PayPal holds anything. Nothing is signed until you sign it.</p>
        </SectionHead>
        <div className="min-w-0 lg:col-span-8">
          <Suspense fallback={<div className="h-[19rem] border border-line bg-surface" />}>
            <Composer />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
