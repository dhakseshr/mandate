"use client";
import { useId, useState } from "react";
import { Button, Stamp, cn, usd } from "../ui";

const fmt = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/**
 * The kill switch. Deliberately two steps: a deny-outlined control that opens an inline confirm
 * with the exact consequence and a reason, then POST /revoke. Never a modal, never one click.
 */
export function RevokeControl({
  mandateId,
  name,
  amount,
  root,
  onDone,
  compact = false,
  className,
}: {
  mandateId: string;
  /** Display name of what is revoked ("this mandate", "Monitor agent"). */
  name?: string;
  /** Root: the PayPal hold still held. Sub-mandate: its unspent allocation. */
  amount: number;
  root: boolean;
  onDone: () => void;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fid = useId();

  async function revoke() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/mandates/${mandateId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Couldn't revoke.");
    else setOpen(false);
    setBusy(false);
    onDone();
  }

  if (!open)
    return (
      <Button
        variant="deny"
        className={cn("min-h-11 rounded-[2px]", compact ? "px-3 text-[13px]" : "w-full", className)}
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        {compact ? "Revoke…" : root ? "Revoke mandate" : `Revoke ${name ?? "sub-mandate"}`}
      </Button>
    );

  return (
    <div className={cn("animate-ink w-full border border-deny bg-surface px-3 py-3", className)} role="group" aria-labelledby={`${fid}-q`}>
      <p id={`${fid}-q`} className="text-[14px] font-medium leading-snug text-ink">
        {root ? (
          <>
            Revoke and release the <span className="num text-paypal">{usd(amount)}</span> hold?
          </>
        ) : (
          <>
            Revoke {name ?? "this sub-mandate"}? <span className="num">{usd(amount)}</span> returns to the parent.
          </>
        )}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">
        {root ? "Every agent under it stops immediately; pending approvals are declined. This can't be undone." : "Its agent and any agents under it stop immediately. This can't be undone."}
      </p>
      <label className="mt-3 block">
        <span className="label text-[10px] text-muted">Reason · goes in the ledger</span>
        <input
          autoFocus
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) revoke();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="e.g. plans changed"
          className="mt-1.5 min-h-11 w-full rounded-[2px] border border-line bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-deny sm:text-sm"
        />
      </label>
      <div className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => setOpen(false)}>
          Keep it
        </Button>
        <Button variant="deny" className="min-h-11 border-deny bg-deny text-on-accent hover:bg-deny/90" disabled={busy} onClick={revoke}>
          {busy ? "Revoking…" : "Revoke now"}
        </Button>
      </div>
      {err && <p className="num mt-2 text-[12px] text-deny">✗ {err}</p>}
    </div>
  );
}

/** A revoked mandate is a closed instrument, not an error: stamp, when, why, where the money went. */
export function RevokedState({
  revokedAt,
  reason,
  released,
  root,
  parentId,
  authorizationId,
}: {
  revokedAt?: string | Date | null;
  reason?: string | null;
  released: number;
  root: boolean;
  parentId?: string | null;
  authorizationId?: string | null;
}) {
  return (
    <section aria-label="Mandate revoked" className="animate-ink border border-line bg-surface">
      <div className="grid gap-5 px-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:px-6">
        <div className="pl-1">
          <Stamp verdict="DENY" size="md" rotate={-5} animate>
            Revoked
          </Stamp>
        </div>
        <div className="min-w-0">
          <p className="display text-[1.35rem] leading-snug text-ink">
            {root ? "You stopped this mandate. Every agent under it stopped with it." : "This sub-mandate was revoked. Its agent can no longer buy anything."}
          </p>
          <dl className="num mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px]">
            {revokedAt && (
              <>
                <dt className="label pt-[3px] text-[10px] text-muted">Revoked at</dt>
                <dd className="text-ink">{fmt(revokedAt)}</dd>
              </>
            )}
            {reason && (
              <>
                <dt className="label pt-[3px] text-[10px] text-muted">Reason</dt>
                <dd className="display text-[15px] italic leading-snug text-ink">“{reason}”</dd>
              </>
            )}
            <dt className="label pt-[3px] text-[10px] text-muted">{root ? "Hold" : "Allocation"}</dt>
            <dd className={root ? "text-paypal" : "text-ink"}>
              {root ? (
                <>
                  Hold released · {usd(released)} back to the buyer
                  {authorizationId && <span className="text-muted"> · {authorizationId}</span>}
                </>
              ) : (
                <>
                  {usd(released)} returned to{" "}
                  {parentId ? (
                    <a href={`/m/${parentId}`} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                      № {parentId}
                    </a>
                  ) : (
                    "the parent"
                  )}
                </>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
