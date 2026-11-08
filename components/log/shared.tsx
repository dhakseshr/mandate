"use client";
import { useState } from "react";
import type { Product } from "@/lib/policy/schema";
import type { View } from "../mandate-screen";
import { cn } from "../ui";

export type Ev = View["events"][number];
export type Check = { rule: string; verdict: string; message: string };
export type Injection = { text?: string; source?: string; followedByAgent?: boolean };
export type LogProduct = Product & { description?: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- event detail is free-form JSON from the ledger
export const det = (e: Ev) => (e.detail ?? {}) as Record<string, any>;
export const isRedTeamProduct = (p?: { id?: string; title?: string } | null) =>
  !!p && (p.id === "redteam_ultra_elite" || /\[RED TEAM\]/i.test(p.title ?? ""));
export const isAttack = (e: Ev) =>
  e.type === "POLICY_VERDICT" && e.verdict === "DENY" && (!!det(e).injection || isRedTeamProduct(det(e).product));
export const isDecision = (e: Ev) => e.type === "HUMAN" && /^You (approved|rejected)/.test(e.title);

/** 24h wall-clock, e.g. 09:41:02 — the log's timestamp column. */
export const hhmmss = (ts: string | Date) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export const checkGlyph = (v: string) => (v === "DENY" ? "✗" : v === "ESCALATE" ? "!" : "✓");

/** Collapse consecutive identical HUMAN/PAYPAL/SYSTEM rows (e.g. three policy edits) into one with a count. */
export function collapse(events: Ev[]) {
  const out: { e: Ev; n: number }[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    const collapsible =
      e.type === "HUMAN" || e.type === "SYSTEM" || (e.type === "PAYPAL" && e.title.startsWith("Created PayPal order"));
    const same = !!last && collapsible && last.e.type === e.type && last.e.title === e.title;
    if (same) out[out.length - 1] = { e, n: last.n + 1 };
    else out.push({ e, n: 1 });
  }
  return out;
}

/** An ID that copies itself on click. PayPal IDs render PayPal-blue. */
export function CopyId({ value, paypal = true, className, label }: { value: string; paypal?: boolean; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          })
          .catch(() => {})
      }
      title={`Copy ${value}`}
      aria-label={`Copy ${label ?? "ID"} ${value}`}
      className={cn(
        "num inline-flex max-w-full items-center gap-1 rounded-[2px] text-left underline decoration-dotted underline-offset-[3px] hover:decoration-solid",
        paypal ? "text-paypal decoration-paypal/50" : "text-ink decoration-line",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      <span className="label shrink-0 text-[9px] text-muted no-underline">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

export function Thumb({ src, size = 28, className }: { src?: string | null; size?: number; className?: string }) {
  const s = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={s} className={cn("shrink-0 border border-line bg-white object-contain", className)} />
  ) : (
    <span style={s} className={cn("block shrink-0 border border-line bg-surface-2", className)} aria-hidden />
  );
}
