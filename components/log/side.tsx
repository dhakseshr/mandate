"use client";
import { useEffect, useState } from "react";
import type { View } from "../mandate-screen";
import { Button, SealTag, Stamp, cn, signatureOf, usd } from "../ui";
import { CopyId, Thumb } from "./shared";
import { useNames } from "../team/names";

type Approval = View["approvals"][number];
type Purchase = View["purchases"][number];

/** The mandate's stub: signature, the PayPal hold, how long it's good for, AP2 export. */
export function InstrumentStub({ mandate, authorized, held, closed }: { mandate: View["mandate"]; authorized: number; held: number; closed: boolean }) {
  const hash = signatureOf(mandate);
  const mm = mandate as { expiresAt?: string | Date | null; signedWith?: string | null; passkeyIntentHash?: string | null; parentId?: string | null; rootId?: string | null };
  const expires = mm.expiresAt;
  return (
    <section className="border border-line bg-surface" aria-label="Mandate instrument">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="label text-[10px] text-muted">Instrument</span>
        {hash ? <SealTag hash={hash} /> : <span className="label text-[10px] text-muted">Unsigned</span>}
      </div>
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3 text-[12px]">
        {hash && (
          <>
            <dt className="label pt-[3px] text-[10px] text-muted">Signed with</dt>
            <dd className="num min-w-0 text-ink">
              {mm.signedWith === "passkey" ? (
                <>
                  <span className="text-allow" aria-hidden>✓ </span>Passkey
                  {mm.passkeyIntentHash && (
                    <span className="text-muted">
                      {" "}· intent <span className="text-ink" title={`sha256 ${mm.passkeyIntentHash}`}>#{mm.passkeyIntentHash.slice(0, 8)}</span>
                    </span>
                  )}
                </>
              ) : mm.parentId ? (
                <span className="text-muted">Orchestrator, under your mandate</span>
              ) : (
                <span className="text-muted">PayPal approval</span>
              )}
            </dd>
          </>
        )}
        {mm.parentId && (
          <>
            <dt className="label pt-[3px] text-[10px] text-muted">Parent</dt>
            <dd className="num min-w-0 truncate">
              <a href={`/m/${mm.parentId}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">№ {mm.parentId}</a>
            </dd>
          </>
        )}
        <dt className="label pt-[3px] text-[10px] text-muted">Authorization</dt>
        <dd className="min-w-0">
          {mandate.authorizationId ? (
            <CopyId value={mandate.authorizationId} label="PayPal authorization" />
          ) : mm.parentId ? (
            <span className="num text-muted">root PayPal hold</span>
          ) : (
            <span className="num text-muted">—</span>
          )}
        </dd>
        <dt className="label pt-[3px] text-[10px] text-muted">Held</dt>
        <dd className="num text-paypal">
          {usd(closed ? 0 : held)} <span className="text-muted">of {usd(authorized)}</span>
        </dd>
        <dt className="label pt-[3px] text-[10px] text-muted">Valid until</dt>
        <dd className="num text-ink">
          {expires ? new Date(expires).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
        </dd>
        {hash && (
          <>
            <dt className="label pt-[3px] text-[10px] text-muted">AP2</dt>
            <dd>
              <a href={`/api/mandates/${mandate.id}/ap2?download`} className="num text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                export intent mandate ↓
              </a>
            </dd>
          </>
        )}
      </dl>
      <a
        href={`/agents/${encodeURIComponent(mandate.id)}`}
        className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 text-[13px] text-ink hover:bg-surface-2"
      >
        <span>Agent passport</span>
        <span aria-hidden className="num">→</span>
      </a>
      <a
        href={`/verify?mandate=${encodeURIComponent(mandate.id)}`}
        className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 text-[13px] text-ink hover:bg-surface-2"
      >
        <span>Verify an order as a merchant</span>
        <span aria-hidden className="num">→</span>
      </a>
    </section>
  );
}

/** A tear-off slip that asks for one thing: your signature on this purchase. */
export function ApprovalSlip({ a, authorizationId, onDone }: { a: Approval; authorizationId?: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const [note, setNote] = useState("");
  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision);
    await fetch(`/api/approvals/${a.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: note || undefined }),
    });
    onDone();
  }
  const amount = a.product.price * a.quantity;
  const ev = a.evaluation as { rule?: string; message?: string };
  const names = useNames();
  const who = names && a.mandateId !== names.self ? names.byId[a.mandateId] : undefined;
  return (
    <section className="animate-ink border border-escalate bg-surface shadow-paper" aria-labelledby={`slip-${a.id}`}>
      <div className="perforation" aria-hidden />
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <p id={`slip-${a.id}`} className="label text-[10px] text-escalate">Your signature required</p>
          <span className="label text-[10px] text-muted">Slip {a.id.slice(-6)}</span>
        </div>
        {who && (
          <p className="label mt-1.5 text-[10px] text-muted">
            Asked by <span className="text-ink">{who}</span> · <span className="num normal-case tracking-normal">№ {a.mandateId}</span>
          </p>
        )}

        <div className="mt-3 flex gap-3">
          <Thumb src={a.product.image} size={64} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-medium leading-snug">{a.product.title}</p>
            <p className="num mt-0.5 truncate text-[12px] text-muted">{a.product.merchant}{a.product.rating != null ? ` · ★ ${a.product.rating}` : ""}</p>
          </div>
        </div>

        <dl className="num mt-3 border-y border-line text-[12px]">
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-muted">Catalog price{a.quantity > 1 ? ` × ${a.quantity}` : ""}</dt>
            <dd className="text-ink">{usd(a.product.price)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-dashed border-line py-1.5">
            <dt className="text-muted">To capture</dt>
            <dd className="text-[15px] font-medium text-ink">{usd(amount)}</dd>
          </div>
        </dl>

        {ev.message && (
          <p className="num mt-3 text-[12px] leading-relaxed text-escalate">
            <span className="mr-1.5">§</span>
            {ev.rule && <span className="font-medium">{ev.rule} — </span>}
            <span className="text-ink">{ev.message}</span>
          </p>
        )}

        {a.rationale && (
          <figure className="mt-3 border-l border-line pl-3">
            <figcaption className="label text-[10px] text-muted">Agent</figcaption>
            <blockquote className="mt-1 text-[13px] leading-relaxed text-ink">“{a.rationale}”</blockquote>
          </figure>
        )}

        <label className="mt-4 block">
          <span className="label text-[10px] text-muted">Note to agent · optional</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. want a better-known brand"
            className="mt-1.5 min-h-11 w-full rounded-[2px] border border-line bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-ink sm:text-sm"
          />
        </label>

        <div className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <Button variant="ghost" className="min-h-11" disabled={!!busy} onClick={() => decide("REJECT")}>
            {busy === "REJECT" ? "Declining…" : "Decline"}
          </Button>
          <Button variant="primary" className="num min-h-11" disabled={!!busy} onClick={() => decide("APPROVE")}>
            {busy === "APPROVE" ? "Capturing…" : `Approve ${usd(amount)}`}
          </Button>
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-muted">
          Approving captures {usd(amount)} from PayPal hold{" "}
          {authorizationId ? <span className="num text-paypal">{authorizationId}</span> : "on this mandate"} — never more than it holds.
        </p>
      </div>
    </section>
  );
}

/** External (MCP) agent: connection instructions until it connects, then one line. */
export function ConnectAgent({ token, connected, name, active }: { token: string | null; connected: boolean; name: string | null; active: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (connected)
    return (
      <p className="num border border-line bg-surface-2 px-4 py-2.5 text-[12px]">
        <span className="text-allow">✓</span> <span className="text-muted">Connected:</span> <span className="text-ink">{name || "external agent"}</span>
        <span className="text-muted"> · over MCP</span>
      </p>
    );
  if (!token)
    return (
      <p className="num border border-line bg-surface-2 px-4 py-3 text-[12px] text-muted">
        Agent token is issued when the PayPal hold is approved{active ? " — refresh in a moment." : "."}
      </p>
    );
  const url = `${origin}/api/mcp?token=${token}`;
  const rows: [string, string][] = [
    ["MCP URL", url],
    ["Claude Code", `claude mcp add --transport http mandate "${url}"`],
    ["Any MCP client (JSON)", JSON.stringify({ mcpServers: { mandate: { type: "http", url } } }, null, 2)],
  ];
  return (
    <section className="border border-line bg-surface-2" aria-label="Connect your agent">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="label text-[10px] text-ink">Connect your agent</span>
        <span className="label text-[10px] text-muted">MCP · HTTP</span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-[13px] text-muted">
          Paste into Claude or any MCP client. Tools: <span className="num text-[12px] text-ink">get_mandate · search_products · check_policy · propose_purchase · get_status · finish</span>
        </p>
        {rows.map(([label, value]) => (
          <CopyRow key={label} label={label} value={value} />
        ))}
        <p className="num text-[11px] text-muted">$ token is scoped to this signed mandate and its PayPal hold.</p>
      </div>
    </section>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="label text-[10px] text-muted">{label}</span>
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(value)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => {})
          }
          className="label min-h-8 rounded-[2px] px-2 text-[10px] text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
          aria-label={`Copy ${label}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="num mt-1 whitespace-pre-wrap break-all border border-line bg-surface px-2.5 py-2 text-[11px] leading-relaxed text-ink">{value}</pre>
    </div>
  );
}

/** Purchases as a bank statement: merchant · amount · PayPal capture · status, double rule, total. */
export function Statement({ purchases, captured, refunded, onDone }: { purchases: Purchase[]; captured: number; refunded: number; onDone: () => void }) {
  return (
    <section className="border border-line bg-surface" aria-label="Purchases">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="label text-[10px] text-ink">Statement</span>
        <span className="label text-[10px] text-muted">{purchases.length} {purchases.length === 1 ? "purchase" : "purchases"}</span>
      </div>
      <ul>
        {purchases.map((p) => (
          <StatementRow key={p.id} p={p} onDone={onDone} />
        ))}
      </ul>
      <dl className="num border-t-[3px] border-double border-ink px-4 py-2.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="label pt-[3px] text-[10px] text-ink">Total captured</dt>
          <dd className="text-[15px] font-medium text-ink">{usd(captured)}</dd>
        </div>
        {refunded > 0 && (
          <div className="mt-1 flex justify-between text-muted">
            <dt className="label pt-[3px] text-[10px]">Refunded</dt>
            <dd>−{usd(refunded)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function StatementRow({ p, onDone }: { p: Purchase; onDone: () => void }) {
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
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Refund failed.");
    setBusy(false);
    setOpen(false);
    onDone();
  }
  const refunded = p.status === "REFUNDED";
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <Thumb src={p.product.image} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] font-medium">{p.product.title}</p>
            <p className={cn("num shrink-0 text-[13px]", refunded ? "text-muted line-through" : "text-ink")}>{usd(p.amount)}</p>
          </div>
          <p className="num truncate text-[11px] text-muted">{p.merchant}</p>
          <dl className="num mt-1.5 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[11px]">
            <dt className="text-muted">capture</dt>
            <dd className="min-w-0">{p.captureId ? <CopyId value={p.captureId} label="capture ID" /> : "—"}</dd>
            {p.refundId && (
              <>
                <dt className="text-muted">refund</dt>
                <dd className="min-w-0"><CopyId value={p.refundId} label="refund ID" /></dd>
              </>
            )}
            {p.trackingNumber && (
              <>
                <dt className="text-muted">tracking</dt>
                <dd className="truncate text-ink">USPS {p.trackingNumber} <span className="text-muted">(sim.)</span></dd>
              </>
            )}
            <dt className="text-muted">status</dt>
            <dd className={cn(p.status === "CAPTURED" ? "text-paypal" : "text-muted")}>
              {p.status.replace("_", " ")}
              {p.status === "CAPTURED" && !open && (
                <button onClick={() => setOpen(true)} className="ml-3 text-ink underline decoration-line underline-offset-4 hover:decoration-deny hover:text-deny">
                  Refund…
                </button>
              )}
            </dd>
          </dl>
          <a href={`/forensics/${p.id}`} className="num mt-1.5 inline-flex min-h-8 items-center text-[11px] text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            Report a problem → Forensics
          </a>
        </div>
      </div>
      {open && (
        <div className="mt-2.5 flex gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refund()}
            placeholder="Reason, e.g. wrong size"
            aria-label="Refund reason"
            className="min-h-11 min-w-0 flex-1 rounded-[2px] border border-line bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-ink sm:text-sm"
          />
          <Button variant="deny" className="min-h-11 px-3" disabled={busy} onClick={refund}>
            {busy ? "Refunding…" : "Refund"}
          </Button>
          <Button variant="ghost" className="min-h-11 px-3" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {err && <p className="mt-1 text-[12px] text-deny">{err}</p>}
    </li>
  );
}

/** Done: the agent's summary filed as a statement. */
export function Filed({ summary, spent, released, refunded }: { summary: string; spent: number; released: number; refunded: number }) {
  return (
    <section className="relative border border-line bg-surface px-4 py-4" aria-label="Mandate filed">
      <div className="flex items-start justify-between gap-3">
        <span className="label text-[10px] text-muted">Filed · agent&apos;s report</span>
        <Stamp verdict="APPROVED" rotate={-6} className="text-ink border-ink">FILED</Stamp>
      </div>
      <p className="display mt-3 text-[17px] italic leading-snug text-ink">{summary}</p>
      <dl className="num mt-4 grid grid-cols-3 border-t border-line pt-2.5 text-[12px]">
        {([
          ["Spent", spent, "text-ink"],
          ["Released", released, "text-paypal"],
          ["Refunded", refunded, "text-ink"],
        ] as const).map(([k, v, tone]) => (
          <div key={k} className="min-w-0">
            <dt className="label text-[10px] text-muted">{k}</dt>
            <dd className={cn("mt-1 truncate text-[14px]", tone)}>{usd(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
