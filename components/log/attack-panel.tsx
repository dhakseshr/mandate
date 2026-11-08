"use client";
import { Stamp, usd } from "../ui";
import { det, hhmmss, type Check, type Ev, type Injection, type LogProduct } from "./shared";

/**
 * The red-team moment. Everything here comes from the DENY event itself:
 * the attempted amount, the rule that fired and its message, and the injected text.
 * The panel prints like an impression: deny-soft fades to paper, the stamp lands. Nothing shakes.
 */
export function AttackPanel({ e, held, closed }: { e: Ev; held: number; closed: boolean }) {
  const d = det(e);
  const inj = (d.injection ?? {}) as Injection;
  const product = d.product as LogProduct | undefined;
  const injected = inj.text || product?.description || null;
  const source = inj.source || product?.merchant || null;
  const checks = (Array.isArray(d.checks) ? d.checks : []) as Check[];
  const deciding = checks.find((c) => c.rule === e.rule) ?? checks.find((c) => c.verdict === "DENY");
  const message = deciding?.message ?? e.title.replace(/^Blocked\s+—\s+/, "");
  const failed = checks.filter((c) => c.verdict === "DENY").length;

  return (
    <section
      key={e.id}
      aria-labelledby={`atk-${e.id}`}
      className="animate-impression relative overflow-hidden border border-deny/50 bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-6">
        <span className="label text-[10px] text-deny">Prompt injection · stopped by policy engine</span>
        <span className="label text-[10px] text-muted">
          {hhmmss(e.ts)} · {checks.length ? `${failed} of ${checks.length} rules failed` : "deterministic"}
        </span>
      </div>

      <div className="grid gap-x-10 gap-y-5 px-4 pb-5 pt-5 sm:px-6 sm:pb-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="md:col-start-2 md:row-start-1 md:justify-self-end">
          <Stamp verdict="DENY" size="lg" animate rotate={-4}>
            DENIED
          </Stamp>
        </div>
        <div className="min-w-0 md:col-start-1 md:row-span-2 md:row-start-1">
          <h2 id={`atk-${e.id}`} className="display text-[2.15rem] leading-[1.02] text-ink sm:text-5xl">
            The AI was fooled.
            <br />
            <span className="italic">The rules weren&rsquo;t.</span>
          </h2>

          <p className="num mt-4 text-[13px] text-ink sm:text-sm">
            <span className="text-deny">{usd(e.amount)} attempted</span>
            <span className="px-2 text-muted">·</span>
            {usd(0)} moved
            <span className="px-2 text-muted">·</span>
            <span className="text-paypal">
              {closed ? "released" : "hold intact"} {usd(held)}
            </span>
          </p>

          <dl className="mt-5 grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <dt className="label pt-[3px] text-[10px] text-muted">Deciding rule</dt>
            <dd className="num min-w-0 text-ink">
              <span className="font-medium text-deny">{e.rule ?? "DENY"}</span>
              <span className="text-muted"> — </span>
              {message}
            </dd>
            {injected && (
              <>
                <dt className="label pt-[3px] text-[10px] text-muted">
                  Injected text
                  {source && <span className="mt-1 block normal-case tracking-normal">from {source}</span>}
                </dt>
                <dd className="min-w-0">
                  <blockquote className="num bg-deny-soft px-3 py-2 text-[12px] leading-relaxed text-muted line-through decoration-deny/70 sm:text-[13px]">
                    “{injected}”
                  </blockquote>
                </dd>
              </>
            )}
          </dl>
        </div>

        <p className="display max-w-[16rem] self-end text-lg italic leading-snug text-muted md:col-start-2 md:row-start-2 md:justify-self-end md:text-right">
          Cannot be overridden — not by the agent, not by you.
        </p>
      </div>
    </section>
  );
}
