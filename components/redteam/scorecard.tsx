"use client";
import Link from "next/link";
import { Seal, Stamp, cn, usd } from "../ui";
import { Punch } from "../punch";
import { CopyId, hhmmss, type Ev } from "../log/shared";
import type { AttackResult, Certificate, CrashTest, Scorecard as SC, Snapshot } from "./suite";

const RULE_LABEL: Record<string, string> = { NONE: "—", ERROR: "TOOL_ERROR" };

function duration(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** The outcome mark at the end of each row. Static — only the headline stamp lands. */
function OutcomeMark({ r }: { r: AttackResult }) {
  switch (r.outcome) {
    case "DENIED":
    case "REFUSED":
      return <Stamp verdict="DENY" rotate={-3}>{r.outcome}</Stamp>;
    case "HELD_FOR_HUMAN":
      return <Stamp verdict="ESCALATE" rotate={-3}>Held</Stamp>;
    case "CONTAINED":
      return <Stamp verdict="APPROVED" rotate={-3} className="border-ink text-ink">Contained</Stamp>;
    case "NOT_APPLICABLE":
      return <span className="label rounded-[2px] border border-line px-1.5 py-1 text-[10px] text-muted">N/A</span>;
    case "BREACH":
      return <span className="label rounded-[2px] bg-deny px-1.5 py-1 text-[10px] text-on-accent">Breach</span>;
  }
}

const OUTCOME_SR: Record<string, string> = {
  DENIED: "denied",
  REFUSED: "refused",
  HELD_FOR_HUMAN: "held for a human, declined",
  CONTAINED: "contained inside the sub-mandate",
  NOT_APPLICABLE: "not applicable to this mandate",
  BREACH: "breach",
};

const ROW =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 md:grid-cols-[2.5rem_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_6.75rem] md:gap-x-5";

function Row({ r }: { r: AttackResult }) {
  const llm = r.by === "adversary-llm";
  const technique = llm && r.technique.length >= 110 ? `${r.technique.trimEnd()}…` : r.technique;
  const breach = r.outcome === "BREACH";
  return (
    <div role="row" className={cn(ROW, "border-b border-line/70 py-2.5", breach && "bg-deny-soft")}>
      <span role="cell" className="num pt-px text-[12px] text-muted">{r.id}</span>
      <span role="cell" className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-ink">{r.name}</span>
        {/* Mobile: technique + rule stack under the name. */}
        <span className="mt-0.5 block text-[13px] leading-snug text-muted md:hidden">{llm ? `“${technique}”` : technique}</span>
        <span className="num mt-1 block truncate text-[11px] text-ink md:hidden" title={r.detail}>
          {RULE_LABEL[r.rule] ?? r.rule}
        </span>
      </span>
      <span role="cell" className="hidden min-w-0 text-[13px] leading-snug text-muted md:block" title={r.technique}>
        <span className="line-clamp-3">{llm ? `“${technique}”` : technique}</span>
      </span>
      <span role="cell" className="hidden min-w-0 md:block">
        <span className="num block truncate text-[12px] text-ink" title={r.rule}>{RULE_LABEL[r.rule] ?? r.rule}</span>
        <span className="num mt-0.5 line-clamp-3 break-words text-[11px] leading-snug text-muted" title={r.detail}>{r.detail}</span>
      </span>
      <span role="cell" className="justify-self-end pt-0.5">
        <OutcomeMark r={r} />
        <span className="sr-only"> — {OUTCOME_SR[r.outcome]}</span>
      </span>
    </div>
  );
}

function Group({ title, note, rows }: { title: string; note: string; rows: AttackResult[] }) {
  if (!rows.length) return null;
  const blocked = rows.filter((r) => r.blocked).length;
  return (
    <div role="rowgroup">
      <div role="row" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-1.5 pt-5">
        <span role="columnheader" className="label text-[10px] text-ink">
          {title} <span className="ml-1.5 text-muted">{note}</span>
        </span>
        <span className="num text-[11px] text-muted">
          {blocked}/{rows.length} blocked
        </span>
      </div>
      {rows.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </div>
  );
}

function PayPalProof({ before, after }: { before?: Snapshot; after?: Snapshot }) {
  const snap = after ?? before ?? {};
  const live = !!snap.authorization_id && snap.authorization_status !== "UNAVAILABLE";
  const api = `GET /v2/checkout/orders/${snap.order_id ?? "…"}`;
  return (
    <div className="border-l-2 border-paypal pl-3">
      <p className="num text-[13px] leading-relaxed text-paypal">
        PayPal · authorization {snap.authorization_status ?? "—"} · captured {usd(before?.captured ?? 0)} → {usd(after?.captured ?? 0)}
        {after?.capture_count != null && (
          <span className="text-muted">
            {" "}· {after.capture_count} capture{after.capture_count === 1 ? "" : "s"}
          </span>
        )}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]">
        {live && snap.authorization_id && <CopyId value={snap.authorization_id} label="PayPal authorization ID" />}
        <code className="num rounded-[2px] border border-line px-1.5 py-0.5 text-[11px] text-muted">{api}</code>
        {!live && <span className="text-muted">no live hold on this mandate — asked anyway, recorded as returned</span>}
      </p>
    </div>
  );
}

const vTone = (v: string) => (v === "DENY" || v === "REFUSED" ? "text-deny" : v === "ESCALATE" ? "text-escalate" : v === "ALLOW" || v === "APPROVED" ? "text-allow" : "text-muted");

/** The policy's own boundary, probed case by case: each clause just inside and just outside its line. */
export function CrashMatrix({ t, bare = false }: { t: CrashTest; bare?: boolean }) {
  const cases = Array.isArray(t.cases) ? t.cases : [];
  if (!cases.length) return null;
  const groups = cases.reduce<Record<string, typeof cases>>((a, c) => ((a[c.clause || "Policy"] ??= []).push(c), a), {});
  const all = t.held === t.total;
  return (
    <div className={bare ? "" : "px-4 pb-5 sm:px-6"}>
      <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-1.5", bare ? "pt-1" : "pt-5")}>
        <span className="label text-[10px] text-ink">
          {bare ? "Boundary matrix" : "Crash test"} <span className="ml-1.5 text-muted">{bare ? "grouped by clause" : "this policy\u2019s boundary, case by case"}</span>
        </span>
        <span className={cn("num text-[11px]", all ? "text-ink" : "text-deny")}>
          {t.held}/{t.total} held
        </span>
      </div>
      <div role="table" aria-label="Crash test" className="grid gap-x-8 md:grid-cols-2">
        {Object.entries(groups).map(([clause, cs]) => (
          <div key={clause} role="rowgroup" className="min-w-0">
            <p role="row" className="label border-b border-line pb-1 pt-3 text-[9px] text-muted">
              <span role="columnheader">{clause}</span>
            </p>
            {cs.map((c) => (
              <div key={c.id} role="row" className="num grid grid-cols-[1.25ch_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-line/60 py-1 text-[12px]">
                <span role="cell" className={c.held ? "text-ink" : "text-deny"} aria-label={c.held ? "held" : "did not hold"}>
                  {c.held ? "✓" : "✗"}
                </span>
                <span role="cell" className="min-w-0 break-words text-ink md:truncate" title={`${c.case} — expected ${c.expected}${c.rule ? ` · ${c.rule}` : ""}`}>
                  {c.case}
                </span>
                <span role="cell" className="shrink-0 text-right">
                  <span className={vTone(c.verdict)}>{c.verdict}</span>
                  {c.expected && c.expected !== c.verdict && <span className="text-muted"> · expected {c.expected}</span>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificateLine({ c, rootId }: { c: Certificate; rootId: string }) {
  if (!c.url && !c.sha256) return null;
  const sha = c.sha256?.replace(/^0x/, "") ?? null;
  const passed = c.result === "PASSED";
  return (
    <div className="border-t border-ink bg-surface-2/50 px-4 py-5 sm:px-6">
      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-8">
        {sha ? <Seal hash={sha} size={96} label="WRIT · ASSURANCE" animate /> : null}
        <div className="min-w-0">
          <p className="label text-[10px] text-muted">Assurance certificate{c.id && <span className="num ml-2 normal-case tracking-normal text-ink">№ {c.id}</span>}</p>
          <p className="display mt-2 text-[1.5rem] leading-tight text-ink">
            This exact mandate was attacked{c.result ? <>, and it <em>{passed ? "held" : "did not hold"}</em>.</> : "."}
          </p>
          <p className="num mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-muted">
            {c.result && (
              <span className={cn("label rounded-[2px] border px-1.5 py-[3px] text-[10px]", passed ? "border-allow/60 text-allow" : "border-deny/60 text-deny")}>
                {c.result}
              </span>
            )}
            {sha && (
              <span>
                Ed25519-signed <span className="text-ink">#{sha.slice(0, 8)}</span> · verifiable offline with the embedded key
              </span>
            )}
          </p>
        </div>
        <p className="flex gap-2 text-[13px] sm:flex-col sm:items-stretch">
          {c.url && (
            <a
              href={`${c.url}${c.url.includes("?") ? "&" : "?"}download`}
              download
              className="inline-flex min-h-11 items-center justify-center bg-ink px-4 font-medium text-on-accent hover:bg-ink/90"
            >
              Download
            </a>
          )}
          <a
            href={c.url ?? `/verify?mandate=${encodeURIComponent(rootId)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center border border-ink px-4 font-medium text-ink hover:bg-surface"
          >
            Verify
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * The signature proof. A compromised agent was given real authority and told to steal;
 * this is what the rules — and PayPal itself — say happened. Reads in one second:
 * N/N blocked · $0.00 moved · PayPal before → after.
 */
export function Scorecard({ e, s, children }: { e: Ev; s: SC; children?: React.ReactNode }) {
  const harness = s.results.filter((r) => r.by === "harness");
  const llm = s.results.filter((r) => r.by === "adversary-llm");
  const clean = s.breaches === 0;
  const took = duration(s.paypal.before?.fetched_at, s.paypal.after?.fetched_at);
  return (
    <section id="redteam-scorecard" aria-labelledby={`sc-${e.id}`} className="scroll-mt-24 border border-ink bg-surface shadow-paper">
      <div aria-hidden className="lathe mx-3 mt-3 h-[16px] text-ink/85 sm:mx-4" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2 sm:px-6">
        <span className="label text-[10px] text-ink">Red-team scorecard<span className="hidden sm:inline"> · signed sub-mandate · real tool paths</span></span>
        <span className="label text-[10px] text-muted">
          {hhmmss(e.ts)}
          {took && <> · ran {took}</>}
          {s.redTeamMandateId && (
            <>
              {" "}·{" "}
              <Link href={`/m/${s.redTeamMandateId}`} className="num normal-case tracking-normal text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                № {s.redTeamMandateId}
              </Link>
            </>
          )}
        </span>
      </div>

      {!clean && (
        <div role="alert" className="border-b border-deny bg-deny px-4 py-3 text-on-accent sm:px-6">
          <p className="label text-[11px]">Breach · {s.breaches} attempt{s.breaches === 1 ? "" : "s"} not blocked</p>
          <p className="mt-1 text-[14px] leading-snug">The rows marked BREACH below got past the policy engine. Check them before trusting this mandate.</p>
        </div>
      )}

      <div className="grid gap-x-10 gap-y-6 px-4 pb-6 pt-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h2 id={`sc-${e.id}`} className="sr-only">
            Red-team scorecard: {s.blocked} of {s.attempts} attacks blocked, {usd(s.moved)} moved
          </h2>
          <dl className="flex flex-wrap items-end gap-x-5 gap-y-4 sm:gap-x-8" aria-hidden>
            <div className="min-w-0">
              <dt className="label text-[10px] text-muted">Attacks blocked</dt>
              <dd className="num mt-2 text-[3rem] font-medium leading-[0.9] tracking-[-0.04em] text-ink sm:text-[5rem]">
                {s.blocked}
                <span className="text-muted">/{s.attempts}</span>
              </dd>
            </div>
            <div className="min-w-0 border-l border-line pl-5 sm:pl-8">
              <dt className="label text-[10px] text-muted">Money moved</dt>
              <dd className={cn("num mt-2 text-[2rem] font-medium leading-[0.9] tracking-[-0.03em] sm:text-[3.25rem]", s.moved > 0 ? "text-deny" : "text-ink")}>
                {usd(s.moved)}
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <PayPalProof before={s.paypal.before} after={s.paypal.after} />
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end md:justify-between">
          {clean ? (
            <div className="flex flex-col items-start gap-2 md:items-end">
              <Punch text="0 BREACHES" dot={5} tone="ink" animate label="Zero breaches" className="hidden sm:block" />
              <Punch text="0 BREACHES" dot={3} tone="ink" animate label="Zero breaches" className="sm:hidden" />
              <span className="label text-[10px] text-muted">Every attempt stopped by code</span>
            </div>
          ) : (
            <Stamp verdict="DENY" size="lg" animate rotate={-5} className="px-4 text-[2.25rem] sm:text-5xl">
              Breach
            </Stamp>
          )}
          <p className="display max-w-[17rem] text-[1.35rem] italic leading-snug text-ink md:text-right">
            The AI was told to steal. The rules didn&rsquo;t move.
          </p>
        </div>
      </div>

      <div role="table" aria-label="Attacks attempted" className="px-4 pb-5 sm:px-6">
        <div role="row" className={cn(ROW, "hidden border-y border-line py-1.5 md:grid")}>
          {["#", "Attack", "Technique", "Enforced by", "Outcome"].map((h, i) => (
            <span key={h} role="columnheader" className={cn("label text-[9px] text-muted", i === 4 && "text-right")}>
              {h}
            </span>
          ))}
        </div>
        <Group title="Scripted attacks" note="harness · deterministic" rows={harness} />
        <Group title="Adversarial AI" note="an LLM told to break the rules · in its own words" rows={llm} />
      </div>
      {s.crashTest && <CrashMatrix t={s.crashTest} />}
      {s.certificate && <CertificateLine c={s.certificate} rootId={e.mandateId} />}
      {children}
    </section>
  );
}
