"use client";
import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Badge, cn, usd } from "./ui";

/**
 * The budget envelope: one bar that always sums to the PayPal authorization.
 *   captured (spent, minus refunds) | refunded | still held  — or, once closed, released.
 * Widths animate ("pour") on mount and whenever money moves; the held segment fades
 * from PayPal stripes to green when the remainder is voided ("release").
 */
export function Envelope({
  authorized,
  captured,
  refunded = 0,
  closed = false,
  preview = false,
  authorizationId,
  className,
}: {
  authorized: number;
  captured: number;
  refunded?: number;
  closed?: boolean;
  /** Before PayPal approval: show what will be held. */
  preview?: boolean;
  authorizationId?: string | null;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const auth = Math.max(0, authorized || 0);
  const spent = Math.min(auth, Math.max(0, captured || 0));
  const back = Math.min(spent, Math.max(0, refunded || 0));
  const remaining = Math.max(0, auth - spent);
  const pct = (v: number) => (auth && shown ? (v / auth) * 100 : 0);
  const heldPct = preview ? (shown ? 100 : 0) : pct(remaining);

  const headline = preview ? auth : remaining;
  const headLabel = preview ? "will be held by PayPal" : closed ? "released back to you" : "still held by PayPal";

  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          {closed ? <Unlock size={13} /> : <Lock size={13} />} Budget envelope
        </p>
        <Badge tone={preview ? "accent" : closed ? "allow" : "escalate"}>
          {preview ? "not yet held" : closed ? "hold voided" : "hold active"}
        </Badge>
      </div>

      <p className={cn("num mt-3 text-4xl font-semibold sm:text-5xl", closed ? "text-allow" : "text-ink")}>{usd(headline)}</p>
      <p className="mt-0.5 text-sm text-muted">
        {headLabel}
        {!preview && <> · of <span className="num text-ink">{usd(auth)}</span> authorized</>}
      </p>

      <div
        className="mt-4 flex h-5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
        role="img"
        aria-label={`${usd(spent - back)} captured, ${usd(back)} refunded, ${usd(remaining)} ${closed ? "released" : "held"}`}
      >
        <div className="h-full bg-accent transition-[width] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${pct(spent - back)}%` }} />
        <div className="h-full bg-allow/50 transition-[width] duration-1000 ease-out" style={{ width: `${pct(back)}%` }} />
        <div className="relative h-full bg-allow/35 transition-[width] duration-1000 ease-out" style={{ width: `${heldPct}%` }}>
          <div className={cn("stripes absolute inset-0 transition-opacity duration-1000", closed ? "opacity-0" : "opacity-100")} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Stat dot="bg-accent" label="Captured" value={spent - back} />
        <Stat dot={closed ? "bg-allow/60" : "stripes"} label={closed ? "Released" : preview ? "To hold" : "Still held"} value={preview ? auth : remaining} />
        <Stat dot="bg-allow/50" label="Refunded" value={back} faint={back === 0} />
      </dl>

      {authorizationId && <p className="num mt-4 truncate text-[10px] text-faint">PayPal authorization {authorizationId}</p>}
    </div>
  );
}

function Stat({ dot, label, value, faint }: { dot: string; label: string; value: number; faint?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", dot)} /> {label}
      </dt>
      <dd className={cn("num mt-0.5 truncate text-base font-semibold sm:text-lg", faint && "text-faint")}>{usd(value)}</dd>
    </div>
  );
}
