"use client";
import Link from "next/link";
import type { View } from "../mandate-screen";
import { Badge, SealTag, Stamp, cn, usd } from "../ui";
import { det, type Ev } from "../log/shared";
import { RevokeControl } from "./revoke";
import { runLabel, type TreeNode } from "./names";

type Ghost = { id: string; name: string; goal?: string; amount: number | null; violations: { field?: string; message: string }[] };

/** Rejected delegations: POLICY_VERDICT · DENY · rule ATTENUATION · tool delegate. */
export function refusedDelegations(events: Ev[]): Ghost[] {
  return events
    .filter((e) => e.type === "POLICY_VERDICT" && e.verdict === "DENY" && (e.tool === "delegate" || e.rule === "ATTENUATION"))
    .map((e) => {
      const d = det(e);
      const req = (d.request ?? {}) as { name?: string; goal?: string; budget_total?: number };
      const violations = (Array.isArray(d.violations) ? d.violations : []) as Ghost["violations"];
      const name = req.name || e.title.match(/delegation to (.+?) —/)?.[1] || "Sub-agent";
      return { id: e.id, name, goal: req.goal, amount: req.budget_total ?? e.amount ?? null, violations: violations.length ? violations : [{ message: e.title.split(" — ").slice(1).join(" — ") || e.title }] };
    });
}

/**
 * The chain of authority: the human's root instrument, hairline connectors, and one stub per
 * sub-mandate the orchestrator signed. Refused delegations stay on the page as struck ghost cards.
 */
