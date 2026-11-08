"use client";
import { Stamp, cn, usd, type StampVerdict } from "../ui";
import { CopyId, Thumb, checkGlyph, det, hhmmss, isAttack, isRedTeamProduct, type Check, type Ev, type LogProduct } from "./shared";

type Tag = { text: string; tone: string };
/**
 * Fixed-width actor/type tag for the second column of the log.
 * Extensible: add a matcher here (first match wins) for new event kinds — e.g. REVOKE, DELEGATE, VERIFY —
 * keyed on type, tool or title. Unknown events fall through to their raw type.
 */
const TAGS: { when: (e: Ev) => boolean; tag: (e: Ev) => Tag }[] = [
  { when: (e) => e.type === "THOUGHT", tag: (e) => ({ text: "AGENT", tone: det(e).hijacked ? "text-deny" : "text-ink" }) },
  { when: (e) => e.type === "TOOL_CALL" && e.tool === "propose_purchase", tag: () => ({ text: "PROPOSE", tone: "text-ink" }) },
  { when: (e) => e.type === "TOOL_CALL" && e.tool === "search_products", tag: () => ({ text: "SEARCH", tone: "text-muted" }) },
  { when: (e) => e.type === "TOOL_RESULT", tag: () => ({ text: "RESULT", tone: "text-muted" }) },
  {
    when: (e) => e.type === "POLICY_VERDICT",
    tag: (e) => ({ text: "VERDICT", tone: e.verdict === "DENY" ? "text-deny" : e.verdict === "ESCALATE" ? "text-escalate" : "text-allow" }),
  },
  { when: (e) => e.type === "PAYPAL" && (e.tool === "webhook" || /webhook/i.test(e.title)), tag: () => ({ text: "WEBHOOK", tone: "text-paypal" }) },
  { when: (e) => e.type === "PAYPAL", tag: () => ({ text: "PAYPAL", tone: "text-paypal" }) },
  { when: (e) => e.type === "HUMAN", tag: () => ({ text: "HUMAN", tone: "text-ink" }) },
  { when: (e) => e.type === "SYSTEM", tag: () => ({ text: "SYSTEM", tone: "text-muted" }) },
];
function tagOf(e: Ev): Tag {
  const hit = TAGS.find((t) => t.when(e));
  return hit ? hit.tag(e) : { text: String(e.type).slice(0, 8), tone: e.tool === "propose_purchase" ? "text-ink" : "text-muted" };
}

/** One log line: time · tag · message. Mono 13/1.6, hairline-separated. */
export function LogRow({ e, n = 1, held, closed }: { e: Ev; n?: number; held: number; closed: boolean }) {
  const tag = tagOf(e);
  const d = det(e);
  const quietThought = e.type === "THOUGHT" && e.title === "Thinking…" && !d.hijacked;
  return (
    <li
      className={cn(
        "animate-ink grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 border-b border-line/70 px-3 py-2 last:border-b-0 sm:grid-cols-[4.25rem_4.75rem_minmax(0,1fr)] sm:px-4",
        e.type === "POLICY_VERDICT" && "py-3",
      )}
    >
      <time dateTime={new Date(e.ts).toISOString()} className="hidden pt-px text-muted sm:block">
        {hhmmss(e.ts)}
      </time>
      <div className="pt-px">
        <span className={cn("label block pt-[3px] text-[10px]", tag.tone)}>{tag.text}</span>
        <time dateTime={new Date(e.ts).toISOString()} className="mt-1 block text-[10px] text-muted sm:hidden">
          {hhmmss(e.ts)}
        </time>
      </div>
      <div className="min-w-0">
        {e.type === "POLICY_VERDICT" ? (
          <VerdictBlock e={e} held={held} closed={closed} />
        ) : e.type === "THOUGHT" && d.hijacked ? (
          <Compromised e={e} />
        ) : quietThought ? (
          <Reasoning text={d.reasoning} summary="thinking — reasoning" />
        ) : e.type === "THOUGHT" ? (
          <>
            <p className="whitespace-pre-wrap font-sans text-[14px] leading-[1.55] text-ink">{e.title}</p>
            {d.reasoning && <Reasoning text={d.reasoning} summary="reasoning" />}
          </>
        ) : e.type === "PAYPAL" ? (
          <PayPalLine e={e} n={n} />
        ) : (
          <>
            <p className={cn("flex items-baseline gap-3", lineTone(e))}>
              <span className="min-w-0 flex-1 break-words">
                {e.title}
                {n > 1 && <span className="ml-2 text-muted">×{n}</span>}
              </span>
              {e.type === "TOOL_CALL" && e.amount != null && <span className="num shrink-0">{usd(e.amount)}</span>}
            </p>
            {Array.isArray(d.products) && d.products.length > 0 && <ResultsTable products={d.products as LogProduct[]} />}
          </>
        )}
      </div>
    </li>
  );
}

