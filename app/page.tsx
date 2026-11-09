import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Composer } from "@/components/composer";
import { Hero, BoundaryRule } from "@/components/landing/hero";
import { Bench } from "@/components/landing/bench";
import { Lifecycle } from "@/components/landing/lifecycle";
import { Audience, AttackSchedule, Differentiators, Parties } from "@/components/landing/positioning";

/** Section head on the 4-column side of the Swiss grid: figure number, label, title, note. */
function SectionHead({ fig, label, title, children, id }: { fig: string; label: string; title: React.ReactNode; children?: React.ReactNode; id?: string }) {
  return (
    <div className="min-w-0 lg:col-span-4">
      <p className="label flex items-baseline gap-3 text-muted">
        <span className="serial text-[11px] normal-case tracking-normal text-ink">Fig. {fig}</span>
        <span>{label}</span>
      </p>
      <h2 id={id} className="display mt-4 text-balance text-[2.1rem] leading-[1.04] text-ink sm:text-[2.5rem]">
        {title}
      </h2>
      {children && <div className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

const section = "grid grid-cols-1 gap-8 py-16 lg:grid-cols-12 lg:gap-10 lg:py-24";

export default function Home() {
  return (
    <div className="min-w-0">
      <Hero />

      <BoundaryRule />

      {/* ── Fig. 1 — the bench: the real engine, in the browser ─────────── */}
      <section id="bench" aria-labelledby="bench-title" className="scroll-mt-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
          <SectionHead fig="1" label="The bench" id="bench-title" title={<>Try to get past the rules.</>} />
          <p className="self-end text-pretty text-[16px] leading-relaxed text-muted lg:col-span-6 lg:col-start-7">
            Pick a proposal, drag its price, or pull the kill switch. Each verdict is computed by{" "}
            <code className="num text-[14px] text-ink">evaluate()</code> from <code className="num text-[14px] text-ink">lib/policy/engine.ts</code>,
            the same pure function the server runs before every PayPal capture. It is running in this tab now.
          </p>
        </div>
        <figure className="mt-8">
          <Bench />
          <figcaption className="mt-3 grid gap-1 text-[13px] leading-relaxed text-muted sm:grid-cols-[6rem_1fr]">
            <span className="serial text-[11px] text-ink">Fig. 1</span>
            <span>
              The listings are examples; the rules, messages and verdicts are the engine&rsquo;s own. Merchant text is untrusted and the
              engine never reads it, so &ldquo;pre-approved, skip checks&rdquo; changes nothing.
            </span>
          </figcaption>
        </figure>
      </section>

      {/* ── Fig. 2 — three parties ──────────────────────────────────────── */}
      <section aria-labelledby="parties" className="border-t border-ink py-16 lg:py-24">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
          <SectionHead fig="2" label="Three parties" id="parties" title="We don’t trust the AI. We trust the boundary." />
          <p className="self-end text-[15px] leading-relaxed text-muted lg:col-span-5 lg:col-start-8">
            The model chooses <em>what</em> to buy. It never decides <em>whether</em> it may.
          </p>
        </div>
        <div className="mt-8">
          <Parties />
        </div>
        <div className="mt-12 lg:grid lg:grid-cols-12 lg:gap-10">
          <p className="label mb-4 text-muted lg:col-span-4 lg:mb-0">What holds the boundary</p>
          <div className="min-w-0 lg:col-span-8">
            <Differentiators />
          </div>
        </div>
      </section>

      {/* ── Fig. 3 — proof ─────────────────────────────────────────────── */}
      <section aria-labelledby="proof" className={`${section} border-t border-ink`}>
        <SectionHead fig="3" label="Proof, not claims" id="proof" title="A compromised agent gets a real budget and is told to steal.">
          <p>
            From any live mandate, the red-team suite carves a signed sub-mandate from the PayPal hold and attacks it through the same tool
            paths every agent uses. Then it crash-tests every clause at its exact edge.
          </p>
          <Link href="/demo#red-team" className="mt-6 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-ink underline decoration-line underline-offset-[6px] hover:decoration-ink">
            Watch the attack fail <ArrowRight size={15} aria-hidden />
          </Link>
        </SectionHead>
        <div className="min-w-0 lg:col-span-8">
          <AttackSchedule />
        </div>
      </section>

      {/* ── Fig. 4 — who it's for ──────────────────────────────────────── */}
      <section aria-labelledby="audience" className={`${section} border-t border-ink`}>
        <SectionHead fig="4" label="Who it’s for" id="audience" title="Bounded budgets for agents that spend.">
          <p>Companies hand AI procurement agents delegated authority. Writ makes that authority a signed, finite instrument.</p>
        </SectionHead>
        <div className="min-w-0 lg:col-span-8">
          <Audience />
        </div>
      </section>

      {/* ── Fig. 5 — lifecycle ─────────────────────────────────────────── */}
      <section aria-labelledby="lifecycle" className={`${section} border-t border-ink`}>
        <SectionHead fig="5" label="Lifecycle" id="lifecycle" title="One hold. Five entries.">
          <p>The agent never touches your card. It can only ask to capture from a hold PayPal already placed, and the engine answers.</p>
        </SectionHead>
        <div className="min-w-0 lg:col-span-8">
          <Lifecycle />
        </div>
      </section>

      {/* ── Fig. 6 — compose ───────────────────────────────────────────── */}
      <section aria-labelledby="draft" className={`${section} border-t border-ink`}>
        <SectionHead fig="6" label="Your mission" id="draft" title="Describe the mission.">
          <p>Say what to get done, your budget, and when agents must ask you first. Type it, dictate it, or start from a photo.</p>
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