export function DelegationTree({ view, onChange }: { view: View; onChange: () => void }) {
  const { mandate, tree, approvals, events } = view;
  const m = mandate as View["mandate"] & { parentId?: string | null; name?: string | null };
  const ghosts = refusedDelegations(events.filter((e) => e.mandateId === mandate.id || tree.some((t) => t.id === e.mandateId)));
  const kids = tree.filter((t) => t.parentId === mandate.id);
  const authorized = Math.min(mandate.budgetTotal, mandate.authorizedAmount || mandate.budgetTotal);
  const live = kids.filter((k) => k.status === "ACTIVE");
  const reserved = live.reduce((a, k) => a + Math.max(0, k.budgetTotal - k.spentTotal), 0);
  const unallocated = Math.max(0, Math.round((authorized - mandate.spentTotal - reserved) * 100) / 100);
  const rootActive = mandate.status === "ACTIVE";
  const isRoot = !m.parentId;
  const count = kids.length + ghosts.length;
  const cols = Math.min(Math.max(count, 1), 4);
  const pendingBy = (id: string) => approvals.filter((a) => a.status === "PENDING" && a.mandateId === id).reduce((s, a) => s + a.product.price * a.quantity, 0);

  // Allocation bar segments: each child's share of the root, then what's left.
  const seg = (n: number) => `${Math.max(0, (n / Math.max(authorized, 0.01)) * 100)}%`;

  return (
    <section aria-label="Delegation tree" className="border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
        <h2 className="label text-[11px] text-ink">
          Chain of authority <span className="ml-2 text-muted">{kids.length} sub-mandate{kids.length === 1 ? "" : "s"}{ghosts.length ? ` · ${ghosts.length} refused` : ""}</span>
        </h2>
        <span className="label text-[10px] text-muted">Each one narrower than its parent · one PayPal hold</span>
      </header>

      <div className="px-4 pb-5 pt-4 sm:px-5">
        {/* Root instrument strip */}
        <div className="relative border border-ink/70 bg-surface shadow-paper">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2">
            <span className="label text-ink">
              {isRoot ? "Root · your mandate" : `${m.name ?? "Sub-mandate"} · delegating`}
            </span>
            <span className="num text-[11px] text-muted">
              № <span className="text-ink">{mandate.id}</span>
            </span>
          </div>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <span className="label text-[10px] text-muted">Pay up to</span>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="num text-2xl font-medium leading-none text-ink">{usd(authorized)}</span>
                {mandate.authorizationId ? (
                  <span className="num text-[12px] text-paypal">PayPal hold · {mandate.authorizationId}</span>
                ) : (
                  <span className="num text-[12px] text-muted">backed by the root PayPal hold</span>
                )}
              </p>
            </div>
            <dl className="num grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[11px] sm:text-right">
              <dt className="text-muted">delegated</dt>
              <dd className="text-ink">{usd(reserved)}</dd>
              <dt className="text-muted">spent</dt>
              <dd className="text-ink">{usd(mandate.spentTotal)}</dd>
              <dt className="text-muted">unallocated</dt>
              <dd className="font-medium text-ink">{usd(rootActive ? unallocated : 0)}</dd>
            </dl>
          </div>
          {/* Allocation bar */}
          <div className="px-4 pb-3">
            <div className="flex h-3 w-full gap-px border border-line bg-surface-2" role="img" aria-label={`Allocated ${usd(reserved)} to live sub-agents, ${usd(unallocated)} unallocated of ${usd(authorized)}`}>
              {kids.map((k) => {
                const share = k.status === "ACTIVE" ? k.budgetTotal : k.spentTotal;
                if (share <= 0) return null;
                return (
                  <span key={k.id} title={`${k.name}: ${usd(share)}`} className="relative h-full bg-paypal/25" style={{ width: seg(share) }}>
                    <span className="absolute inset-y-0 left-0 bg-paypal" style={{ width: `${Math.min(100, (k.spentTotal / Math.max(share, 0.01)) * 100)}%` }} />
                  </span>
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {kids.map((k) => (
                <span key={k.id} className={cn("num text-[11px]", k.status === "REVOKED" ? "text-muted line-through decoration-deny/60" : "text-muted")}>
                  {k.name} <span className="text-ink">{usd(k.budgetTotal)}</span>
                </span>
              ))}
              <span className="num text-[11px] text-muted">
                unallocated <span className="text-ink">{usd(rootActive ? unallocated : 0)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Connectors + children */}
        {count > 0 && (
          <div className="relative mt-0 pl-6 pt-4 lg:pl-0 lg:pt-8">
            {/* mobile/tablet rail */}
            <span aria-hidden className="absolute bottom-10 left-3 top-0 w-px bg-ink/50 lg:hidden" />
            {/* desktop: stem + bus */}
            <span aria-hidden className="absolute left-1/2 top-0 hidden h-4 w-px bg-ink/50 lg:block" />
            <span
              aria-hidden
              className="absolute top-4 hidden h-px bg-ink/50 lg:block"
              style={{ left: `calc((100% - ${cols - 1}rem) / ${cols * 2})`, right: `calc((100% - ${cols - 1}rem) / ${cols * 2})` }}
            />
            <ul className="grid gap-4 lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" style={{ ["--cols" as string]: cols }}>
              {kids.map((k) => (
                <Child key={k.id} k={k} pending={pendingBy(k.id)} onChange={onChange} />
              ))}
              {ghosts.map((g) => (
                <GhostCard key={g.id} g={g} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** Tick from the rail (mobile) or bus (desktop) into a card. */
const tick =
  "relative before:absolute before:-left-3 before:top-7 before:h-px before:w-3 before:bg-ink/50 lg:before:-top-4 lg:before:left-1/2 lg:before:h-4 lg:before:w-px";

function Child({ k, pending, onChange }: { k: TreeNode; pending: number; onChange: () => void }) {
  const run = runLabel(k);
  const revoked = k.status === "REVOKED";
  const fulfilled = k.status === "FULFILLED";
  const left = Math.max(0, k.budgetTotal - k.spentTotal);
  const pct = (n: number) => `${Math.min(100, (n / Math.max(k.budgetTotal, 0.01)) * 100)}%`;
  return (
    <li className={tick}>
      <article className={cn("flex h-full flex-col border bg-surface", revoked ? "border-line" : "border-ink/40")} aria-label={`${k.name} sub-mandate`}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <Link href={`/m/${k.id}`} className="num min-w-0 truncate text-[11px] text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink">
            Sub-mandate № {k.id}
          </Link>
          {revoked ? (
            <Stamp verdict="DENY" rotate={-4}>Revoked</Stamp>
          ) : fulfilled ? (
            <Stamp verdict="APPROVED" rotate={-4} className="border-ink text-ink">Fulfilled</Stamp>
          ) : (
            <Badge tone="paypal">Active</Badge>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col px-3 pb-3 pt-3", revoked && "text-muted")}>
          <h3 className={cn("display text-[1.3rem] leading-tight", revoked ? "text-muted" : "text-ink")}>{k.name}</h3>
          {k.goal && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{k.goal}</p>}

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-[10px] text-muted">Up to</span>
              <span className={cn("num text-[17px] font-medium", revoked ? "text-muted line-through decoration-deny/70" : "text-ink")}>≤ {usd(k.budgetTotal)}</span>
            </div>
            <div className="mt-1.5 flex h-2 w-full border border-line bg-surface-2" aria-hidden>
              <span className="h-full bg-paypal" style={{ width: pct(k.spentTotal) }} />
              {pending > 0 && !revoked && <span className="h-full bg-escalate/40" style={{ width: pct(pending) }} />}
            </div>
            <p className="num mt-1 flex flex-wrap justify-between gap-x-2 text-[11px] text-muted">
              <span>
                spent <span className={revoked ? "" : "text-paypal"}>{usd(k.spentTotal)}</span>
                {pending > 0 && !revoked && (
                  <>
                    {" "}· <span className="text-escalate">{usd(pending)} awaiting you</span>
                  </>
                )}
              </span>
              <span>{revoked ? "returned to root" : `${usd(left)} left`}</span>
            </p>
          </div>

          <dl className="num mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-dashed border-line pt-2 text-[11px]">
            <dt className="text-muted">ask above</dt>
            <dd className="text-ink">{k.approvalThreshold != null ? usd(k.approvalThreshold) : "never"}</dd>
            <dt className="text-muted">agent</dt>
            <dd className={cn("flex items-center gap-1", run.tone)} aria-live="polite">
              {run.text === "waiting for you" && <span aria-hidden>!</span>}
              {run.text}
              {run.live && <span className="caret" aria-hidden />}
            </dd>
          </dl>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            <SealTag hash={k.signatureHash} className={revoked ? "text-muted" : undefined} />
            {k.status === "ACTIVE" && <RevokeControl compact mandateId={k.id} name={k.name ?? "this sub-mandate"} amount={left} root={false} onDone={onChange} />}
          </div>
        </div>
      </article>
    </li>
  );
}

/** The orchestrator asked for more than it had. The math said no — kept on the page, struck. */
function GhostCard({ g }: { g: Ghost }) {
  return (
    <li className={cn(tick, "before:bg-deny/60 lg:before:bg-deny/60")}>
      <article className="flex h-full flex-col border border-dashed border-deny/60 bg-deny-soft/40" aria-label={`Refused delegation to ${g.name}`}>
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-deny/40 px-3 py-2">
          <span className="label text-[10px] text-deny">Delegation refused</span>
          <Stamp verdict="DENY" rotate={-5} animate>Refused</Stamp>
        </div>
        <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
          <h3 className="display text-[1.3rem] leading-tight text-muted">{g.name}</h3>
          {g.goal && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{g.goal}</p>}
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="label text-[10px] text-muted">Asked for</span>
            <span className="num text-[17px] font-medium text-deny line-through decoration-2">{usd(g.amount)}</span>
          </div>
          <ul className="num mt-3 space-y-1 border-t border-dashed border-deny/40 pt-2 text-[11px] leading-snug">
            {g.violations.map((v, i) => (
              <li key={i} className="grid grid-cols-[1.25ch_minmax(0,1fr)] gap-x-1.5 text-deny">
                <span aria-label="failed">✗</span>
                <span className="break-words">{v.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-3 text-[12px] leading-snug text-muted">
            A sub-mandate can only be narrower than its parent. No mandate was signed; <span className="num">$0.00</span> moved.
          </p>
        </div>
      </article>
    </li>
  );
}
