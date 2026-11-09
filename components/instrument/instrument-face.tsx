"use client";
import type { ReactNode } from "react";
import type { Policy } from "@/lib/policy/schema";
import { Seal, amountInWords, cn, usd } from "../ui";
import { ENFORCER_LABEL, clausesOf, editText, formatValue, type Clause, type ClauseField } from "./clauses";

/** The subset of a mandate the instrument needs. Dates may be ISO strings (JSON) or Date. */
export type InstrumentMandate = {
  id: string;
  rawText: string;
  policy: Policy;
  budgetTotal?: number | null;
  createdAt?: string | Date | null;
  signatureHash?: string | null;
  signedAt?: string | Date | null;
  /** Forward-compat: how the human signed ("passkey" → "Signed with passkey"). Defaults to the PayPal approval. */
  signedWith?: "paypal" | "passkey" | string | null;
  /** sha256 of the intent the passkey signed. */
  passkeyIntentHash?: string | null;
  /** Forward-compat: delegation. A sub-mandate shows "Under № parent" in the header strip. */
  parentId?: string | null;
};

export type InstrumentFaceProps = {
  mandate: InstrumentMandate;
  /** Smaller type and tighter rows, e.g. as a stub beside Mission Control. */
  compact?: boolean;
  /** Replace the read-only clause row (policy review passes editable rows). Must return an <li>. */
  renderClause?: (clause: Clause, n: number) => ReactNode;
  /** Unset clause keys to show anyway (e.g. one currently being added). */
  forceShow?: (keyof Policy)[];
  /** Rendered directly under the clause list (add-clause control, open questions). */
  afterClauses?: ReactNode;
  /** Replace the read-only validity line. */
  validity?: ReactNode;
  /** Below the perforation. Defaults to the signature block when the mandate is signed. */
  stub?: ReactNode;
  /** Extra header-strip content, e.g. links to child sub-mandates or a kill-switch state. */
  headerExtra?: ReactNode;
  /** First-load draw-in (60ms stagger). */
  animate?: boolean;
  className?: string;
};

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

/**
 * The mandate rendered as a signed instrument: serial, PAY UP TO, amount in words,
 * the human's own words, numbered clauses, validity, perforated stub, MICR line.
 */
