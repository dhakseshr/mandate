"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Badge, Button, Stamp, cn, usd } from "../ui";
import { CopyId, checkGlyph } from "../log/shared";
import { splitInjection } from "../tab/tab-panel";

type Kind =
  | "INTENT" | "HUMAN_SIGNATURE" | "MANDATE_SEAL" | "DELEGATION" | "LISTING" | "AGENT_DECISION" | "POLICY_CHECKS"
  | "MERCHANT_RECEIPT" | "PAYMENT" | "PROVIDER_RESPONSE" | "FULFILMENT" | "WEBHOOK" | "COMPLAINT" | "REFUND";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- facts are free-form JSON from the ledger
type Facts = Record<string, any>;
type Node = { id: string; kind: Kind; title: string; at: string | null; facts: Facts; source: string };
type Det = { check: string; result: "PASS" | "FAIL" | "UNKNOWN"; detail: string; evidence: string[] };
type Responsible = "AGENT_DEVIATED_FROM_MANDATE" | "MERCHANT_OR_PROVIDER_FAULT" | "AUTHORIZED_AND_AS_DESCRIBED" | "INSUFFICIENT_EVIDENCE";
type Action = "REFUND_FULL" | "OPEN_DISPUTE" | "NO_ACTION";
type Report = {
  id: string;
  summary: string;
  findings: { claim: string; evidence: string[]; points_to: "AGENT" | "MERCHANT_OR_PROVIDER" | "HUMAN_INSTRUCTION" | "NONE" }[];
  responsible: Responsible;
  recommended_action: Action;
  confidence: string;
  missing_evidence: string[];
  dropped_uncited: number;
  deterministic: Det[];
};
type Data = {
  purchase: { id: string; amount: number; status: string; merchant: string; capture_id: string | null; mandate_id: string };
  root: { id: string; sha256: string | null };
  nodes: Node[];
  findings: Det[];
  report: Report | null;
};
type Resolution = {
  action: Action;
  refund?: { refundId?: string; via?: string };
  evidence_pack?: { pack: unknown; proof: { sha256: string; signature: string; public_key_pem: string } };
};

const HUMAN: Kind[] = ["INTENT", "HUMAN_SIGNATURE", "COMPLAINT"];
const PAYPAL: Kind[] = ["PAYMENT", "WEBHOOK", "REFUND"];

const RESPONSIBLE: Record<Responsible, { text: string; verdict: "ALLOW" | "DENY" | "ESCALATE" }> = {
  AGENT_DEVIATED_FROM_MANDATE: { text: "Agent deviated from the mandate", verdict: "DENY" },
  MERCHANT_OR_PROVIDER_FAULT: { text: "Merchant / provider at fault", verdict: "DENY" },
  AUTHORIZED_AND_AS_DESCRIBED: { text: "Authorized and as described", verdict: "ALLOW" },
  INSUFFICIENT_EVIDENCE: { text: "Insufficient evidence", verdict: "ESCALATE" },
};
const POINTS: Record<string, string> = { AGENT: "agent", MERCHANT_OR_PROVIDER: "merchant / provider", HUMAN_INSTRUCTION: "your instruction", NONE: "no one" };
const ACTION: Record<Action, string> = { REFUND_FULL: "Refund", OPEN_DISPUTE: "Prepare dispute pack", NO_ACTION: "No action" };

/** PASS / FAIL / UNKNOWN as a stamp. Verdict word always printed; UNKNOWN is ink, not a color. */
function ResultStamp({ r }: { r: "PASS" | "FAIL" | "UNKNOWN" }) {
  if (r === "PASS") return <Stamp verdict="ALLOW" rotate={-3}>Pass</Stamp>;
  if (r === "FAIL") return <Stamp verdict="DENY" rotate={-3}>Fail</Stamp>;
  return <Stamp verdict="APPROVED" rotate={-3} className="border-ink/60 text-muted">Unknown</Stamp>;
}

