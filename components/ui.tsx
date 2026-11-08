// Shared primitives for "The Signed Instrument" design system.
// Rules: square corners (0 for surfaces, 2px for controls), ink is the brand, color only for meaning.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A plain surface: square, hairline border. Use `instrument` for the one lifted paper object per screen. */
export function Card({ className, instrument, ...p }: React.HTMLAttributes<HTMLDivElement> & { instrument?: boolean }) {
  return <div className={cn("border border-line bg-surface", instrument && "shadow-paper", className)} {...p} />;
}

/** Mono uppercase caption: field labels, eyebrows, column heads. */
export function Label({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label text-muted", className)} {...p} />;
}

const tones = {
  neutral: "border-line text-muted",
  accent: "border-ink/40 text-ink",
  allow: "border-allow/60 text-allow",
  escalate: "border-escalate/60 text-escalate",
  deny: "border-deny/60 text-deny",
  paypal: "border-paypal/50 text-paypal",
} as const;
export type Tone = keyof typeof tones;

/** Small square tag (1px border, no fill). Not a pill. */
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("label inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-1 text-[10px]", tones[tone], className)}
      {...p}
    />
  );
}

export function verdictTone(v?: string | null): Exclude<Tone, "paypal"> {
  if (v === "ALLOW" || v === "APPROVED") return "allow";
  if (v === "ESCALATE") return "escalate";
  if (v === "DENY") return "deny";
  return "neutral";
}

export function Button({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "allow" | "deny" | "link" }) {
  const v = {
    primary: "bg-ink text-on-accent hover:bg-ink/90",
    ghost: "border border-line bg-surface text-ink hover:border-ink/40",
    allow: "bg-allow text-on-accent hover:bg-allow/90",
    deny: "border border-deny/50 bg-transparent text-deny hover:bg-deny-soft",
    link: "px-0 text-ink underline decoration-line underline-offset-4 hover:decoration-ink",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[2px] px-4 text-sm font-medium transition-colors duration-[120ms] disabled:pointer-events-none disabled:opacity-40",
        v,
        className,
      )}
      {...p}
    />
  );
}

/** Monospace, tabular money — every amount on screen goes through this. */
export function Money({ n, className }: { n: number | null | undefined; className?: string }) {
  return <span className={cn("num", className)}>{usd(n)}</span>;
}

/** Cheque-style amount in words: 120 → "ONE HUNDRED TWENTY AND 00/100 USD". */
export function amountInWords(n: number): string {
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const words = (x: number): string => {
    if (x === 0) return "";
    if (x < 20) return ones[x];
    if (x < 100) return [tens[Math.floor(x / 10)], ones[x % 10]].filter(Boolean).join("-");
    if (x < 1000) return [ones[Math.floor(x / 100)], "HUNDRED", words(x % 100)].filter(Boolean).join(" ");
    return [words(Math.floor(x / 1000)), "THOUSAND", words(x % 1000)].filter(Boolean).join(" ");
  };
  const dollars = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - dollars) * 100);
  return `${words(dollars) || "ZERO"} AND ${String(cents).padStart(2, "0")}/100 USD`;
}

export type StampVerdict = "ALLOW" | "APPROVED" | "ESCALATE" | "DENY" | "VOID";

/**
 * Rubber stamp — the only saturated, rotated, hand-made mark on a screen.
 * Distressed edge comes from the #stamp-rough SVG filter defined once in the root layout.
 */
export function Stamp({
  verdict,
  children,
  size = "sm",
  animate = false,
  rotate = -4,
  className,
}: {
  verdict: StampVerdict;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  rotate?: number;
  className?: string;
}) {
  const color =
    verdict === "DENY" ? "text-deny border-deny" : verdict === "ESCALATE" ? "text-escalate border-escalate" : "text-allow border-allow";
  const sizes = {
    sm: "border-[3px] px-1.5 py-0.5 text-[10px] tracking-[0.14em]",
    md: "border-[4px] px-3 py-1 text-base tracking-[0.14em]",
    lg: "border-[6px] px-6 py-2 text-5xl tracking-[0.12em] sm:text-6xl",
  }[size];
  const text = children ?? (verdict === "APPROVED" ? "APPROVED" : verdict === "VOID" ? "VOID" : verdict === "ALLOW" ? "ALLOWED" : verdict === "ESCALATE" ? "ASK HUMAN" : "DENIED");
  return (
    <span
      role={verdict === "DENY" ? "status" : undefined}
      aria-live={verdict === "DENY" ? "assertive" : undefined}
      className={cn(
        "inline-block select-none border-double font-mono font-semibold uppercase leading-none",
        sizes,
        color,
        animate && "animate-stamp",
        className,
      )}
      style={{ ["--stamp-rot" as string]: `${rotate}deg`, transform: `rotate(${rotate}deg)`, filter: "url(#stamp-rough)" }}
    >
      {text}
    </span>
  );
}

/** Round guilloche seal with the mandate hash around the rim. Renders nothing without a hash. */
export function Seal({ hash, size = 64, className, label = "SIGNED · ED25519" }: { hash?: string | null; size?: number; className?: string; label?: string }) {
  if (!hash) return null;
  const h = hash.replace(/^0x/, "");
  const rim = `${label} · ${h.slice(0, 24).toUpperCase()} · `;
  const id = `seal-${h.slice(0, 8)}`;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 text-ink", className)} title={`Mandate signature sha256 ${h}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-label={`Signed mandate ${h.slice(0, 8)}`}>
        <defs>
          <path id={id} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.8" />
        {Array.from({ length: 36 }, (_, i) => (
          <ellipse key={i} cx="50" cy="50" rx="28" ry="9" fill="none" stroke="currentColor" strokeWidth="0.25" opacity="0.55" transform={`rotate(${i * 5} 50 50)`} />
        ))}
        <text fontSize="6.2" fontFamily="var(--font-plex-mono), monospace" letterSpacing="0.6" fill="currentColor">
          <textPath href={`#${id}`}>{rim}</textPath>
        </text>
        {/* Clear plate behind the serial so the guilloche never collides with it. */}
        <circle cx="50" cy="50" r="15.5" fill="var(--surface)" stroke="currentColor" strokeWidth="0.6" />
        <text x="50" y="53.6" textAnchor="middle" fontSize="9.5" fontFamily="var(--font-plex-mono), monospace" fontWeight="600" letterSpacing="0.3" fill="currentColor">
          {h.slice(0, 6).toUpperCase()}
        </text>
      </svg>
    </span>
  );
}

/** Compact inline seal for headers: "Signed #abcd1234". */
export function SealTag({ hash, className }: { hash?: string | null; className?: string }) {
  if (!hash) return null;
  const h = hash.replace(/^0x/, "");
  return (
    <span title={`Mandate signature sha256 ${h}`} className={cn("label inline-flex items-center gap-1.5 text-ink", className)}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.2 1" />
      </svg>
      Signed <span className="num normal-case tracking-normal">#{h.slice(0, 8)}</span>
    </span>
  );
}

export const signatureOf = (m: unknown): string | null => ((m as any)?.signatureHash as string | null | undefined) ?? null;