export function InstrumentFace({
  mandate,
  compact = false,
  renderClause,
  forceShow = [],
  afterClauses,
  validity,
  stub,
  headerExtra,
  animate = true,
  className,
}: InstrumentFaceProps) {
  const { policy } = mandate;
  const amount = mandate.budgetTotal ?? policy.budget_total;
  const shown = clausesOf(policy).filter((c) => c.set || forceShow.includes(c.key));
  const signed = !!mandate.signatureHash;
  const drafted = fmtDate(mandate.createdAt);
  let step = 0;
  const ink = (extra?: string) => ({
    className: cn(animate && "animate-ink", extra),
    style: animate ? { animationDelay: `${step++ * 60}ms` } : undefined,
  });
  const px = compact ? "px-4" : "px-5 sm:px-8";

  const stubContent = stub ?? (signed ? <SignatureLine signedAt={mandate.signedAt} hash={mandate.signatureHash} method={mandate.signedWith} intentHash={mandate.passkeyIntentHash} /> : null);

  return (
    <article className={cn("border border-ink bg-surface text-ink shadow-paper", className)} aria-label={`Mandate ${mandate.id}`}>
      {/* ABNC lathe-work border (CC0) — the engraved edge of a real certificate. */}
      {!compact && <div aria-hidden className="lathe mx-3 mt-3 h-[18px] text-ink/85 sm:mx-4" />}
      {/* Header strip: title left, serial plate right (cf. Eidgenössische Bank, 1893). */}
      <header {...ink(cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3", px))}>
        <span className="flex items-baseline gap-3">
          <span className="label text-ink">Mandate</span>
          <span className="label hidden text-muted sm:inline">Limited authority to purchase</span>
        </span>
        <span className="flex items-center gap-2">
          {drafted && <span className="label hidden text-[10px] text-muted sm:inline">Drafted {drafted}</span>}
          <span className="num border border-ink px-2 py-1 text-xs text-ink">№ {mandate.id}</span>
        </span>
        {(mandate.parentId || headerExtra) && (
          <span className="label flex basis-full flex-wrap gap-x-4 gap-y-1 text-muted">
            {mandate.parentId && (
              <span>
                Sub-mandate under <span className="num normal-case tracking-normal text-ink">№ {mandate.parentId}</span>
              </span>
            )}
            {headerExtra}
          </span>
        )}
      </header>

      {/* PAY UP TO */}
      <section {...ink(cn(compact ? "pt-4" : "pt-6 sm:pt-8", px))}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="label text-muted">Pay up to</span>
            <p className={cn("mt-2 text-sm text-muted", compact && "hidden")}>captured only from a PayPal hold</p>
          </div>
          <div className={cn("safety relative border border-ink px-4 py-2.5 sm:min-w-[15rem] sm:text-right", !signed && "void-pantograph")}>
            <span className={cn("num block font-medium leading-none tracking-tight text-ink", compact ? "text-3xl" : "text-5xl sm:text-6xl")}>
              {usd(amount)}
            </span>
            {!compact && (
              <span className="label mt-1.5 block text-[9px] tracking-[0.18em] text-muted">{signed ? "Signed · held by PayPal" : "Void until signed"}</span>
            )}
          </div>
        </div>
        <p className="mt-3 border-b border-ink/70 pb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted" aria-label={`Amount in words: ${amountInWords(amount)}`}>
          {amountInWords(amount)}
        </p>
      </section>

      {/* FOR — the human's own words */}
      <section {...ink(cn("grid gap-2 sm:grid-cols-[5rem_1fr] sm:gap-4", compact ? "pt-4" : "pt-6", px))}>
        <span className="label pt-1.5 text-muted">For</span>
        <blockquote className={cn("display text-pretty italic leading-snug text-ink", compact ? "text-lg" : "text-[22px] sm:text-2xl")}>
          “{mandate.rawText}”
        </blockquote>
      </section>

      {/* Clauses */}
      <section {...ink(cn(compact ? "pt-4" : "pt-7", px))} aria-label="Clauses">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink/70 pb-2">
          <span className="label text-muted">Subject to the following clauses</span>
          <span className="label hidden text-muted sm:inline">Enforced by</span>
        </div>
        <ol>
          {shown.map((c, i) => (renderClause ? renderClause(c, i + 1) : <ClauseRow key={c.key} clause={c} n={i + 1} compact={compact} />))}
        </ol>
        {afterClauses}
      </section>

      {/* Validity */}
      <section {...ink(cn("pb-5", compact ? "pt-3" : "pt-5", px))}>
        {validity ?? (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="label text-muted">Valid for</span>
            <span className="num text-sm text-ink">{policy.expires_in_hours} h</span>
            <span className="text-sm text-muted">from signing; after that the engine denies every purchase.</span>
          </p>
        )}
      </section>

      {stubContent && (
        <>
          <Perforation />
          <div {...ink(cn("pb-5 pt-4", px))}>{stubContent}</div>
        </>
      )}

      <Micr id={mandate.id} amount={amount} signed={signed} className={px} />
    </article>
  );
}

/** One numbered clause. Interactive when `onEdit` is given; shows an inline input while `editing`. */
export function ClauseRow({
  clause,
  n,
  compact,
  editing,
  draft,
  onEdit,
  onDraft,
  onCommit,
  onCancel,
  disabled,
}: {
  clause: Clause | (ClauseField & { value: unknown; set: boolean });
  n: number;
  compact?: boolean;
  editing?: boolean;
  draft?: string;
  onEdit?: () => void;
  onDraft?: (v: string) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const enforcer = (
    <span className={cn("label col-start-2 text-[10px] sm:col-start-3 sm:text-right", clause.enforcer === "paypal" ? "text-paypal" : "text-muted")}>
      {ENFORCER_LABEL[clause.enforcer]}
    </span>
  );
  const grid = cn(
    "grid w-full grid-cols-[2.25rem_1fr] items-baseline gap-x-3 gap-y-1 border-b border-line text-left sm:grid-cols-[2.5rem_1fr_auto]",
    compact ? "py-2 text-sm" : "min-h-12 py-3 text-[15px]",
  );
  const num = <span className="num text-sm text-muted">§{n}</span>;
  const value = (
    <span
      className={cn(
        clause.kind === "list" || clause.kind === "date" ? "font-medium text-ink" : "num font-medium text-ink",
        onEdit && "underline decoration-line decoration-dotted decoration-1 underline-offset-[5px] group-hover:decoration-ink",
        clause.enforcer === "paypal" && "text-paypal-navy",
      )}
    >
      {clause.set ? formatValue(clause, clause.value) : "—"}
    </span>
  );

  if (editing)
    return (
      <li className={cn(grid, "bg-surface-2/70")}>
        {num}
        <label className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{clause.lead}</span>
          <input
            autoFocus
            type={clause.kind === "date" ? "date" : "text"}
            inputMode={clause.kind === "money" || clause.kind === "number" || clause.kind === "rating" || clause.kind === "hours" ? "decimal" : undefined}
            value={draft ?? ""}
            placeholder={clause.placeholder}
            onChange={(e) => onDraft?.(e.target.value)}
            onBlur={() => onCommit?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommit?.();
              if (e.key === "Escape") onCancel?.();
            }}
            aria-label={clause.lead}
            className="num min-h-9 min-w-0 flex-1 rounded-[2px] border-b-2 border-ink bg-transparent px-1 font-medium text-ink outline-none placeholder:text-muted/60"
          />
          <span className="label basis-full pt-1 text-[10px] text-muted">
            Enter to amend · Esc to cancel{clause.kind === "list" ? " · comma-separated" : ""}
          </span>
        </label>
        {enforcer}
      </li>
    );

  const body = (
    <>
      {num}
      <span className="min-w-0 text-pretty">
        {clause.lead} {value}
      </span>
      {enforcer}
    </>
  );

  return (
    <li>
      {onEdit ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className={cn(grid, "group px-0 transition-colors duration-[120ms] hover:bg-surface-2/60 focus-visible:bg-surface-2/60")}
          aria-label={`Amend §${n}: ${clause.lead} ${clause.set ? formatValue(clause, clause.value) : "not set"}`}
          title="Click to amend"
          data-value={editText(clause.value)}
        >
          {body}
        </button>
      ) : (
        <div className={grid}>{body}</div>
      )}
    </li>
  );
}

/** The signature rule. Unsigned: an empty seal ring ("applied at signing"). Signed: the guilloche seal. */
export function SignatureLine({
  signedAt,
  hash,
  pendingDate,
  method,
  intentHash,
  className,
}: {
  /** "passkey" renders "Signed with passkey"; anything else falls back to the default wording. */
  method?: string | null;
  /** sha256 of the intent document the passkey signed — shown as "intent #abcd1234". */
  intentHash?: string | null;
  signedAt?: string | Date | null;
  hash?: string | null;
  /** Date shown before signing (today). */
  pendingDate?: Date;
  className?: string;
}) {
  const date = fmtDate(signedAt ?? pendingDate ?? null);
  return (
    <div className={cn("flex items-end gap-4", className)}>
      {hash ? (
        <Seal hash={hash} size={72} animate />
      ) : (
        <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border border-dashed border-muted/70 text-center" aria-hidden>
          <span className="label text-[8px] leading-tight text-muted">Seal at<br />signing</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="h-8 border-b border-ink" />
        <p className="label mt-2 text-muted">
          {hash ? "Signed" : "To be signed"} by you{date ? <> · <span className="num normal-case tracking-normal text-ink">{date}</span></> : null}
          {method === "passkey" && <> · with passkey</>}
          {hash && <span className="hidden sm:inline"> · Ed25519</span>}
        </p>
        {method === "passkey" && hash && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
            <span className="text-allow" aria-hidden>✓</span>
            <span>
              Your device signed{" "}
              {intentHash ? (
                <>
                  intent <span className="num text-ink" title={`sha256 ${intentHash}`}>#{intentHash.slice(0, 8)}</span>
                </>
              ) : (
                "these clauses"
              )}{" "}
              — WebAuthn passkey
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Punched perforation between instrument body and stub. */
export function Perforation({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
      <div className="perforation relative" />
    </div>
  );
}

/** MICR-style machine line at the foot of the instrument. */
function Micr({ id, amount, signed, className }: { id: string; amount: number; signed: boolean; className?: string }) {
  const cents = String(Math.round(amount * 100)).padStart(10, "0");
  return (
    <footer className={cn("flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-line bg-surface-2/50 py-2.5 font-mono text-[11px] tracking-[0.18em] text-muted", className)}>
      <span className="truncate">
        ⑆{id}⑆ {cents}⑈
      </span>
      <span>{signed ? "AP2·INTENT·SIGNED" : "AP2·INTENT·UNSIGNED"} · SANDBOX</span>
    </footer>
  );
}