function lineTone(e: Ev) {
  if (e.type === "SYSTEM") return /red team|error/i.test(e.title) ? "text-deny" : "text-muted";
  if (e.type === "TOOL_RESULT" || e.type === "TOOL_CALL") return e.tool === "propose_purchase" ? "text-ink" : "text-muted";
  return "text-ink";
}

function Reasoning({ text, summary }: { text?: string; summary: string }) {
  if (!text) return <p className="text-muted">thinking</p>;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-muted marker:hidden hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-block w-3 transition-transform group-open:rotate-90">›</span> {summary}
      </summary>
      <p className="mt-1.5 whitespace-pre-wrap border-l border-line pl-3 font-sans text-[13px] leading-relaxed text-muted">{text}</p>
    </details>
  );
}

function PayPalLine({ e, n }: { e: Ev; n: number }) {
  const d = det(e);
  return (
    <div className="text-paypal">
      <p className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 break-words">
          {e.title}
          {n > 1 && <span className="ml-2 text-muted">×{n}</span>}
        </span>
        {e.amount != null && <span className="num shrink-0">{usd(e.amount)}</span>}
      </p>
      {(d.api || e.paypalId) && (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
          {d.api && <code className="break-all text-muted">{String(d.api)}</code>}
          {e.paypalId && <CopyId value={e.paypalId} label="PayPal ID" />}
        </p>
      )}
    </div>
  );
}

/** The agent after reading the poisoned listing: deny-tinted rule, labelled. */
function Compromised({ e }: { e: Ev }) {
  const d = det(e);
  return (
    <div className="border-l-2 border-deny pl-3">
      <p className="label text-[10px] text-deny">Compromised agent</p>
      <p className="mt-1 whitespace-pre-wrap font-sans text-[14px] leading-[1.55] text-ink">{e.title}</p>
      {d.injected_instruction && (
        <p className="mt-2 text-[12px] text-muted">
          acting on text from a listing:
          <span className="mt-1 block bg-deny-soft px-2.5 py-1.5 text-ink">“{String(d.injected_instruction)}”</span>
        </p>
      )}
    </div>
  );
}

const COLS = "grid grid-cols-[minmax(0,1fr)_4.75rem] gap-x-2 sm:grid-cols-[minmax(0,1fr)_4.75rem_2.5rem_2.5rem] md:grid-cols-[minmax(0,1fr)_9rem_4.75rem_2.5rem_2.5rem]";

