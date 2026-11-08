"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { View } from "../mandate-screen";
import { Stamp, cn, usd } from "../ui";
import { CopyId, det, hhmmss, type Ev } from "../log/shared";

type Purchase = View["purchases"][number];
type Approval = View["approvals"][number];

/** Mirrors lib/tab TAB_SETTLE_AT (server-only module): micro-charges batch into one PayPal capture at $1.00. */
export const TAB_SETTLE_AT = 1.0;

export const isTabPurchase = (p: { id: string }) => p.id.startsWith("tab_");
export const hasTab = (view: Pick<View, "purchases" | "events">) =>
  view.purchases.some(isTabPurchase) || view.events.some((e) => e.tool === "tab");

type Challenge = { provider?: string; resource?: string; price?: { value?: string; currency_code?: string }; nonce?: string; issued_at?: string; expires_at?: string };
type Row = {
  key: string;
  ts: string | Date;
  provider: string;
  resource: string;
  amount: number;
  status: "ACCRUED" | "SETTLED" | "REFUNDED" | "DENIED" | "AWAITING YOU" | "DECLINED";
  purchase?: Purchase;
  challenge?: Challenge;
  signatureValid?: boolean;
  verdict?: Ev;
  paid?: Ev;
};

/** Where an injected instruction starts inside a provider's response (manipulated providers only). */
const INJECT_RE = /(SYSTEM NOTICE|NOTE TO (AI )?AGENTS|IGNORE (ALL |PREVIOUS )|INSTRUCTIONS? TO (AI )?AGENTS)/i;
export function splitInjection(text: string): [string, string | null] {
  const i = text.search(INJECT_RE);
  return i < 0 ? [text, null] : [text.slice(0, i).trimEnd(), text.slice(i)];
}

/** Pair each 402 call with its verdict and its paid receipt; fold in purchases and pending approvals. */
function buildRows(events: Ev[], purchases: Purchase[], approvals: Approval[]): Row[] {
  const tab = events.filter((e) => e.tool === "tab");
  const calls: { call: Ev; verdict?: Ev; paid?: Ev }[] = [];
  for (const e of tab) {
    if (e.type === "TOOL_CALL") calls.push({ call: e });
    else if (e.type === "POLICY_VERDICT") {
      const c = [...calls].reverse().find((x) => !x.verdict && x.call.mandateId === e.mandateId);
      if (c) c.verdict = e;
    }
  }
  const paidByPurchase = new Map<string, Ev>();
  for (const e of tab) if (e.type === "SYSTEM" && det(e).purchase_id) paidByPurchase.set(String(det(e).purchase_id), e);
  const callByNonce = new Map<string, (typeof calls)[number]>();
  for (const c of calls) {
    const n = det(c.call).challenge?.nonce;
    if (n) callByNonce.set(String(n), c);
  }

  const rows: Row[] = [];
  const used = new Set<(typeof calls)[number]>();
  for (const p of purchases.filter(isTabPurchase)) {
    const paid = paidByPurchase.get(p.id);
    const nonce = paid ? det(paid).receipt?.nonce : undefined;
    const c = nonce ? callByNonce.get(String(nonce)) : undefined;
    if (c) used.add(c);
    const ch = (c ? det(c.call).challenge : undefined) as Challenge | undefined;
    rows.push({
      key: p.id,
      ts: paid?.ts ?? c?.call.ts ?? p.createdAt,
      provider: p.merchant,
      resource: p.product.description ?? ch?.resource ?? p.product.title,
      amount: p.amount,
      status: p.status === "SETTLED" || p.status === "REFUNDED" ? p.status : "ACCRUED",
      purchase: p,
      challenge: ch,
      signatureValid: c ? det(c.call).signature_valid !== false : undefined,
      verdict: c?.verdict,
      paid,
    });
  }
  for (const c of calls) {
    if (used.has(c)) continue;
    const d = det(c.call);
    const ch = d.challenge as Challenge | undefined;
    const provider = ch?.provider ?? c.call.merchant ?? "provider";
    const resource = ch?.resource ?? "";
    const v = c.verdict?.verdict;
    let status: Row["status"] | null = null;
    if (v === "DENY" || d.signature_valid === false) status = "DENIED";
    else if (v === "ESCALATE") {
      const pendingA = approvals.some((a) => a.status === "PENDING" && a.product.merchant === provider && a.product.description === resource);
      const paidLater = purchases.some((p) => isTabPurchase(p) && p.merchant === provider && p.product.description === resource);
      status = pendingA ? "AWAITING YOU" : paidLater ? null : "DECLINED";
    }
    if (!status) continue;
    rows.push({ key: c.call.id, ts: c.call.ts, provider, resource, amount: Number(ch?.price?.value ?? c.call.amount ?? 0), status, challenge: ch, signatureValid: d.signature_valid !== false, verdict: c.verdict });
  }
  return rows.sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
}

