import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Rosette } from "../rosette";

/** sha256-shaped demo serial for the example mandate (illustrative; the bench below runs the real engine). */
export const DEMO_HASH = "7a3fc9e1b04d5a28f6c3e9170b2d84ac5f1e6b93d0a7c2e4f8b1965d3a0ec27f";

export function Hero() {
  return (
    <section className="relative isolate min-w-0 overflow-x-clip pb-14 pt-2 sm:pt-6 lg:pb-20" aria-labelledby="hero-title">
      {/* Engraved rosette of the example mandate — the face this one hash always draws. */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-2 -z-10 hidden opacity-50 md:block lg:-right-10">
        <Rosette hash={DEMO_HASH} size={560} animate duration={2400} strength={0.7} />
      </div>
      <div aria-hidden className="pointer-events-none absolute right-0 top-10 -z-10 opacity-40 md:hidden">
        <Rosette hash={DEMO_HASH} size={240} animate duration={2000} strength={0.6} />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
        <p className="label text-ink">
          Writ <span className="text-muted">№ 0001</span>
        </p>
        <p className="label text-muted">The financial permission layer for autonomous AI</p>
      </div>

      <h1 id="hero-title" className="display-xl mt-10 text-ink sm:mt-14">
        <span className="block">Your AI can shop.</span>
        <span className="block italic sm:pl-[7%]">It can&rsquo;t overspend.</span>
      </h1>

      <div className="mt-12 grid gap-8 sm:mt-16 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-5">
          <p className="max-w-[30rem] text-pretty text-[19px] leading-[1.5] text-ink">
            AI decides what to buy. Writ decides whether it&rsquo;s allowed to spend. PayPal enforces the boundary.
          </p>
          <p className="mt-4 max-w-[30rem] text-pretty text-[15px] leading-[1.6] text-muted">
            You sign one sentence. PayPal holds the budget. Thirteen deterministic rules (plain code, no model) decide every cent an
            agent tries to spend.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start lg:col-span-4 lg:flex-col">
          <Link
            href="/demo"
            className="group inline-flex min-h-12 items-center justify-between gap-6 bg-ink px-5 text-[15px] font-medium text-on-accent transition-colors duration-[120ms] hover:bg-ink/90 sm:min-w-[16rem]"
          >
            Run the guided demo <ArrowRight size={16} aria-hidden className="transition-transform duration-[120ms] group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#bench"
            className="inline-flex min-h-12 items-center justify-between gap-6 border border-ink px-5 text-[15px] font-medium text-ink transition-colors duration-[120ms] hover:bg-surface sm:min-w-[16rem]"
          >
            Try to get past the rules <span aria-hidden>↓</span>
          </a>
          <a href="#compose" className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            Or describe your own mission
          </a>
        </div>
        <dl className="grid min-w-0 grid-cols-1 border-t border-ink sm:grid-cols-3 sm:gap-4 sm:pt-3 lg:col-span-3 lg:grid-cols-1 lg:gap-0 lg:border-t-0 lg:pt-0">
          {[
            ["Decided by", "13 rules, no model"],
            ["Money held by", "PayPal"],
            ["Signed with", "Passkey · Ed25519"],
          ].map(([k, val]) => (
            <div key={k} className="flex min-w-0 items-baseline justify-between gap-4 border-b border-line py-2.5 sm:block sm:border-b-0 sm:py-0 lg:border-t lg:border-ink lg:py-2.5">
              <dt className="label text-[10px] text-muted">{k}</dt>
              <dd className="mt-1.5 text-[14px] text-ink">{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Double hairline + microprint caption: the line the agent can't cross. */
export function BoundaryRule({ label = "Enforcement boundary · 13 rules · no model in the decision path" }: { label?: string }) {
  return (
    <div className="relative my-2" role="separator" aria-label={label}>
      <div className="boundary-rule" />
      <p aria-hidden className="label absolute left-1/2 top-0 max-w-[92%] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap bg-bg px-3 text-[9px] tracking-[0.2em] text-muted">
        {label}
      </p>
    </div>
  );
}
