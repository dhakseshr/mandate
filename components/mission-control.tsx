"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { View } from "./mandate-screen";
import { Envelope } from "./envelope";
import { Beats } from "./beats";
import { Button, cn, usd } from "./ui";
import { collapse, isAttack, isDecision } from "./log/shared";
import { LogRow } from "./log/decision-log";
import { AttackPanel } from "./log/attack-panel";
import { ApprovalSlip, ConnectAgent, Filed, InstrumentStub, Statement } from "./log/side";

/** Mission Control — the money is boxed; every decision is visible. */
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
  const released = closed ? Math.max(0, authorized - mandate.spentTotal) : 0;

  const bottom = useRef<HTMLDivElement>(null);
  const count = events.length;
  useEffect(() => {
    // Newer browsers return a Promise from scrollIntoView — must not leak it as the effect cleanup.
    void bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  const denies = useMemo(() => events.filter((e) => e.type === "POLICY_VERDICT" && e.verdict === "DENY"), [events]);
  const attack = [...denies].reverse().find(isAttack) ?? null;
  const searched = events.some((e) => e.tool === "search_products" && e.type === "TOOL_RESULT");
  const rows = useMemo(() => collapse(events), [events]);

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

  const waiting = pending.length > 0 || run?.status === "WAITING_APPROVAL";
  const status = adapting
    ? { text: "Agent adapting to your decision", tone: "text-ink", caret: true }
    : running
      ? { text: "Agent working", tone: "text-ink", caret: true }
      : waiting
        ? { text: "Waiting for your signature", tone: "text-escalate", caret: false }
        : external && mandate.status === "ACTIVE"
          ? { text: connectedEv ? "External agent connected" : "Waiting for your agent", tone: "text-muted", caret: !connectedEv }
          : closed
            ? { text: "Closed · ledger sealed", tone: "text-muted", caret: false }
            : null;

  return (
    <div className="space-y-4">
      <Envelope
        authorized={authorized}
        captured={mandate.spentTotal}
        refunded={mandate.refundedTotal}
        closed={closed}
        pendingAmount={pending.reduce((s, a) => s + a.product.price * a.quantity, 0)}
        authorizationId={mandate.authorizationId}
      />

      <div className="border border-line bg-surface px-4 py-3">
        <Beats steps={steps} current={current} done={done} tone={current === iApproval ? "escalate" : current === iAttack ? "deny" : "accent"} />
      </div>

      {attack && <AttackPanel e={attack} held={held} closed={closed} />}

      {canAttack && (
        <div className="flex flex-col gap-3 border border-dashed border-deny/50 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="num text-[12px] leading-relaxed text-muted">
            <span className="label mr-2 text-[10px] text-deny">Red team</span>
            A listing in these results carries hidden instructions. Let it reach the agent; the rules decide.
          </p>
          <Button variant="deny" className="min-h-11 shrink-0 border-deny" onClick={launchAttack} disabled={launching}>
            {launching ? "Injecting…" : "Inject poisoned listing"}
          </Button>
        </div>
      )}
      {attackErr && <p className="num text-[12px] text-deny">✗ {attackErr}</p>}

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        {/* DECISION LOG — the machine's terminal */}
        <section className="min-w-0 border border-line bg-surface-2 lg:col-span-8" aria-label="Decision log">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-3 py-2.5 sm:px-4">
            <h2 className="label text-[11px] text-ink">
              Decision log <span className="ml-2 text-muted">{events.length} entries · append-only</span>
            </h2>
            {status && (
              <span className={cn("label flex items-center gap-1.5 text-[10px]", status.tone)} aria-live="polite">
                {waiting && !running && <span aria-hidden>!</span>}
                {status.text}
                {status.caret && <span className="caret" aria-hidden />}
              </span>
            )}
          </header>

          <div className="font-mono text-[13px] leading-[1.6]">
            {events.length === 0 ? (
              <p className="px-4 py-6 text-muted">
                {external ? "Waiting for your agent to connect — its searches and proposals will stream in here." : "Starting your agent — first search results appear in a few seconds."}
                <span className="caret ml-1" aria-hidden />
              </p>
            ) : (
              <ol>
                {rows.map(({ e, n }) => (
                  <LogRow key={e.id} e={e} n={n} held={held} closed={closed} />
                ))}
                {running && (
                  <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 px-3 py-2 text-muted sm:grid-cols-[4.25rem_4.75rem_minmax(0,1fr)] sm:px-4">
                    <span className="hidden sm:block" />
                    <span className="label pt-[4px] text-[10px]">Agent</span>
                    <span>
                      {adapting ? "adapting to your decision" : "thinking"}
                      <span className="caret ml-1" aria-hidden />
                    </span>
                  </li>
                )}
              </ol>
            )}
            <div ref={bottom} />
            {run?.status === "ERROR" && mandate.status === "ACTIVE" && (
              <div className="flex flex-col gap-3 border-t border-deny/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <p className="text-[12px] text-deny">
                  ✗ agent run failed. {usd(held)} still held — nothing was captured.
                </p>
                <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => fetch(`/api/mandates/${mandate.id}/run`, { method: "POST" }).then(onChange)}>
                  Resume agent
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* The human's side: paper. */}
        <aside className="order-first min-w-0 space-y-4 lg:order-none lg:col-span-4">
          {mandate.summary && <Filed summary={mandate.summary} spent={mandate.spentTotal} released={released} refunded={mandate.refundedTotal} />}
          {pending.map((a) => (
            <ApprovalSlip key={a.id} a={a} authorizationId={mandate.authorizationId} onDone={onChange} />
          ))}
          {external && <ConnectAgent token={m.agentToken ?? null} connected={!!connectedEv} name={connectedName} active={mandate.status === "ACTIVE"} />}
          {purchases.length > 0 && <Statement purchases={purchases} captured={mandate.spentTotal} refunded={mandate.refundedTotal} onDone={onChange} />}
          <InstrumentStub mandate={mandate} authorized={authorized} held={held} closed={closed} />
        </aside>
      </div>
    </div>
  );
}