const STATUS_TONE: Record<Row["status"], string> = {
  ACCRUED: "text-ink",
  SETTLED: "text-paypal",
  REFUNDED: "text-muted",
  DENIED: "text-deny",
  "AWAITING YOU": "text-escalate",
  DECLINED: "text-muted",
};

/** WRIT TAB — agents pay per API call (HTTP 402). Calls accrue on the tab, settle in one PayPal capture. */
export function TabPanel({ view }: { view: View }) {
  const { events, purchases, approvals } = view;
  const rows = useMemo(() => buildRows(events, purchases, approvals), [events, purchases, approvals]);
  const settlements = events.filter((e) => e.tool === "tab" && e.type === "PAYPAL" && e.paypalId);
  const tabP = purchases.filter(isTabPurchase);
  const accrued = tabP.filter((p) => p.status === "ACCRUED").reduce((s, p) => s + p.amount, 0);
  const settled = tabP.filter((p) => p.status === "SETTLED" || (p.status === "REFUNDED" && p.captureId)).reduce((s, p) => s + p.amount, 0);
  const refunded = tabP.filter((p) => p.status === "REFUNDED").reduce((s, p) => s + p.amount, 0);
  const paidCalls = tabP.length;
  const pct = Math.min(100, (accrued / TAB_SETTLE_AT) * 100);

  return (
    <section className="border border-line bg-surface" aria-labelledby="writ-tab-h" id="writ-tab">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
        <h2 id="writ-tab-h" className="label text-[11px] text-ink">
          Writ Tab <span className="ml-2 text-muted">pay-per-call · HTTP 402</span>
        </h2>
        <span className="label text-[10px] text-muted">
          {paidCalls} paid {paidCalls === 1 ? "call" : "calls"} · simulated providers
        </span>
      </header>

      {/* Totals + settlement threshold */}
      <div className="grid gap-4 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-end">
        <dl className="num grid grid-cols-3 gap-x-3 text-[12px]">
          <div className="min-w-0">
            <dt className="label text-[10px] text-muted">On the tab</dt>
            <dd className="mt-1 text-[17px] font-medium text-ink">{usd(accrued)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label text-[10px] text-muted">Settled · PayPal</dt>
            <dd className="mt-1 text-[17px] text-paypal">{usd(settled)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label text-[10px] text-muted">Refunded</dt>
            <dd className="mt-1 text-[17px] text-ink">{usd(refunded)}</dd>
          </div>
        </dl>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label text-[10px] text-muted">Settles at {usd(TAB_SETTLE_AT)} or when the mandate closes</span>
            <span className="num text-[11px] text-ink">
              {usd(accrued)} / {usd(TAB_SETTLE_AT)}
            </span>
          </div>
          <div
            className="mt-1.5 h-3 w-full border border-paypal/50 bg-surface-2"
            role="progressbar"
            aria-label="Tab toward PayPal settlement"
            aria-valuemin={0}
            aria-valuemax={TAB_SETTLE_AT}
            aria-valuenow={Number(accrued.toFixed(2))}
            aria-valuetext={`${usd(accrued)} of ${usd(TAB_SETTLE_AT)}`}
          >
            <span className="stripes block h-full border-r border-paypal" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Running statement */}
      <div role="table" aria-label="Writ Tab statement" className="text-[12px]">
        <div role="row" className="tab-cols hidden border-b border-line bg-surface-2 px-4 py-1.5 sm:grid">
          <span role="columnheader" className="label text-[9px] text-muted">Time</span>
          <span role="columnheader" className="label text-[9px] text-muted">Provider · resource</span>
          <span role="columnheader" className="label text-right text-[9px] text-muted">Amount</span>
          <span role="columnheader" className="label text-[9px] text-muted">Status</span>
          <span role="columnheader" className="label text-[9px] text-muted">Receipt</span>
        </div>
        {rows.length === 0 && <p className="num px-4 py-4 text-muted">No API calls yet.</p>}
        {rows.map((r) => (
          <TabRow key={r.key} r={r} />
        ))}
      </div>

      {settlements.length > 0 && (
        <ul className="border-t-[3px] border-double border-ink">
          {settlements.map((e) => (
            <li key={e.id} className="num flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[12px] last:border-b-0">
              <span className="min-w-0 text-paypal">
                <span className="label mr-2 text-[10px]">Settled</span>
                {Array.isArray(det(e).calls) ? `${det(e).calls.length} calls` : ""} · one PayPal capture
              </span>
              <span className="flex items-baseline gap-3">
                <CopyId value={e.paypalId!} label="PayPal capture ID" />
                <span className="text-ink">{usd(e.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TabRow({ r }: { r: Row }) {
  const [open, setOpen] = useState(false);
  const d = r.paid ? det(r.paid) : {};
  const manipulated = !!d.manipulated_provider;
  const sha = d.receipt_sha256 ? String(d.receipt_sha256) : null;
  const struck = r.status === "REFUNDED" || r.status === "DENIED" || r.status === "DECLINED";
  const id = `tabrow-${r.key}`;
  return (
    <div role="rowgroup" className={cn("border-b border-line last:border-b-0", manipulated && "border-l-2 border-l-deny")}>
      <div role="row" className="tab-cols grid items-baseline gap-y-0.5 px-4 py-2">
        <span role="cell" className="num hidden text-muted sm:block">{hhmmss(r.ts)}</span>
        <span role="cell" className="min-w-0 max-sm:order-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={id}
            className="group flex min-h-11 w-full min-w-0 items-baseline gap-2 text-left sm:min-h-0"
          >
            <span aria-hidden className={cn("num inline-block w-3 shrink-0 text-muted transition-transform", open && "rotate-90")}>›</span>
            <span className="min-w-0">
              <span className="num block truncate text-ink group-hover:underline">{r.provider}</span>
              <span className="block truncate text-muted">“{r.resource}”</span>
            </span>
          </button>
        </span>
        <span role="cell" className={cn("num text-right max-sm:order-2", struck ? "text-muted line-through" : "text-ink")}>{usd(r.amount)}</span>
        <span role="cell" className={cn("label text-[10px] max-sm:order-3 max-sm:pl-5", STATUS_TONE[r.status])}>
          {r.status === "AWAITING YOU" && <span aria-hidden>! </span>}
          {r.status === "DENIED" && <span aria-hidden>✗ </span>}
          {r.status}
        </span>
        <span role="cell" className="num min-w-0 truncate text-muted max-sm:order-4 max-sm:text-right">
          {sha ? <span className="text-ink">#{sha.slice(0, 8)}</span> : "—"}
        </span>
      </div>
      {manipulated && !open && (
        <p className="px-4 pb-2 sm:pl-[calc(1rem+4.25rem+0.75rem)]">
          <span className="label border border-deny px-1.5 py-0.5 text-[9px] text-deny">Manipulated data</span>
          {r.purchase && (
            <Link href={`/forensics/${r.purchase.id}`} className="num ml-3 text-[11px] text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
              Report a problem → Forensics
            </Link>
          )}
        </p>
      )}
      {open && <TabDetail r={r} id={id} manipulated={manipulated} />}
    </div>
  );
}

function TabDetail({ r, id, manipulated }: { r: Row; id: string; manipulated: boolean }) {
  const ch = r.challenge;
  const d = r.paid ? det(r.paid) : {};
  const response = d.response != null ? String(d.response) : null;
  const [clean, injected] = response ? splitInjection(response) : ["", null];
  const p = r.purchase;
  return (
    <div id={id} className="animate-ink grid gap-3 border-t border-dashed border-line bg-surface-2 px-4 py-3 md:grid-cols-2">
      <div className="min-w-0">
        <p className="label flex items-center justify-between gap-2 text-[10px] text-muted">
          <span>Signed 402 challenge</span>
          {r.signatureValid === false ? (
            <span className="text-deny">✗ signature rejected</span>
          ) : ch ? (
            <span className="text-allow">✓ signature verified</span>
          ) : null}
        </p>
        {ch ? (
          <dl className="num mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-muted">provider</dt>
            <dd className="truncate text-ink">{ch.provider} <span className="text-muted">(simulated provider)</span></dd>
            <dt className="text-muted">resource</dt>
            <dd className="break-words text-ink">{ch.resource}</dd>
            <dt className="text-muted">price</dt>
            <dd className="text-ink">{usd(Number(ch.price?.value ?? 0))} {ch.price?.currency_code ?? "USD"}</dd>
            <dt className="text-muted">nonce</dt>
            <dd className="truncate text-ink">{ch.nonce}</dd>
            <dt className="text-muted">issued</dt>
            <dd className="text-ink">{ch.issued_at ? hhmmss(ch.issued_at) : "—"}</dd>
            <dt className="text-muted">expires</dt>
            <dd className="text-ink">{ch.expires_at ? hhmmss(ch.expires_at) : "—"}</dd>
            {d.receipt_sha256 && (
              <>
                <dt className="text-muted">receipt</dt>
                <dd className="truncate text-ink" title={String(d.receipt_sha256)}>sha256 {String(d.receipt_sha256).slice(0, 16)}…</dd>
              </>
            )}
            {p?.captureId && (
              <>
                <dt className="text-muted">capture</dt>
                <dd className="min-w-0"><CopyId value={p.captureId} label="batch PayPal capture" /></dd>
              </>
            )}
            {p?.refundId && (
              <>
                <dt className="text-muted">refund</dt>
                <dd className="min-w-0"><CopyId value={p.refundId} label="PayPal refund" /></dd>
              </>
            )}
          </dl>
        ) : (
          <p className="num mt-2 text-[11px] text-muted">No challenge on file.</p>
        )}
        {r.verdict && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-2">
            <Stamp verdict={r.verdict.verdict === "DENY" ? "DENY" : r.verdict.verdict === "ESCALATE" ? "ESCALATE" : "ALLOW"} rotate={-3} />
            <span className="num min-w-0 flex-1 text-[11px] text-ink">{r.verdict.title}</span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="label flex items-center justify-between gap-2 text-[10px] text-muted">
          <span>Returned data</span>
          {manipulated && <span className="border border-deny px-1.5 py-0.5 text-[9px] text-deny">Manipulated data</span>}
        </p>
        {response ? (
          <pre className={cn("num mt-2 whitespace-pre-wrap break-words border bg-surface px-2.5 py-2 text-[11px] leading-relaxed text-ink", manipulated ? "border-deny" : "border-line")}>
            {clean}
            {injected && (
              <>
                {" "}
                <span className="block mt-1.5 bg-deny-soft px-1.5 py-1 text-muted">
                  <span className="label mb-1 block text-[9px] text-deny no-underline">Injected instruction · addressed to agents</span>
                  <span className="line-through decoration-deny/70">{injected}</span>
                </span>
              </>
            )}
          </pre>
        ) : (
          <p className="num mt-2 text-[11px] text-muted">{r.status === "DENIED" ? "Nothing paid, nothing returned." : r.status === "AWAITING YOU" ? "Waiting for your signature — nothing paid yet." : "No data returned."}</p>
        )}
        {p && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            {p.rationale && <span className="min-w-0 text-[12px] text-muted">Agent: “{p.rationale}”</span>}
            <Link
              href={`/forensics/${p.id}`}
              className="num inline-flex min-h-11 items-center text-[12px] text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              Report a problem → Forensics
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