/** Map the deterministic checks onto the three questions a human actually asks. */
function questions(findings: Det[]) {
  const pick = (re: RegExp) => findings.find((f) => re.test(f.check));
  return [
    { q: "Authorized?", f: pick(/authori[sz]ed|signed mandate/i) },
    { q: "Agent followed the instruction?", f: pick(/agent|instruction|pick/i) },
    { q: "Merchant / provider delivered?", f: pick(/provider|merchant|deliver|response|listing|fulfil|as described/i) },
  ];
}

export function ForensicsView({ purchaseId }: { purchaseId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [graph, setGraph] = useState<Node[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [complaint, setComplaint] = useState("");
  const [busy, setBusy] = useState(false);
  const [invErr, setInvErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/purchases/${purchaseId}/forensics`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Purchase not found");
    setData(j);
  }, [purchaseId]);
  useEffect(() => {
    void load();
  }, [load]);

  // The report was investigated against the graph *with* the complaint node; recover that graph from the ledger.
  const reportId = data?.report?.id;
  const mandateId = data?.purchase.mandate_id;
  useEffect(() => {
    if (!reportId || !mandateId) return;
    let live = true;
    fetch(`/api/mandates/${mandateId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        const ev = (v?.events ?? []).find(
          (e: { tool?: string; rule?: string; detail?: { report?: { id?: string } } }) => e.tool === "forensics" && e.rule === "FORENSICS" && e.detail?.report?.id === reportId,
        );
        const nodes = ev?.detail?.evidence?.nodes as Node[] | undefined;
        if (live && nodes?.length) setGraph(nodes);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [reportId, mandateId]);

  const nodes = useMemo(() => {
    const base = data?.nodes ?? [];
    return graph && graph.length >= base.length ? graph : base;
  }, [data, graph]);
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  function jump(id: string) {
    const el = document.getElementById(`ev-${id}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setFocus(id);
    window.setTimeout(() => setFocus((f) => (f === id ? null : f)), 2400);
  }

  async function investigate() {
    setBusy(true);
    setInvErr(null);
    const r = await fetch(`/api/purchases/${purchaseId}/forensics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ complaint }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setInvErr(j.error ?? "The investigation couldn't run.");
    else {
      setGraph(null);
      setData((d) => (d ? { ...d, report: j } : d));
    }
    setBusy(false);
  }

  if (err)
    return (
      <div className="mx-auto max-w-[560px] border border-line bg-surface px-5 py-6">
        <span className="label">Writ Forensics</span>
        <h1 className="display mt-3 text-3xl leading-tight">No purchase on file under № {purchaseId}.</h1>
        <p className="mt-2 text-[15px] text-muted">{err}</p>
      </div>
    );
  if (!data)
    return (
      <p className="label flex items-center gap-2 py-24 text-muted" role="status">
        Assembling evidence for <span className="num normal-case tracking-normal text-ink">№ {purchaseId}</span>
        <span className="caret" />
      </p>
    );

  const { purchase, report } = data;
  const det = report?.deterministic?.length ? report.deterministic : data.findings;
  const qs = questions(det);
  const listing = nodes.find((n) => n.kind === "LISTING");
  const tab = purchase.id.startsWith("tab_");

  return (
    <div className="min-w-0">
      <header className="pb-8 pt-2 sm:pt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="label">Writ Forensics · {tab ? "API call" : "purchase"} <span className="num normal-case tracking-normal text-ink">№ {purchase.id}</span></span>
          <Link href={`/m/${purchase.mandate_id}`} className="label text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            ← Mandate <span className="num normal-case tracking-normal">№ {purchase.mandate_id}</span>
          </Link>
        </div>
        <h1 className="display mt-5 max-w-[48rem] text-balance text-[2.25rem] leading-[1.04] tracking-[-0.025em] text-ink sm:text-[3.25rem]">
          An authorized payment isn&apos;t the same as a correct one.
        </h1>
        <p className="num mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="text-ink">{listing?.facts.title ?? purchase.merchant}</span>
          <span>·</span>
          <span>{purchase.merchant}{tab ? " (simulated provider)" : ""}</span>
          <span>·</span>
          <span className="text-ink">{usd(purchase.amount)}</span>
          <span>·</span>
          <span className={purchase.status === "REFUNDED" ? "text-muted" : "text-paypal"}>{purchase.status}</span>
        </p>
      </header>

      {/* The three questions */}
      <section aria-labelledby="q-h" className="border border-ink/80 bg-surface shadow-paper">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
          <h2 id="q-h" className="label text-ink">Three questions · checked by code</h2>
          <span className="label text-muted">{det.length} deterministic checks</span>
        </div>
        <dl>
          {qs.map(({ q, f }) => (
            <div key={q} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:grid-cols-[16rem_minmax(0,1fr)_auto] sm:px-5">
              <dt className="display text-[1.2rem] leading-tight text-ink">{q}</dt>
              <dd className="col-start-1 row-start-2 min-w-0 text-[13px] leading-snug text-muted sm:col-start-2 sm:row-start-1">
                {f ? (
                  <>
                    {f.detail}
                    <EvidenceChips ids={f.evidence} known={ids} onJump={jump} className="mt-1.5" />
                  </>
                ) : (
                  "No check on file for this question."
                )}
              </dd>
              <dd className="col-start-2 row-span-2 row-start-1 justify-self-end sm:col-start-3 sm:row-span-1">
                <ResultStamp r={f?.result ?? "UNKNOWN"} />
              </dd>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 bg-surface-2 px-4 py-3 sm:grid-cols-[16rem_minmax(0,1fr)_auto] sm:px-5">
            <dt className="label text-[10px] text-ink">Responsible</dt>
            <dd className="col-start-1 row-start-2 min-w-0 text-[13px] text-muted sm:col-start-2 sm:row-start-1">
              {report ? (
                <>
                  <span className="font-medium text-ink">{RESPONSIBLE[report.responsible]?.text ?? report.responsible}</span> · confidence{" "}
                  <span className="num text-ink">{report.confidence}</span>
                </>
              ) : (
                "Not investigated yet — describe the problem below."
              )}
            </dd>
            <dd className="col-start-2 row-span-2 row-start-1 justify-self-end sm:col-start-3 sm:row-span-1">
              {report ? (
                <Stamp verdict={RESPONSIBLE[report.responsible]?.verdict ?? "ESCALATE"} rotate={-3}>
                  {report.responsible === "AUTHORIZED_AND_AS_DESCRIBED" ? "As described" : report.responsible === "INSUFFICIENT_EVIDENCE" ? "Unclear" : "At fault"}
                </Stamp>
              ) : (
                <span className="label text-[10px] text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* EVIDENCE GRAPH */}
        <section aria-labelledby="graph-h" className="min-w-0 lg:col-span-7">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="graph-h" className="label text-ink">Evidence graph</h2>
            <span className="label text-muted">{nodes.length} records · sealed #{(data.root.sha256 ?? "").slice(0, 8)}</span>
          </div>
          <ol className="evidence-chain mt-4 space-y-4">
            {nodes.map((n, i) => (
              <EvidenceCard key={n.id} n={n} focused={focus === n.id} delay={i} />
            ))}
          </ol>
        </section>

        {/* REPORT */}
        <aside className="min-w-0 space-y-4 lg:col-span-5">
          {report && <Findings report={report} known={ids} onJump={jump} />}

          <section aria-labelledby="complaint-h" className="border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <label id="complaint-h" htmlFor="complaint" className="label text-[10px] text-ink">
                {report ? "Investigate again" : "What went wrong — in your words"}
              </label>
              <span className="label text-[10px] text-muted">recommends, never acts</span>
            </div>
            <textarea
              id="complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="The market data looks wrong, and something told my agent to buy more."
              className="ruled ruled-field display block w-full resize-none bg-transparent px-4 pb-1 text-[1.1rem] italic text-ink outline-none placeholder:text-muted"
            />
            <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-snug text-muted" aria-live="polite">
                {busy ? (
                  <>
                    Reading E1–E{nodes.length + 1} against your words<span className="caret ml-1" aria-hidden />
                  </>
                ) : (
                  "Every claim must cite evidence; code drops the ones that don't."
                )}
              </p>
              <Button className="min-h-11 shrink-0" disabled={busy || complaint.trim().length < 3} onClick={investigate}>
                {busy ? "Investigating…" : "Investigate"}
              </Button>
            </div>
            {invErr && <p className="num border-t border-deny/40 bg-deny-soft px-4 py-2 text-[12px] text-deny">✗ {invErr}</p>}
          </section>

          {report && <Recommendation key={report.id} report={report} purchase={purchase} onDone={load} />}
        </aside>
      </div>
    </div>
  );
}

function EvidenceChips({ ids, known, onJump, className }: { ids: string[]; known: Set<string>; onJump: (id: string) => void; className?: string }) {
  if (!ids?.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {ids.map((id) =>
        known.has(id) ? (
          <button
            key={id}
            type="button"
            onClick={() => onJump(id)}
            className="num inline-flex min-h-8 min-w-11 items-center justify-center rounded-[2px] border border-ink/40 bg-surface px-1.5 text-[11px] text-ink hover:border-ink hover:bg-surface-2"
            aria-label={`Show evidence ${id}`}
          >
            {id}
          </button>
        ) : (
          <span key={id} title="Not in the evidence graph on file" className="num inline-flex min-h-8 items-center rounded-[2px] border border-dashed border-line px-1.5 text-[11px] text-muted line-through">
            {id}
          </span>
        ),
      )}
    </span>
  );
}

function EvidenceCard({ n, focused, delay }: { n: Node; focused: boolean; delay: number }) {
  const human = HUMAN.includes(n.kind);
  const paypal = PAYPAL.includes(n.kind);
  return (
    <li id={`ev-${n.id}`} className="animate-ink relative grid scroll-mt-24 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3" style={{ animationDelay: `${Math.min(delay, 10) * 40}ms` }}>
      <span
        className={cn(
          "num relative z-[1] grid h-9 w-9 place-items-center border bg-bg text-[12px] font-medium",
          paypal ? "border-paypal text-paypal" : human ? "border-ink text-ink" : "border-line text-muted",
        )}
      >
        {n.id}
      </span>
      <article
        className={cn(
          "min-w-0 border",
          human ? "bg-surface shadow-paper border-line" : paypal ? "border-paypal/60 bg-surface" : "border-line bg-surface-2",
          focused && "evidence-target",
        )}
        aria-label={`${n.id} ${n.title}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-3 py-2">
          <span className={cn("label text-[10px]", paypal ? "text-paypal" : human ? "text-ink" : "text-muted")}>{n.kind.replace(/_/g, " ")}</span>
          {n.at && <time className="num text-[11px] text-muted" dateTime={n.at}>{new Date(n.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</time>}
        </div>
        <div className="px-3 py-2.5">
          <h3 className={cn(human ? "display text-[1.15rem] leading-snug text-ink" : "text-[14px] font-medium text-ink", paypal && "text-paypal")}>{n.title}</h3>
          <Facts n={n} />
          <p className="num mt-2 truncate text-[10px] text-muted" title={n.source}>source · {n.source}</p>
        </div>
      </article>
    </li>
  );
}

const isScalar = (v: unknown) => v == null || ["string", "number", "boolean"].includes(typeof v);
const fmt = (k: string, v: unknown) =>
  v == null ? "—" : typeof v === "number" && /amount|price|budget|spent|total|line/.test(k) ? usd(v) : typeof v === "boolean" ? (v ? "yes" : "no") : String(v);

function Facts({ n }: { n: Node }) {
  const f = n.facts ?? {};
  const human = HUMAN.includes(n.kind);
  const paypal = PAYPAL.includes(n.kind);
  // The human's own words: serif italic.
  const words = n.kind === "INTENT" ? f.instruction : n.kind === "COMPLAINT" ? f.complaint : null;
  const entries = Object.entries(f).filter(([k]) => !(words && (k === "instruction" || k === "complaint")));
  return (
    <div className="mt-1.5 space-y-2">
      {words && <p className="display text-[1.05rem] italic leading-snug text-ink">“{String(words)}”</p>}
      {n.kind === "PROVIDER_RESPONSE" && typeof f.response === "string" ? <Response text={f.response} /> : null}
      {Array.isArray(f.checks) && (
        <ul className="num space-y-px text-[11px]">
          {(f.checks as { rule: string; verdict: string; message: string }[]).map((c) => (
            <li key={c.rule} className={cn("grid grid-cols-[1.25ch_15ch_minmax(0,1fr)] gap-x-2", c.verdict === "DENY" ? "text-deny" : c.verdict === "ESCALATE" ? "text-escalate" : "text-muted")}>
              <span aria-label={c.verdict}>{checkGlyph(c.verdict)}</span>
              <span className="truncate">{c.rule}</span>
              <span className="truncate" title={c.message}>{c.message}</span>
            </li>
          ))}
        </ul>
      )}
      {entries.some(([k, v]) => isScalar(v) && k !== "response") && (
        <dl className="num grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11px]">
          {entries
            .filter(([k, v]) => isScalar(v) && k !== "response")
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="truncate text-muted">{k.replace(/_/g, " ")}</dt>
                <dd className={cn("min-w-0 break-words", paypal && /id$/.test(k) ? "text-paypal" : "text-ink", human && "font-sans")}>
                  {/sha256|_id$/.test(k) && typeof v === "string" && v.length > 20 ? <span title={v}>{v.slice(0, 16)}…</span> : fmt(k, v)}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {entries
        .filter(([k, v]) => !isScalar(v) && k !== "checks")
        .map(([k, v]) =>
          Array.isArray(v) && v.every(isScalar) ? (
            <div key={k} className="text-[11px]">
              <span className="label text-[9px] text-muted">{k.replace(/_/g, " ")}</span>
              <ul className="num mt-0.5 list-none space-y-px text-ink">
                {v.length ? v.map((x, i) => <li key={i} className="break-words">· {String(x)}</li>) : <li className="text-muted">none</li>}
              </ul>
            </div>
          ) : (
            <details key={k} className="group text-[11px]">
              <summary className="num cursor-pointer list-none text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                <span className="inline-block w-3 transition-transform group-open:rotate-90">›</span> {k.replace(/_/g, " ")}
              </summary>
              <pre className="num mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all border border-line bg-surface px-2 py-1.5 text-[10.5px] leading-relaxed text-ink">{JSON.stringify(v, null, 2)}</pre>
            </details>
          ),
        )}
    </div>
  );
}

function Response({ text }: { text: string }) {
  const [clean, injected] = splitInjection(text);
  return (
    <div className={cn("border bg-surface px-2.5 py-2", injected ? "border-deny" : "border-line")}>
      {injected && <span className="label mb-1.5 inline-block border border-deny px-1.5 py-0.5 text-[9px] text-deny">Manipulated data</span>}
      <p className="num whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink">{clean}</p>
      {injected && (
        <p className="num mt-1.5 bg-deny-soft px-1.5 py-1 text-[11px] leading-relaxed text-muted">
          <span className="label mb-1 block text-[9px] text-deny">Injected instruction</span>
          <span className="line-through decoration-deny/70">{injected}</span>
        </p>
      )}
    </div>
  );
}

function Findings({ report, known, onJump }: { report: Report; known: Set<string>; onJump: (id: string) => void }) {
  return (
    <section aria-labelledby="findings-h" className="border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 id="findings-h" className="label text-[10px] text-ink">Findings</h2>
        <span className="label text-[10px] text-muted">report <span className="num normal-case tracking-normal">{report.id}</span></span>
      </div>
      <p className="px-4 pt-3 text-[13px] leading-relaxed text-ink">{report.summary}</p>
      <p className="num px-4 pt-2 text-[11px] text-muted">
        uncited claims dropped by code: <span className={report.dropped_uncited ? "text-deny" : "text-ink"}>{report.dropped_uncited}</span>
      </p>
      <ol className="mt-2">
        {report.findings.map((f, i) => (
          <li key={i} className="border-t border-line px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="num text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <Badge tone={f.points_to === "NONE" ? "neutral" : "accent"} className="shrink-0">points to {POINTS[f.points_to] ?? f.points_to}</Badge>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink">{f.claim}</p>
            <EvidenceChips ids={f.evidence} known={known} onJump={onJump} className="mt-1.5" />
          </li>
        ))}
      </ol>
      {report.missing_evidence?.length > 0 && (
        <div className="border-t border-dashed border-line px-4 py-2.5">
          <span className="label text-[9px] text-muted">Missing evidence</span>
          <ul className="mt-1 space-y-1 text-[12px] leading-snug text-muted">
            {report.missing_evidence.map((m, i) => (
              <li key={i}>— {m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The recommendation as an approval slip: Writ recommends, the human decides. */
function Recommendation({ report, purchase, onDone }: { report: Report; purchase: Data["purchase"]; onDone: () => void }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [result, setResult] = useState<Resolution | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rec = report.recommended_action;
  const headline =
    rec === "REFUND_FULL" ? (
      <>Refund <span className="num text-[1.1rem]">{usd(purchase.amount)}</span></>
    ) : rec === "OPEN_DISPUTE" ? (
      <>Dispute <span className="num text-[1.1rem]">{usd(purchase.amount)}</span> with a signed evidence pack</>
    ) : (
      "No action"
    );

  async function decide(a: Action) {
    setBusy(a);
    setErr(null);
    const r = await fetch(`/api/purchases/${purchase.id}/forensics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolve: a }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? "That decision couldn't be carried out.");
    else setResult(j);
    setBusy(null);
    onDone();
  }
  function download() {
    if (!result?.evidence_pack) return;
    const blob = new Blob([JSON.stringify(result.evidence_pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `writ-evidence-pack-${purchase.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const refundable = purchase.status !== "REFUNDED";

  return (
    <section className="animate-ink border border-escalate bg-surface shadow-paper" aria-labelledby="rec-h">
      <div className="perforation" aria-hidden />
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="label text-[10px] text-escalate">{result ? "Decided by you" : "Your decision"}</p>
          <span className="label text-[10px] text-muted">confidence <span className="num">{report.confidence}</span></span>
        </div>
        <h2 id="rec-h" className="display mt-2 text-[1.35rem] leading-snug text-ink">
          Writ recommends: {headline}
          <span className="text-muted"> — your decision.</span>
        </h2>

        {result ? (
          <div className="mt-3 border-t border-dashed border-line pt-3 text-[12px]">
            {result.action === "REFUND_FULL" && (
              <p className="num flex flex-wrap items-baseline gap-x-2 text-ink">
                <span className="text-allow">✓</span> Refunded {usd(purchase.amount)}
                {result.refund?.refundId && (
                  <>
                    · refund <CopyId value={result.refund.refundId} label="PayPal refund ID" />
                  </>
                )}
                {result.refund?.via && <span className="text-muted">via {result.refund.via}</span>}
              </p>
            )}
            {result.action === "OPEN_DISPUTE" && result.evidence_pack && (
              <div className="space-y-2">
                <p className="num text-ink">
                  <span className="text-allow">✓</span> Signed evidence pack{" "}
                  <span title={result.evidence_pack.proof.sha256}>#{result.evidence_pack.proof.sha256.slice(0, 12)}</span> · Ed25519
                </p>
                <Button variant="ghost" className="min-h-11" onClick={download}>
                  <Download size={14} aria-hidden /> Download evidence pack
                </Button>
              </div>
            )}
            {result.action === "NO_ACTION" && <p className="num text-muted">Closed with no action. The decision is in the ledger.</p>}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(["REFUND_FULL", "OPEN_DISPUTE", "NO_ACTION"] as Action[]).map((a) => (
                <Button
                  key={a}
                  variant={a === rec ? "primary" : "ghost"}
                  className="min-h-11 px-3"
                  disabled={!!busy || (a === "REFUND_FULL" && !refundable)}
                  onClick={() => decide(a)}
                >
                  {busy === a ? "Working…" : a === "REFUND_FULL" ? `Refund ${usd(purchase.amount)}` : ACTION[a]}
                </Button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-muted">
              Nothing happens until you choose. A refund runs through the PayPal Agent Toolkit; a dispute pack is signed so PayPal can verify it.
            </p>
          </>
        )}
        {err && <p className="num mt-2 text-[12px] text-deny">✗ {err}</p>}
      </div>
    </section>
  );
}
