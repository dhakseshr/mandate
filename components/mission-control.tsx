"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bot, Check, CircleDollarSign, Flag, Loader2, Play, Search, ShieldAlert, ShieldCheck, ShieldX,
  ShoppingCart, User, X, Info,
} from "lucide-react";
import type { Product } from "@/lib/policy/schema";
import type { View } from "./mandate-screen";
import { Badge, Button, Card, cn, usd, verdictTone } from "./ui";

type Ev = View["events"][number];

export function MissionControl({ view, onChange }: { view: View; onChange: () => void }) {
  const { mandate, events, approvals, purchases, run } = view;
  const pending = approvals.filter((a) => a.status === "PENDING");
  const running = run?.status === "RUNNING";
  const bottom = useRef<HTMLDivElement>(null);
  const count = events.length;
  useEffect(() => {
    // Newer browsers return a Promise from scrollIntoView — must not leak it as the effect cleanup.
    void bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Agent timeline</h2>
          {running ? (
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-allow animate-pulse-dot" /> Agent working
            </span>
          ) : pending.length ? (
            <span className="text-xs text-escalate">Waiting for you</span>
          ) : null}
        </div>
        <ol className="space-y-3">
          {collapse(events).map(({ e, n }) => <EventRow key={e.id} e={e} n={n} />)}
          {running && (
            <li className="flex items-center gap-2 pl-10 text-sm text-faint">
              <Loader2 size={14} className="animate-spin" /> thinking…
            </li>
          )}
        </ol>
        <div ref={bottom} />
        {run?.status === "ERROR" && mandate.status === "ACTIVE" && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-deny-soft p-3 text-sm">
            <span className="text-deny">The agent hit an error. Your budget is still protected.</span>
            <Button variant="ghost" onClick={() => fetch(`/api/mandates/${mandate.id}/run`, { method: "POST" }).then(onChange)}>
              <Play size={14} /> Resume
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Envelope view={view} />
        {pending.map((a) => <ApprovalCard key={a.id} a={a} onDone={onChange} />)}
        {purchases.length > 0 && (
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Purchases</h3>
            <ul className="space-y-3">
              {purchases.map((p) => <PurchaseRow key={p.id} p={p} onDone={onChange} />)}
            </ul>
          </Card>
        )}
        {mandate.summary && (
          <Card className="border-accent/30 bg-accent-soft p-5">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-accent"><Flag size={14} /> Done</p>
            <p className="text-sm leading-relaxed">{mandate.summary}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Envelope({ view }: { view: View }) {
  const m = view.mandate;
  const auth = m.authorizedAmount || m.budgetTotal;
  const spent = m.spentTotal;
  const closed = m.status === "FULFILLED";
  const remaining = Math.max(0, auth - spent);
  const pct = auth ? Math.min(100, (spent / auth) * 100) : 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">PayPal budget hold</p>
        <Badge tone={closed ? "neutral" : "allow"}>{closed ? "closed" : "active"}</Badge>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {usd(closed ? 0 : remaining)} <span className="text-base font-normal text-muted">{closed ? "held" : "left"}</span>
      </p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
        {!closed && <div className="bg-allow/40 transition-all duration-700" style={{ width: `${100 - pct}%` }} />}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-faint">Authorized</dt><dd className="font-medium">{usd(auth)}</dd></div>
        <div><dt className="text-faint">Spent</dt><dd className="font-medium">{usd(spent)}</dd></div>
        <div><dt className="text-faint">{closed ? "Released" : "Remaining"}</dt><dd className="font-medium">{usd(remaining)}</dd></div>
      </dl>
      {m.refundedTotal > 0 && (
        <p className="mt-2 text-xs text-muted">Refunded to you: <span className="font-medium text-ink">{usd(m.refundedTotal)}</span></p>
      )}
      {m.authorizationId && <p className="mt-3 truncate font-mono text-[10px] text-faint">auth {m.authorizationId}</p>}
    </Card>
  );
}

function ApprovalCard({ a, onDone }: { a: View["approvals"][number]; onDone: () => void }) {
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision);
    await fetch(`/api/approvals/${a.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: reason || undefined }),
    });
    onDone();
  }
  const amount = a.product.price * a.quantity;
  return (
    <Card className="animate-rise border-escalate/40 p-5 ring-4 ring-escalate-soft">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-escalate"><ShieldAlert size={15} /> Your approval needed</p>
      <div className="flex gap-3">
        <Thumb src={a.product.image} size="lg" />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium">{a.product.title}</p>
          <p className="text-xs text-muted">{a.product.merchant}</p>
          <p className="mt-1 text-lg font-semibold">{usd(amount)}</p>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-escalate-soft px-3 py-2 text-xs text-escalate">{a.evaluation.message}</p>
      {a.rationale && <p className="mt-3 text-sm text-muted"><span className="font-medium text-ink">Agent:</span> {a.rationale}</p>}
      {rejecting && (
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && decide("REJECT")}
          placeholder="Why? (helps the agent pick better)"
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="deny" disabled={!!busy} onClick={() => (rejecting ? decide("REJECT") : setRejecting(true))}>
          {busy === "REJECT" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject
        </Button>
        <Button variant="allow" disabled={!!busy} onClick={() => decide("APPROVE")}>
          {busy === "APPROVE" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
        </Button>
      </div>
    </Card>
  );
}

function PurchaseRow({ p, onDone }: { p: View["purchases"][number]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function refund() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/purchases/${p.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!r.ok) setErr((await r.json()).error);
    setBusy(false);
    setOpen(false);
    onDone();
  }
  return (
    <li>
      <div className="flex gap-3">
        <Thumb src={p.product.image} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{p.product.title}</p>
          <p className="text-xs text-muted">{p.merchant} · {usd(p.amount)}</p>
          <p className="font-mono text-[10px] text-faint">capture {p.captureId}</p>
          {p.trackingNumber && <p className="font-mono text-[10px] text-faint">USPS {p.trackingNumber} (sim.)</p>}
          {p.refundId && <p className="font-mono text-[10px] text-faint">refund {p.refundId}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={p.status === "CAPTURED" ? "allow" : "neutral"}>{p.status.toLowerCase()}</Badge>
          {p.status === "CAPTURED" && !open && (
            <button onClick={() => setOpen(true)} className="text-xs text-muted underline-offset-2 hover:text-deny hover:underline">
              Refund
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refund()}
            placeholder="Reason, e.g. wrong size"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <Button variant="deny" className="px-3 py-1.5" disabled={busy} onClick={refund}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Refund"}
          </Button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-deny">{err}</p>}
    </li>
  );
}

function Thumb({ src, size = "sm" }: { src?: string | null; size?: "sm" | "lg" }) {
  const s = size === "lg" ? "h-16 w-16" : "h-11 w-11";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn(s, "shrink-0 rounded-lg border border-line bg-white object-contain")} />
  ) : (
    <div className={cn(s, "shrink-0 rounded-lg bg-surface-2")} />
  );
}

function Icon({ e }: { e: Ev }) {
  const base = "grid h-7 w-7 shrink-0 place-items-center rounded-full";
  if (e.type === "THOUGHT") return <span className={cn(base, "bg-accent-soft text-accent")}><Bot size={14} /></span>;
  if (e.type === "POLICY_VERDICT") {
    const I = e.verdict === "DENY" ? ShieldX : e.verdict === "ESCALATE" ? ShieldAlert : ShieldCheck;
    const tone = { allow: "bg-allow-soft text-allow", escalate: "bg-escalate-soft text-escalate", deny: "bg-deny-soft text-deny", neutral: "bg-surface-2 text-muted", accent: "" }[verdictTone(e.verdict)];
    return <span className={cn(base, tone)}><I size={14} /></span>;
  }
  if (e.type === "PAYPAL") return <span className={cn(base, "bg-paypal/10 text-paypal")}><CircleDollarSign size={14} /></span>;
  if (e.type === "HUMAN") return <span className={cn(base, "bg-surface-2 text-ink")}><User size={14} /></span>;
  if (e.tool === "propose_purchase") return <span className={cn(base, "bg-surface-2 text-ink")}><ShoppingCart size={14} /></span>;
  if (e.tool === "search_products") return <span className={cn(base, "bg-surface-2 text-muted")}><Search size={14} /></span>;
  return <span className={cn(base, "bg-surface-2 text-faint")}><Info size={13} /></span>;
}

/** Collapse consecutive identical HUMAN/PAYPAL/SYSTEM rows (e.g. three policy edits) into one with a count. */
function collapse(events: Ev[]) {
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

function EventRow({ e, n = 1 }: { e: Ev; n?: number }) {
  const detail = (e.detail ?? {}) as { products?: Product[]; reasoning?: string; checks?: { rule: string; verdict: string; message: string }[] };

  // Reasoning-only step (model thought silently): keep it, but quiet.
  if (e.type === "THOUGHT" && e.title === "Thinking…")
    return (
      <li className="animate-rise pl-10">
        <details>
          <summary className="cursor-pointer text-xs text-faint">Agent reasoning</summary>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-xs text-muted">{detail.reasoning}</p>
        </details>
      </li>
    );

  if (e.type === "SYSTEM")
    return (
      <li className="animate-rise flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />{e.title}<span className="h-px flex-1 bg-line" />
      </li>
    );

  return (
    <li className="animate-rise flex gap-3">
      <Icon e={e} />
      <div className="min-w-0 flex-1 pt-0.5">
        {e.type === "POLICY_VERDICT" ? (
          <div className={cn("rounded-xl px-3 py-2", { allow: "bg-allow-soft", escalate: "bg-escalate-soft", deny: "bg-deny-soft", neutral: "bg-surface-2", accent: "" }[verdictTone(e.verdict)])}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={verdictTone(e.verdict)}>{e.verdict}</Badge>
              <span className="font-mono text-[11px] text-muted">{e.rule}</span>
            </div>
            <p className="mt-1 text-sm">{e.title}</p>
            {detail.checks && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted">All {detail.checks.length} checks</summary>
                <ul className="mt-1 grid gap-0.5 font-mono text-[11px]">
                  {detail.checks.map((c) => (
                    <li key={c.rule} className={cn(c.verdict === "DENY" ? "text-deny" : c.verdict === "ESCALATE" ? "text-escalate" : "text-muted")}>
                      {c.verdict === "ALLOW" ? "✓" : c.verdict === "DENY" ? "✗" : "!"} {c.rule}: {c.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : e.type === "THOUGHT" ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.title}</p>
            {detail.reasoning && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-faint">Reasoning</summary>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{detail.reasoning}</p>
              </details>
            )}
          </>
        ) : (
          <p className={cn("text-sm", e.type === "PAYPAL" ? "font-medium text-paypal" : e.type === "TOOL_RESULT" ? "text-muted" : "")}>
            {e.title}
            {n > 1 && <span className="ml-1.5 rounded bg-surface-2 px-1.5 text-[10px] font-medium text-muted">×{n}</span>}
            {e.paypalId && <span className="ml-2 font-mono text-[10px] font-normal text-faint">{e.paypalId}</span>}
          </p>
        )}
        {detail.products && detail.products.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {detail.products.map((p) => (
              <a key={p.id} href={p.url ?? undefined} target="_blank" rel="noreferrer" className="w-36 shrink-0 rounded-xl border border-line p-2 hover:border-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" className="h-20 w-full rounded-md bg-white object-contain" /> : <div className="h-20 rounded-md bg-surface-2" />}
                <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug">{p.title}</p>
                <p className="mt-0.5 text-xs"><span className="font-semibold">{usd(p.price)}</span> <span className="text-faint">· {p.merchant}</span></p>
                <p className="text-[10px] text-faint">{p.rating != null ? `★ ${p.rating} · ` : ""}~{p.delivery_days}d est.</p>
              </a>
            ))}
          </div>
        )}
      </div>
      <time className="shrink-0 pt-1 font-mono text-[10px] text-faint">
        {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </time>
    </li>
  );
}
