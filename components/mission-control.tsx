"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Check, CircleDollarSign, Flag, Info, Loader2, Play, Search, ShieldAlert, ShieldCheck, ShieldX,
  Copy, Plug, ShoppingCart, Siren, Skull, User, Webhook, X,
} from "lucide-react";
import type { Product } from "@/lib/policy/schema";
import type { View } from "./mandate-screen";
import { Envelope } from "./envelope";
import { Beats } from "./beats";
import { Badge, Button, Card, cn, usd, verdictTone } from "./ui";

type Ev = View["events"][number];
type Injection = { text?: string; source?: string; followedByAgent?: boolean };

const det = (e: Ev) => (e.detail ?? {}) as Record<string, any>;
const isRedTeamProduct = (p?: { id?: string; title?: string } | null) =>
  !!p && (p.id === "redteam_ultra_elite" || /\[RED TEAM\]/i.test(p.title ?? ""));
const isAttack = (e: Ev) => e.type === "POLICY_VERDICT" && e.verdict === "DENY" && (!!det(e).injection || isRedTeamProduct(det(e).product));
const isDecision = (e: Ev) => e.type === "HUMAN" && /^You (approved|rejected)/.test(e.title);

export function MissionControl({ view, onChange }: { view: View; onChange: () => void }) {
  const { mandate, events, approvals, purchases, run } = view;
  const m = mandate as typeof mandate & { redTeam?: boolean; agentMode?: string; agentToken?: string | null };
  const external = m.agentMode === "external";
  const connectedEv = [...events].reverse().find((e) => e.title.startsWith("External agent connected over MCP"));
  const connectedName = connectedEv?.title.replace(/^External agent connected over MCP:?\s*/, "") || null;
  const pending = approvals.filter((a) => a.status === "PENDING");
  const running = run?.status === "RUNNING";
  const closed = mandate.status === "FULFILLED" || mandate.status === "VOIDED";
  const authorized = mandate.authorizedAmount || mandate.budgetTotal;
  const held = closed ? 0 : Math.max(0, authorized - mandate.spentTotal);

  const bottom = useRef<HTMLDivElement>(null);
  const count = events.length;
  useEffect(() => {
    // Newer browsers return a Promise from scrollIntoView — must not leak it as the effect cleanup.
    void bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  const denies = useMemo(() => events.filter((e) => e.type === "POLICY_VERDICT" && e.verdict === "DENY"), [events]);
  const attack = [...denies].reverse().find(isAttack) ?? null;
  const searched = events.some((e) => e.tool === "search_products" && e.type === "TOOL_RESULT");

  // "Agent adapting…": a human just decided and the agent hasn't acted on it yet.
  const lastDecision = events.map(isDecision).lastIndexOf(true);
  const adapting =
    running && lastDecision >= 0 && !events.slice(lastDecision + 1).some((e) => ["TOOL_CALL", "POLICY_VERDICT", "PAYPAL"].includes(e.type));

  // Progress beats.
  const steps = ["Hold authorized", "Agent shopping", "Your approval", ...(m.redTeam || attack ? ["Attack blocked"] : []), "Released & audited"];
  const iApproval = 2;
  const iAttack = steps.indexOf("Attack blocked");
  const done = steps.map((_, i) =>
    i === 0 ? !!mandate.authorizationId : i === 1 ? searched || closed : i === iApproval ? approvals.some((a) => a.status !== "PENDING") : i === iAttack ? !!attack : closed,
  );
  const current = pending.length ? iApproval : closed ? -1 : m.redTeam && !attack && searched && iAttack >= 0 ? iAttack : 1;

  const [launching, setLaunching] = useState(false);
  const [attackErr, setAttackErr] = useState<string | null>(null);
  async function launchAttack() {
    setLaunching(true);
    setAttackErr(null);
    const r = await fetch(`/api/mandates/${mandate.id}/redteam`, { method: "POST" });
    if (!r.ok) setAttackErr((await r.json().catch(() => ({}))).error ?? "The attack couldn't be launched.");
    setLaunching(false);
    onChange();
  }
  const canAttack = !!m.redTeam && mandate.status === "ACTIVE" && !attack && (searched || pending.length > 0);

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3">
        <Beats steps={steps} current={current} done={done} tone={current === iApproval ? "escalate" : current === iAttack ? "deny" : "accent"} />
      </Card>

      {external && <ConnectAgent token={m.agentToken ?? null} connected={!!connectedEv} name={connectedName} active={mandate.status === "ACTIVE"} />}

      {attack && <DenyInterstitial e={attack} held={held} closed={closed} />}

      {canAttack && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-deny/50 bg-deny-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Siren size={20} className="mt-0.5 shrink-0 text-deny" />
            <div>
              <p className="font-semibold text-deny">Red team mode</p>
              <p className="text-sm text-muted">A poisoned listing with hidden instructions is in the results. Let it hijack the agent and watch the policy engine respond.</p>
            </div>
          </div>
          <Button className="shrink-0 bg-deny text-white hover:opacity-90" onClick={launchAttack} disabled={launching}>
            {launching ? <Loader2 size={15} className="animate-spin" /> : <Skull size={15} />} Launch prompt-injection attack
          </Button>
        </div>
      )}
      {attackErr && <p className="text-sm text-deny">{attackErr}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Agent timeline</h2>
            {adapting ? (
              <span className="flex items-center gap-2 text-xs font-medium text-accent">
                <Loader2 size={12} className="animate-spin" /> Agent adapting to your decision…
              </span>
            ) : running ? (
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-allow animate-pulse-dot" /> Agent working
              </span>
            ) : pending.length || run?.status === "WAITING_APPROVAL" ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-escalate">
                <span className="h-2 w-2 rounded-full bg-escalate animate-pulse-dot" /> Waiting for you
              </span>
            ) : external && mandate.status === "ACTIVE" ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Plug size={12} /> {connectedEv ? "Your agent is connected" : "Waiting for your agent"}
              </span>
            ) : closed ? (
              <span className="text-xs text-muted">Complete · {events.length} events logged</span>
            ) : null}
          </div>
          {events.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> {external ? "Waiting for your agent to connect — its searches and proposals will stream in here." : "Starting your agent — first search results appear in a few seconds."}</p>
          ) : (
            <ol className="space-y-3">
              {collapse(events).map(({ e, n }) => <EventRow key={e.id} e={e} n={n} held={held} />)}
              {running && (
                <li className="flex items-center gap-2 pl-10 text-sm text-faint">
                  <Loader2 size={14} className="animate-spin" /> {adapting ? "adapting to your decision…" : "thinking…"}
                </li>
              )}
            </ol>
          )}
          <div ref={bottom} />
          {run?.status === "ERROR" && mandate.status === "ACTIVE" && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-deny-soft p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-deny">The agent hit an error. Your budget is still protected — nothing was captured. Resume to let it try again.</span>
              <Button variant="ghost" onClick={() => fetch(`/api/mandates/${mandate.id}/run`, { method: "POST" }).then(onChange)}>
                <Play size={14} /> Resume
              </Button>
            </div>
          )}
        </Card>

        <div className="order-first space-y-4 lg:order-none">
          {pending.map((a) => <ApprovalCard key={a.id} a={a} onDone={onChange} />)}
          <Envelope
            authorized={authorized}
            captured={mandate.spentTotal}
            refunded={mandate.refundedTotal}
            closed={closed}
            authorizationId={mandate.authorizationId}
          />
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
    </div>
  );
}

