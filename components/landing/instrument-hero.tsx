"use client";
import { useEffect, useState } from "react";
import { Seal, amountInWords } from "@/components/ui";

const RULE = "Running shoes for my marathon. Max $120, ask me above $80.";
const DEMO_HASH = "7a3fc9e1b04d5a28f6c3e9170b2d84ac5f1e6b93d0a7c2e4f8b1965d3a0ec27f";
const TYPE_MS = 34;
const START_MS = 520;

/** Staggered first-load draw-in (motion #4): 60ms per row. */
const draw = (i: number) => ({ style: { animationDelay: `${i * 60}ms` } });

/** The static landing instrument: a cheque-shaped mandate. The rule types itself in once. */
export function InstrumentHero() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(RULE.length);
      return;
    }
    let i = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      id = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= RULE.length && id) clearInterval(id);
      }, TYPE_MS);
    }, START_MS);
    return () => {
      clearTimeout(start);
      if (id) clearInterval(id);
    };
  }, []);
  const typing = n < RULE.length;

  return (
    <figure
      className="relative min-w-0 border border-line bg-surface shadow-paper"
      aria-label={`Example mandate: pay up to $120.00 for “${RULE}”, signed by you, held by PayPal.`}
    >
      {/* Header strip */}
      <div {...draw(0)} className="animate-ink flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
        <span className="label text-ink">Intent mandate</span>
        <span className="num text-xs text-muted">№ MDT-7A3F-C9</span>
      </div>

      <div className="px-5 pb-5 pt-5 sm:px-6">
        {/* Pay up to */}
        <div {...draw(1)} className="animate-ink flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <span className="label">Pay up to</span>
            <p className="label mt-2 text-muted">Ask me above <span className="num text-ink">$80.00</span></p>
          </div>
          <div className="guilloche border border-line px-3 py-1.5">
            <span className="num text-[2.25rem] font-medium leading-none text-ink sm:text-5xl">$120.00</span>
          </div>
        </div>
        <p {...draw(2)} className="animate-ink words mt-3 border-b border-line pb-2 text-muted">
          {amountInWords(120)}
          <span aria-hidden className="text-faint"> ————</span>
        </p>

        {/* For */}
        <div {...draw(3)} className="animate-ink mt-5 grid grid-cols-[2.5rem_1fr] items-baseline gap-2">
          <span className="label">For</span>
          <p className="display min-h-[3.5rem] border-b border-line pb-1 text-[1.3rem] italic leading-[1.35] text-ink" aria-hidden>
            “{RULE.slice(0, n)}
            {typing ? <span className="caret ml-px" /> : "”"}
          </p>
        </div>

        {/* Terms */}
        <dl {...draw(4)} className="animate-ink mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="min-w-0">
            <dt className="label">Valid until</dt>
            <dd className="num mt-1.5 text-sm text-ink">15 NOV 2026</dd>
          </div>
          <div className="min-w-0">
            <dt className="label">Held by</dt>
            <dd className="num mt-1.5 text-sm text-paypal">PayPal · AUTHORIZE</dd>
          </div>
        </dl>

        {/* Signature + seal */}
        <div {...draw(5)} className="animate-ink mt-6 flex items-end justify-between gap-4">
          <Seal hash={DEMO_HASH} size={76} />
          <div className="min-w-0 flex-1 max-w-[15rem]">
            <svg viewBox="0 0 220 44" className="h-10 w-full text-ink" aria-hidden>
              <path
                d="M6 32c8-2 12-18 18-22s5 16 2 22 8-10 13-14 2 12 6 12 9-14 14-14-3 12 2 12 10-8 14-10 0 8 5 8 8-6 12-6c8 0 6 6 14 4s26-4 40-6 30-2 66-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="border-t border-ink pt-1.5">
              <span className="label">Signed by you</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stub: perforation + MICR line */}
      <div aria-hidden className="perforation" />
      <div {...draw(6)} className="animate-ink flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-dashed border-line px-5 py-3 sm:px-6">
        <span className="micr text-muted">⑆ PAYPAL AUTH 5RK…</span>
        <span className="micr text-muted">⑈ ED25519 ⑆</span>
      </div>
    </figure>
  );
}
