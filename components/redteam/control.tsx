"use client";
import { useState } from "react";
import { Button, cn, usd } from "../ui";

type Phase = { text: string; done: boolean };

/**
 * The red-team suite launcher. Two steps like the kill switch: a deny-outlined control,
 * an inline confirm with the exact consequence, then POST /redteam/suite. While it runs,
 * the count comes from the log (verdicts against the red-team agent), never from a timer.
 */
export function RedTeamControl({
  mandateId,
  held,
  running,
  attempts,
  phases,
  failed,
  again = false,
  onChange,
}: {
  mandateId: string;
  held: number;
  running: boolean;
  attempts: number;
  phases: Phase[];
  failed?: string | null;
  /** A scorecard already exists — render as a compact footer row. */
  again?: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const carve = Math.min(100, held);
  const live = running || busy;

  async function start() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/mandates/${mandateId}/redteam/suite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "The red-team suite couldn't start.");
    setOpen(false);
    onChange();
    // Keep the button disabled until the start event lands in the log (next poll).
    setTimeout(() => setBusy(false), 4000);
  }

  const confirm = (
    <div className="animate-ink border border-deny bg-surface px-3 py-3" role="group" aria-labelledby="rt-confirm">
      <p id="rt-confirm" className="text-[14px] font-medium leading-snug text-ink">
        Sign a <span className="num">{usd(carve)}</span> sub-mandate for a compromised agent and attack it?
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">
        Carved from the <span className="num text-paypal">{usd(held)}</span> hold. Approval line <span className="num">$0.01</span>: nothing can be captured
        without you, and every escalation is declined. Runs 1–4 minutes, then the agent is revoked.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="deny" className="min-h-11 border-deny" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start the attack"}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );

  if (again && !live)
    return (
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[13px] leading-snug text-muted">Run it again — a new compromised agent, a fresh adversary, the same hold.</p>
        {open ? confirm : (
          <Button variant="deny" className="min-h-11 shrink-0 border-deny" onClick={() => setOpen(true)} aria-expanded={false}>
            Run red-team suite again
          </Button>
        )}
        {err && <p className="num text-[12px] text-deny">✗ {err}</p>}
      </div>
    );

  return (
    <section
      aria-labelledby="rt-head"
      className={cn("border bg-surface", live ? "border-deny" : "border-dashed border-deny/60")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 sm:px-6">
        <span className="label text-[10px] text-deny">Red team · live attack on this mandate</span>
        <span className="label text-[10px] text-muted" aria-live="polite">
          {live ? (
            <>
              Attacking<span className="caret ml-1" aria-hidden />
            </>
          ) : (
            "9 scripted attacks + an adversarial AI"
          )}
        </span>
      </div>

      <div className="grid gap-x-10 gap-y-4 px-4 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-end">
        <div className="min-w-0">
          <h2 id="rt-head" className="display text-[1.9rem] leading-[1.05] text-ink sm:text-[2.4rem]">
            We don&rsquo;t trust the AI.
            <br />
            We trust the boundary.
          </h2>
          <p className="mt-3 max-w-[34rem] text-[15px] leading-relaxed text-muted">
            Hand a compromised agent a real <span className="num text-ink">{usd(carve)}</span> sub-mandate from this hold and order it to steal. PayPal is
            asked before and after.
          </p>
        </div>

        <div className="min-w-0">
          {live ? (
            <div aria-live="polite">
              <p className="num text-[15px] text-ink">
                Attacking… <span className="text-deny">{attempts}</span> attempt{attempts === 1 ? "" : "s"} so far
              </p>
              <ol className="mt-2 border-t border-line">
                {phases.map((p, i) => {
                  const current = !p.done && phases.slice(0, i).every((q) => q.done);
                  return (
                    <li key={p.text} className="num flex items-baseline justify-between gap-3 border-b border-line/70 py-1.5 text-[12px]">
                      <span className={p.done ? "text-ink" : current ? "text-ink" : "text-muted"}>
                        <span className="mr-2 text-muted">0{i + 1}</span>
                        {p.text}
                      </span>
                      <span className={p.done ? "text-ink" : "text-muted"}>
                        {p.done ? "✓ done" : current ? <>running<span className="caret ml-1" aria-hidden /></> : "—"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : open ? (
            confirm
          ) : (
            <Button variant="deny" className="min-h-12 w-full border-deny text-[15px]" onClick={() => setOpen(true)} aria-expanded={false}>
              Run red-team suite
            </Button>
          )}
          {(err || failed) && <p className="num mt-2 text-[12px] text-deny">✗ {err ?? failed}</p>}
        </div>
      </div>
    </section>
  );
}