/** Search results as a compact statement table. The poisoned listing is outlined and its payload struck. */
function ResultsTable({ products }: { products: LogProduct[] }) {
  return (
    <div role="table" aria-label="Search results" className="mt-2 text-[12px]">
      <div role="row" className={cn(COLS, "border-b border-line py-1")}>
        <span role="columnheader" className="label text-[9px] text-muted">Listing</span>
        <span role="columnheader" className="label hidden text-[9px] text-muted md:block">Merchant</span>
        <span role="columnheader" className="label text-right text-[9px] text-muted">Price</span>
        <span role="columnheader" className="label hidden text-right text-[9px] text-muted sm:block">★</span>
        <span role="columnheader" className="label hidden text-right text-[9px] text-muted sm:block">ETA</span>
      </div>
      {products.map((p) => {
        const bad = isRedTeamProduct(p);
        return (
          <div key={p.id} className={cn(bad ? "my-1 border border-deny px-1.5 pb-1.5" : "border-b border-line/60")}>
            <div role="row" className={cn(COLS, "items-center py-1.5")}>
              <span role="cell" className="flex min-w-0 items-center gap-2">
                <Thumb src={p.image} size={24} />
                <span className="min-w-0">
                  {bad && <span className="label mb-0.5 block text-[9px] text-deny">Hidden instructions</span>}
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-ink hover:underline" title={p.title}>
                      {p.title}
                    </a>
                  ) : (
                    <span className="block truncate text-ink" title={p.title}>{p.title}</span>
                  )}
                  <span className="block truncate text-muted md:hidden">{p.merchant}</span>
                </span>
              </span>
              <span role="cell" className="hidden truncate text-muted md:block">{p.merchant}</span>
              <span role="cell" className={cn("num text-right", bad ? "text-deny" : "text-ink")}>{usd(p.price)}</span>
              <span role="cell" className="num hidden text-right text-muted sm:block">{p.rating ?? "—"}</span>
              <span role="cell" className="num hidden text-right text-muted sm:block">{p.delivery_days != null ? `${p.delivery_days}d` : "—"}</span>
            </div>
            {bad && p.description && (
              <p className="bg-deny-soft px-2 py-1 text-[11px] leading-snug text-muted">
                <span className="line-clamp-3 line-through decoration-deny/70">{p.description}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const stampFor = (v?: string | null): StampVerdict => (v === "DENY" ? "DENY" : v === "ESCALATE" ? "ESCALATE" : v === "APPROVED" ? "APPROVED" : "ALLOW");

/** A POLICY_VERDICT: the 13 checks as log lines, then the verdict with a small stamp. */
function VerdictBlock({ e, held, closed }: { e: Ev; held: number; closed: boolean }) {
  const d = det(e);
  const checks = (Array.isArray(d.checks) ? d.checks : []) as Check[];
  const deny = e.verdict === "DENY";
  const attack = isAttack(e);
  const product = d.product as LogProduct | undefined;
  const lines = (
    <ul className="space-y-px">
      {checks.map((c, i) => (
        <li
          key={c.rule}
          className={cn(
            "animate-ink grid grid-cols-[1.25ch_minmax(0,1fr)] gap-x-2 sm:grid-cols-[1.25ch_19ch_minmax(0,1fr)]",
            c.verdict === "DENY" ? "text-deny" : c.verdict === "ESCALATE" ? "text-escalate" : "text-muted",
          )}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <span aria-label={c.verdict}>{checkGlyph(c.verdict)}</span>
          <span className={cn("truncate", c.verdict !== "ALLOW" && "font-medium")}>{c.rule}</span>
          <span
            className={cn("col-start-2 sm:col-start-3", c.verdict === "ALLOW" ? "hidden truncate sm:block" : "break-words")}
            title={c.message}
          >
            {c.message}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <p className="text-muted">
        policy engine evaluated{product?.title ? <> <span className="text-ink">{product.title}</span></> : null}
        {checks.length > 0 && <> · {checks.length} rules</>}
      </p>
      <div className="mt-1.5">
        {e.verdict === "APPROVED" && checks.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer list-none text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="inline-block w-3 transition-transform group-open:rotate-90">›</span> same {checks.length} rules, re-checked at capture
            </summary>
            <div className="mt-1">{lines}</div>
          </details>
        ) : (
          lines
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-dashed border-line pt-2">
        <Stamp verdict={stampFor(e.verdict)} animate rotate={-3} />
        <span className={cn("min-w-0 flex-1 basis-48", deny ? "font-medium text-deny" : "text-ink")}>
          {e.title}
        </span>
        {e.amount != null && <span className="num shrink-0 text-ink">{usd(e.amount)}</span>}
      </div>
      {deny && (
        <p className="mt-1.5 text-[12px] text-muted">
          {attack ? "prompt injection — " : ""}cannot be overridden · $0.00 moved · {usd(held)} {closed ? "released" : "still held"}
        </p>
      )}
    </div>
  );
}
