import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,18,34,0.04)]", className)} {...p} />;
}

const tones = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  allow: "bg-allow-soft text-allow",
  escalate: "bg-escalate-soft text-escalate",
  deny: "bg-deny-soft text-deny",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}
      {...p}
    />
  );
}

export function verdictTone(v?: string | null): Tone {
  if (v === "ALLOW" || v === "APPROVED") return "allow";
  if (v === "ESCALATE") return "escalate";
  if (v === "DENY") return "deny";
  return "neutral";
}

export function Button({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "allow" | "deny" }) {
  const v = {
    primary: "bg-accent text-white hover:opacity-90",
    ghost: "border border-line bg-surface text-ink hover:bg-surface-2",
    allow: "bg-allow text-white hover:opacity-90",
    deny: "border border-line bg-surface text-deny hover:bg-deny-soft",
  }[variant];
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none", v, className)}
      {...p}
    />
  );
}

/** Monospace, tabular money — every amount on screen goes through this. */
export function Money({ n, className }: { n: number | null | undefined; className?: string }) {
  return <span className={cn("num", className)}>{usd(n)}</span>;
}

/** "Signed mandate #abcd1234" seal — renders nothing unless the backend provides a signature hash. */
export function Seal({ hash, className }: { hash?: string | null; className?: string }) {
  if (!hash) return null;
  return (
    <span
      title={`Mandate signature ${hash}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/50 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="shrink-0">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 1.4" />
        <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Signed mandate <span className="num">#{hash.replace(/^0x/, "").slice(0, 8)}</span>
    </span>
  );
}

export const signatureOf = (m: unknown): string | null => ((m as any)?.signatureHash as string | null | undefined) ?? null;
