"use client";
import { useEffect, useState } from "react";
import { cn, usd } from "./ui";
import { Punch } from "./punch";

export type EnvelopeProps = {
  /** The PayPal authorization (hold) amount. */
  authorized: number;
  /** Total captured from the hold (before refunds). */
  captured: number;
  /** Refunded back out of what was captured. */
  refunded?: number;
  /** Mandate closed (FULFILLED / VOIDED): the unspent remainder has been voided and released. */
  closed?: boolean;
  /** Before PayPal approval: show what will be held. */
  preview?: boolean;
  /** Amount of a PENDING human approval; drawn as an amber outline inside the held part. */
  pendingAmount?: number;
  authorizationId?: string | null;
  className?: string;
};

const REFUND_HATCH = {
  backgroundImage: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--muted) 55%, transparent) 0 1px, transparent 1px 6px)",
} as const;

/**
 * The budget envelope: one bar that always sums to the PayPal authorization.
 *   captured (solid PayPal blue; refunded part hatched) | awaiting you (amber outline) | held (stripes)
 *   — once closed, the held part collapses right-to-left and the remainder reads RELEASED.
 */
export function Envelope({
  authorized,
  captured,
  refunded = 0,
  closed = false,
  preview = false,
  pendingAmount = 0,
  authorizationId,
  className,
}: EnvelopeProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const auth = Math.max(0, authorized || 0);
  const spent = preview ? 0 : Math.min(auth, Math.max(0, captured || 0));
  const back = Math.min(spent, Math.max(0, refunded || 0));
  const remaining = Math.max(0, auth - spent);
  const pending = closed || preview ? 0 : Math.min(remaining, Math.max(0, pendingAmount || 0));
  const held = closed ? 0 : remaining;
  const released = closed ? remaining : 0;
  const pct = (v: number) => (auth && shown ? (v / auth) * 100 : 0);
  const spentPct = auth ? (spent / auth) * 100 : 0;

  const sentence = preview
    ? `PayPal will hold ${usd(auth)} once you sign. Nothing is captured until a purchase passes the policy engine.`
    : closed
      ? [
          released > 0 ? `PayPal released ${usd(released)} of the hold back to you.` : "The full hold was captured; nothing was left to release.",
          spent > 0 ? `${usd(spent)} was captured${back > 0 ? `, ${usd(back)} of it refunded` : ""}.` : "Nothing was captured.",
        ].join(" ")
      : [
          `PayPal holds ${usd(held)} of ${usd(auth)}.`,
          spent > 0 ? `${usd(spent)} captured${back > 0 ? `, ${usd(back)} refunded` : ""}.` : "Nothing captured yet; every capture must pass the policy engine.",
          pending > 0 ? `${usd(pending)} is waiting for your approval.` : "",
        ]
          .filter(Boolean)
          .join(" ");

  const ease = "transition-[width] duration-[600ms] ease-[var(--ease-ink)]";

  return (
    <section className={cn("@container border border-line bg-surface", className)} aria-label="Budget envelope">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <span className="label text-ink">Budget envelope</span>
        {preview ? (
          <span className="label text-muted">Not yet held</span>
        ) : authorizationId ? (
          <span className="label text-muted">
            PayPal auth <span className="num normal-case tracking-normal text-paypal">{authorizationId}</span>
          </span>
        ) : null}
      </header>

      <div className="px-4 pb-4 pt-4 sm:px-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 @lg:grid-cols-4">
          <Stat label={preview ? "To hold" : "Held"} value={preview ? auth : held} swatch={<span className="stripes block h-full w-full" />} strong={!closed} tone="navy" />
          <Stat label="Captured" value={spent} swatch={<span className="block h-full w-full bg-paypal" />} tone="paypal" />
          <Stat label="Released" value={released} swatch={<StrikeSwatch />} tone="paypal" strong={closed} />
          <Stat label="Refunded" value={back} swatch={<span className="block h-full w-full" style={REFUND_HATCH} />} />
        </dl>

        {/* The bar */}
        <div className="relative mt-5">
          <div
            className="relative flex h-7 overflow-hidden border border-line bg-surface"
            role="img"
            aria-label={`${usd(spent)} captured (${usd(back)} refunded), ${usd(pending)} awaiting approval, ${usd(held)} held, ${usd(released)} released, of ${usd(auth)} authorized`}
          >
            {/* Released remainder: paper with a faint strike, revealed as the hold collapses. */}
            {closed && released > 0 && (
              <span className="absolute inset-y-0 right-0" style={{ left: `${spentPct}%` }} aria-hidden>
                <span className="absolute inset-x-0 top-1/2 h-px bg-muted/50" />
              </span>
            )}
            <span className={cn("relative h-full bg-paypal", ease)} style={{ width: `${pct(spent - back)}%` }} />
            <span className={cn("relative h-full bg-surface", ease)} style={{ width: `${pct(back)}%`, ...REFUND_HATCH }} />
            <span
              className={cn("relative h-full shrink-0", pending > 0 && "border-2 border-escalate bg-escalate-soft", ease)}
              style={{ width: `${pct(pending)}%` }}
            />
            <span className={cn("stripes relative h-full", ease)} style={{ width: `${preview ? (shown ? 100 : 0) : pct(held - pending)}%` }} />
          </div>

          {closed && released > 0 && (
            <span className="pointer-events-none absolute right-2 top-[14px] -translate-y-1/2 sm:right-4">
              <span className="flex items-center gap-2 border border-paypal/40 bg-surface px-2 py-1">
                <Punch text="VOID" dot={3} tone="paypal" animate delay={520} label="Void: the remainder was returned" />
                <span className="label text-[10px] text-paypal">Returned</span>
              </span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex justify-between gap-4 font-mono text-[11px] text-muted">
          <span className="num">$0</span>
          {pending > 0 && <span className="label text-escalate">Awaiting you {usd(pending)}</span>}
          <span className="num">{usd(auth)} authorized</span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">{sentence}</p>
      </div>
    </section>
  );
}

function StrikeSwatch() {
  return (
    <span className="relative block h-full w-full bg-surface">
      <span className="absolute inset-x-0 top-1/2 h-px bg-muted" />
    </span>
  );
}

function Stat({
  label,
  value,
  swatch,
  tone,
  strong,
}: {
  label: string;
  value: number;
  swatch: React.ReactNode;
  tone?: "paypal" | "navy";
  strong?: boolean;
}) {
  const zero = value === 0;
  return (
    <div className="min-w-0">
      <dt className="label flex items-center gap-2 text-muted">
        <span className="inline-block h-3 w-3 shrink-0 overflow-hidden border border-line" aria-hidden>
          {swatch}
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          "num mt-2 truncate font-medium leading-none",
          strong ? "text-3xl @lg:text-4xl" : "text-2xl @lg:text-3xl",
          zero ? "text-muted" : tone === "navy" ? "text-paypal-navy" : tone === "paypal" ? "text-paypal" : "text-ink",
        )}
      >
        {usd(value)}
      </dd>
    </div>
  );
}