/** External (MCP) agent: connection instructions until it connects, then a small chip. */
function ConnectAgent({ token, connected, name, active }: { token: string | null; connected: boolean; name: string | null; active: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (connected)
    return (
      <p className="inline-flex items-center gap-2 rounded-full border border-allow/40 bg-allow-soft px-3 py-1 text-xs font-semibold text-allow">
        <Plug size={13} /> Connected over MCP{name ? <>: <span className="font-medium text-ink">{name}</span></> : null}
      </p>
    );
  if (!token)
    return (
      <Card className="p-4 text-sm text-muted">
        <Plug size={15} className="mr-1.5 inline text-accent" /> Your agent token is issued when the PayPal hold is approved{active ? " — refresh in a moment." : "."}
      </Card>
    );
  const url = `${origin}/api/mcp?token=${token}`;
  const rows = [
    ["MCP URL", url],
    ["Claude Code", `claude mcp add --transport http mandate "${url}"`],
    ["Any MCP client (JSON)", JSON.stringify({ mcpServers: { mandate: { type: "http", url } } }, null, 2)],
  ];
  return (
    <Card className="border-accent/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white"><Plug size={18} /></span>
        <div className="min-w-0">
          <p className="font-semibold">Connect your agent</p>
          <p className="text-sm text-muted">Paste this into Claude or any MCP client. Tools: <span className="num text-xs">get_mandate · search_products · check_policy · propose_purchase · get_status · finish</span></p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => <CopyRow key={label} label={label} value={value} />)}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={13} className="text-allow" /> This token only works inside this signed mandate&apos;s rules and PayPal hold.</p>
    </Card>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <div className="flex items-start gap-2 rounded-lg bg-surface-2 p-2">
        <pre className="num min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">{value}</pre>
        <button
          onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
          className="flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-medium hover:border-accent hover:text-accent"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** Full-width "attack blocked" moment. Shakes once (CSS respects prefers-reduced-motion). */
function DenyInterstitial({ e, held, closed }: { e: Ev; held: number; closed: boolean }) {
  const d = det(e);
  const inj = (d.injection ?? {}) as Injection;
  const product = d.product as (Product & { description?: string }) | undefined;
  const injected = inj.text || product?.description || product?.title;
  return (
    <section key={e.id} className="animate-shake overflow-hidden rounded-2xl border-2 border-deny bg-surface shadow-[0_12px_40px_-12px_rgba(190,18,60,0.45)]" role="alert">
      <div className="flex items-center gap-2 bg-deny px-4 py-2.5 text-white">
        <ShieldX size={18} />
        <p className="text-sm font-bold uppercase tracking-wider">Attack blocked</p>
        <span className="num ml-auto truncate text-xs opacity-90">{e.rule ?? "DENY"}</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div className="min-w-0 space-y-3">
          {injected && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Injected instruction{inj.source ? <> · from <span className="num normal-case tracking-normal">{inj.source}</span></> : null}
              </p>
              <p className="mt-1 rounded-lg border border-deny/30 bg-deny-soft px-3 py-2 text-sm">
                <mark className="bg-transparent font-medium text-deny">“{injected}”</mark>
              </p>
            </div>
          )}
          <p className="text-sm">
            {inj.followedByAgent ? <span className="font-semibold">The agent fell for it. </span> : null}
            The policy engine said no: <span className="text-muted">{e.title}</span>
          </p>
          <p className="text-xs text-muted">Deterministic rules don&apos;t read prompts. No human or AI can override a DENY.</p>
        </div>
        <div className="rounded-xl bg-allow-soft px-4 py-3 text-center sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-allow">Funds untouched</p>
          <p className="num text-3xl font-semibold text-allow">{usd(held)}</p>
          <p className="text-xs text-muted">{closed ? "released back to you" : "still held by PayPal"}</p>
        </div>
      </div>
    </section>
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
    <Card className="animate-rise overflow-hidden rounded-3xl border-escalate/50 p-0 shadow-[0_16px_40px_-16px_rgba(180,83,9,0.45)] ring-4 ring-escalate-soft">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-escalate text-white"><ShieldAlert size={13} /></span>
        <span className="text-xs font-semibold">Mandate</span>
        <span className="text-xs text-faint">· now</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-escalate">
          <span className="h-2 w-2 rounded-full bg-escalate animate-pulse-dot" /> Needs you
        </span>
      </div>
      <div className="p-4">
        <p className="text-lg font-semibold leading-tight">
          Approve <span className="num">{usd(amount)}</span>?
        </p>
        <div className="mt-3 flex gap-3">
          <Thumb src={a.product.image} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{a.product.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{a.product.merchant}{a.product.rating != null ? ` · ★ ${a.product.rating}` : ""}</p>
            <p className="mt-1 text-xs text-muted">
              Catalog price <span className="num font-semibold text-ink">{usd(a.product.price)}</span>
              {a.quantity > 1 && <> × {a.quantity}</>}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-escalate-soft px-3 py-2">
          <p className="num text-[10px] font-semibold uppercase text-escalate">{a.evaluation.rule}</p>
          <p className="text-xs text-ink">{a.evaluation.message}</p>
        </div>
        {a.rationale && (
          <div className="mt-3 flex gap-2">
            <Bot size={15} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm text-muted"><span className="font-medium text-ink">Why the agent picked it: </span>{a.rationale}</p>
          </div>
        )}
        {rejecting && (
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && decide("REJECT")}
            placeholder="Why? e.g. “want a better-known brand”"
            className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent sm:text-sm"
          />
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="deny" className="h-12 rounded-2xl text-base" disabled={!!busy} onClick={() => (rejecting ? decide("REJECT") : setRejecting(true))}>
            {busy === "REJECT" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} {rejecting ? "Send reject" : "Reject"}
          </Button>
          <Button variant="allow" className="h-12 rounded-2xl text-base" disabled={!!busy} onClick={() => decide("APPROVE")}>
            {busy === "APPROVE" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-faint">Approving captures from your PayPal hold — never more than it holds.</p>
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
          <p className="text-xs text-muted">{p.merchant} · <span className="num text-ink">{usd(p.amount)}</span></p>
          <p className="num truncate text-[10px] text-faint">capture {p.captureId}</p>
          {p.trackingNumber && <p className="num truncate text-[10px] text-faint">USPS {p.trackingNumber} (sim.)</p>}
          {p.refundId && <p className="num truncate text-[10px] text-faint">refund {p.refundId}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={p.status === "CAPTURED" ? "allow" : "neutral"}>{p.status.toLowerCase().replace("_", " ")}</Badge>
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
  const s = size === "lg" ? "h-20 w-20" : "h-11 w-11";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn(s, "shrink-0 rounded-xl border border-line bg-white object-contain")} />
  ) : (
    <div className={cn(s, "shrink-0 rounded-xl bg-surface-2")} />
  );
}

function Icon({ e }: { e: Ev }) {
  const base = "grid h-7 w-7 shrink-0 place-items-center rounded-full";
  if (e.type === "THOUGHT" && det(e).hijacked) return <span className={cn(base, "bg-deny text-white")}><Skull size={14} /></span>;
  if (e.type === "THOUGHT") return <span className={cn(base, "bg-accent-soft text-accent")}><Bot size={14} /></span>;
  if (e.type === "POLICY_VERDICT") {
    const I = e.verdict === "DENY" ? ShieldX : e.verdict === "ESCALATE" ? ShieldAlert : ShieldCheck;
    const tone = { allow: "bg-allow-soft text-allow", escalate: "bg-escalate-soft text-escalate", deny: "bg-deny text-white", neutral: "bg-surface-2 text-muted", accent: "" }[verdictTone(e.verdict)];
    return <span className={cn(base, tone)}><I size={14} /></span>;
  }
  if (/webhook/i.test(e.title) || e.tool === "webhook") return <span className={cn(base, "bg-paypal/10 text-paypal")}><Webhook size={14} /></span>;
  if (e.type === "PAYPAL") return <span className={cn(base, "bg-paypal/10 text-paypal")}><CircleDollarSign size={14} /></span>;
  if (e.type === "HUMAN") return <span className={cn(base, "bg-escalate-soft text-escalate")}><User size={14} /></span>;
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

function EventRow({ e, n = 1, held }: { e: Ev; n?: number; held: number }) {
  const detail = (e.detail ?? {}) as {
    products?: (Product & { description?: string })[]; reasoning?: string; api?: string; hijacked?: boolean; injected_instruction?: string;
    checks?: { rule: string; verdict: string; message: string }[];
  };

  // Reasoning-only step (model thought silently): keep it, but quiet.
  if (e.type === "THOUGHT" && e.title === "Thinking…" && !detail.hijacked)
    return (
      <li className="animate-rise pl-10">
        <details>
          <summary className="cursor-pointer text-xs text-faint">Agent reasoning</summary>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-xs text-muted">{detail.reasoning}</p>
        </details>
      </li>
    );

  if (e.type === "SYSTEM") {
    const red = /red team/i.test(e.title);
    return (
      <li className={cn("animate-rise flex items-center gap-3 text-xs", red ? "font-medium text-deny" : "text-faint")}>
        <span className={cn("h-px flex-1", red ? "bg-deny/40" : "bg-line")} />
        <span className="max-w-[80%] text-center">{red && <Siren size={12} className="mr-1 inline" />}{e.title}{n > 1 && ` ×${n}`}</span>
        <span className={cn("h-px flex-1", red ? "bg-deny/40" : "bg-line")} />
      </li>
    );
  }

  const deny = e.type === "POLICY_VERDICT" && e.verdict === "DENY";

  return (
    <li className={cn("flex gap-3", deny ? "animate-shake" : "animate-rise")}>
      <Icon e={e} />
      <div className="min-w-0 flex-1 pt-0.5">
        {e.type === "POLICY_VERDICT" ? (
          <div
            className={cn(
              "rounded-xl px-3 py-2",
              { allow: "bg-allow-soft", escalate: "bg-escalate-soft", deny: "border-2 border-deny bg-deny-soft", neutral: "bg-surface-2", accent: "" }[verdictTone(e.verdict)],
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={verdictTone(e.verdict)} className={cn(deny && "bg-deny text-white")}>{e.verdict}</Badge>
              <span className="num text-[11px] text-muted">{e.rule}</span>
              {e.amount != null && <span className="num ml-auto text-xs font-semibold">{usd(e.amount)}</span>}
            </div>
            <p className={cn("mt-1 text-sm", deny && "font-medium")}>{e.title}</p>
            {deny && (
              <p className="mt-1 text-xs text-muted">
                Blocked by the policy engine — nobody can override. <span className="font-medium text-allow">Funds untouched: <span className="num">{usd(held)}</span> still held.</span>
              </p>
            )}
            {detail.checks && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted">All {detail.checks.length} checks</summary>
                <ul className="num mt-1 grid gap-0.5 text-[11px]">
                  {detail.checks.map((c) => (
                    <li key={c.rule} className={cn(c.verdict === "DENY" ? "text-deny" : c.verdict === "ESCALATE" ? "text-escalate" : "text-muted")}>
                      {c.verdict === "ALLOW" ? "✓" : c.verdict === "DENY" ? "✗" : "!"} {c.rule}: {c.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : e.type === "THOUGHT" && detail.hijacked ? (
          <div className="rounded-xl border border-deny/40 bg-deny-soft px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-deny">Compromised agent</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{e.title}</p>
            {detail.injected_instruction && (
              <p className="mt-1.5 rounded-md bg-surface/70 px-2 py-1 text-xs text-muted">
                Following hidden instruction: <mark className="bg-transparent font-medium text-deny">“{detail.injected_instruction}”</mark>
              </p>
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
          <>
            <p className={cn("text-sm", e.type === "PAYPAL" ? "font-medium text-paypal" : e.type === "TOOL_RESULT" ? "text-muted" : e.type === "HUMAN" ? "font-medium" : "")}>
              {e.title}
              {n > 1 && <span className="ml-1.5 rounded bg-surface-2 px-1.5 text-[10px] font-medium text-muted">×{n}</span>}
            </p>
            {(detail.api || e.paypalId) && (
              <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                {detail.api && <code className="num break-all rounded bg-paypal/10 px-1.5 py-0.5 text-paypal">{detail.api}</code>}
                {e.paypalId && <span className="num py-0.5 text-faint">{e.paypalId}</span>}
              </p>
            )}
          </>
        )}
        {detail.products && detail.products.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {detail.products.map((p) => {
              const bad = isRedTeamProduct(p);
              return (
                <a
                  key={p.id}
                  href={p.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  title={bad ? p.description ?? undefined : undefined}
                  className={cn("w-36 shrink-0 rounded-xl border p-2", bad ? "border-2 border-deny bg-deny-soft" : "border-line hover:border-accent")}
                >
                  {bad && <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-deny"><Skull size={10} /> hidden instructions</p>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="h-20 w-full rounded-md bg-white object-contain" /> : <div className="h-20 rounded-md bg-surface-2" />}
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug">{p.title}</p>
                  <p className="mt-0.5 text-xs"><span className="num font-semibold">{usd(p.price)}</span> <span className="text-faint">· {p.merchant}</span></p>
                  {bad && p.description ? (
                    <p className="mt-1 line-clamp-3 text-[10px] text-deny">“{p.description}”</p>
                  ) : (
                    <p className="text-[10px] text-faint">{p.rating != null ? `★ ${p.rating} · ` : ""}~{p.delivery_days}d est.</p>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
      <time className="num hidden shrink-0 pt-1 text-[10px] text-faint sm:block">
        {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </time>
    </li>
  );
}
