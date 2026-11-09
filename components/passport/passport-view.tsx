"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { Button, Seal, Stamp, cn, usd } from "../ui";
import { CopyId } from "../log/shared";

type Amt = { currency_code: string; value: string };
type Passport = {
  "passport.issued_at"?: string;
  agent: { id: string; name: string; mode: string | null };
  authority: {
    status: string;
    valid_until: string | null;
    spending_limit: Amt;
    spent: Amt;
    remaining: Amt;
    max_per_transaction: number | null;
    ask_human_above: number | null;
    max_items: number | null;
    categories: string[];
    blocked_merchants: string[];
    approved_merchants: string[];
    may_delegate: string;
  };
  delegation_chain: { mandate_id: string; name: string | null; sha256: string | null }[];
  backed_by: { processor: string; environment: string; authorization_id: string | null };
  human_signature: { type: string; intent_sha256?: string | null } | null;
  assurance_certificate: { id: string; sha256: string; result: string } | null;
};
type Proof = { sha256: string; signature: string; public_key_pem: string };

/** ICAO-ish machine-readable zone: uppercase A–Z0–9 and '<' fillers, 44 chars a line. */
function mrz(p: Passport, proof: Proof) {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "<").replace(/^<+|<+$/g, "");
  const pad = (s: string) => (s + "<".repeat(44)).slice(0, 44);
  const name = clean(p.agent.name).replace(/<AGENT$/, "");
  const l1 = pad(`P<WRIT<<${name}<AGENT<<${clean(p.agent.mode ?? "")}`);
  const until = p.authority.valid_until ? new Date(p.authority.valid_until).toISOString().slice(2, 10).replace(/-/g, "") : "000000";
  const l2 = pad(`${clean(p.agent.id)}<${until}<USD${p.authority.spending_limit.value.replace(".", "")}<${proof.sha256.slice(0, 10).toUpperCase()}`);
  return [l1, l2];
}

const STATUS_STAMP: Record<string, { v: "ALLOW" | "DENY" | "APPROVED"; text: string; ink?: boolean }> = {
  ACTIVE: { v: "ALLOW", text: "Valid · active" },
  REVOKED: { v: "DENY", text: "Revoked" },
  FULFILLED: { v: "APPROVED", text: "Closed", ink: true },
  VOIDED: { v: "APPROVED", text: "Voided", ink: true },
  EXPIRED: { v: "DENY", text: "Expired" },
};

export function PassportView({ id }: { id: string }) {
  const [data, setData] = useState<{ passport: Passport; proof: Proof } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [check, setCheck] = useState<"idle" | "busy" | "valid" | "invalid">("idle");

  useEffect(() => {
    fetch(`/api/agents/${id}/passport`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setErr((await r.json().catch(() => ({}))).error ?? "Unknown agent")))
      .catch(() => setErr("Couldn't load the passport."));
  }, [id]);

  async function verify() {
    if (!data) return;
    setCheck("busy");
    const r = await fetch("/api/verify?check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt: data.passport, signature: data.proof.signature, public_key_pem: data.proof.public_key_pem }),
    });
    const j = await r.json().catch(() => ({}));
    setCheck(r.ok && j.valid ? "valid" : "invalid");
  }

  if (err)
    return (
      <div className="mx-auto max-w-[560px] border border-line bg-surface px-5 py-6">
        <span className="label">Agent passport</span>
        <h1 className="display mt-3 text-3xl leading-tight">No agent on file under № {id}.</h1>
        <p className="mt-2 text-[15px] text-muted">{err}</p>
      </div>
    );
  if (!data)
    return (
      <p className="label flex items-center gap-2 py-24 text-muted" role="status">
        Issuing passport for <span className="num normal-case tracking-normal text-ink">№ {id}</span>
        <span className="caret" />
      </p>
    );

  const { passport: p, proof } = data;
  const a = p.authority;
  const st = STATUS_STAMP[a.status] ?? { v: "APPROVED" as const, text: a.status, ink: true };
  const date = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const list = (xs: string[]) => (xs?.length ? xs.join(", ") : "—");
  const limits: [string, React.ReactNode][] = [
    ["Spending limit", <span key="l" className="text-ink">{usd(Number(a.spending_limit.value))}</span>],
    ["Spent", <span key="s" className="text-paypal">{usd(Number(a.spent.value))}</span>],
    ["Remaining", <span key="r" className="text-ink">{usd(Number(a.remaining.value))}</span>],
    ["Max per transaction", a.max_per_transaction != null ? usd(a.max_per_transaction) : "—"],
    ["Ask human above", a.ask_human_above != null ? usd(a.ask_human_above) : "never"],
    ["Max items", a.max_items ?? "—"],
    ["Categories", list(a.categories)],
    ["Blocked merchants", list(a.blocked_merchants)],
    ["Approved merchants", a.approved_merchants?.length ? list(a.approved_merchants) : "any not blocked"],
    ["May delegate", a.may_delegate],
  ];
  const lines = mrz(p, proof);
  const root = p.delegation_chain[0]?.mandate_id;

  return (
    <div className="min-w-0">
      <header className="pb-8 pt-2 sm:pt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="label">Agent passport · scoped to Writ</span>
          <Link href={`/m/${p.agent.id}`} className="label text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            ← Mandate <span className="num normal-case tracking-normal">№ {p.agent.id}</span>
          </Link>
        </div>
        <h1 className="display-lg mt-5 max-w-[50rem] text-ink">
          What this agent may spend, and who said so.
        </h1>
        <p className="mt-4 max-w-[38rem] text-[15px] leading-relaxed text-muted">
          A signed statement of one agent&apos;s financial authority. Hand it to a merchant or another agent; they can verify it without trusting us.
        </p>
      </header>

      <article className="mx-auto max-w-[760px] border border-ink/80 bg-surface shadow-paper" aria-label={`Passport for ${p.agent.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-6">
          <span className="label text-ink">Writ · agent financial passport</span>
          <span className="label text-muted">
            Type <span className="num normal-case tracking-normal text-ink">P</span> · {p.backed_by.environment}
          </span>
        </div>

        <div className="grid gap-6 px-4 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-6">
          <div className="flex items-start gap-4 sm:flex-col sm:items-center">
            <Seal hash={proof.sha256} size={128} label="WRIT · PASSPORT" animate />
            <Stamp verdict={st.v} rotate={-5} size="md" className={cn(st.ink && "border-ink text-ink")}>{st.text}</Stamp>
          </div>
          <dl className="grid min-w-0 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
            <dt className="label pt-[3px] text-[10px] text-muted">Holder</dt>
            <dd className="display text-[1.5rem] leading-tight text-ink">{p.agent.name}</dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Agent №</dt>
            <dd className="num min-w-0 truncate text-ink">{p.agent.id}</dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Mode</dt>
            <dd className="num text-ink">{p.agent.mode ?? "—"}</dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Issued</dt>
            <dd className="num text-ink">{date(p["passport.issued_at"])}</dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Valid until</dt>
            <dd className="num text-ink">{date(a.valid_until)}</dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Backed by</dt>
            <dd className="num min-w-0 text-ink">
              PayPal hold{" "}
              {p.backed_by.authorization_id ? <CopyId value={p.backed_by.authorization_id} label="PayPal authorization" /> : "—"}
            </dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Human signed</dt>
            <dd className="num min-w-0 text-ink">
              {p.human_signature ? (
                <>
                  <span className="text-allow" aria-hidden>✓ </span>
                  {p.human_signature.type === "webauthn" ? "Passkey" : p.human_signature.type}
                  {p.human_signature.intent_sha256 && <span className="text-muted"> · intent #{p.human_signature.intent_sha256.slice(0, 8)}</span>}
                </>
              ) : (
                <span className="text-muted">PayPal approval</span>
              )}
            </dd>
            <dt className="label pt-[3px] text-[10px] text-muted">Assurance</dt>
            <dd className="num min-w-0 text-ink">
              {p.assurance_certificate ? (
                <>
                  {p.assurance_certificate.result} · cert <span title={p.assurance_certificate.sha256}>#{p.assurance_certificate.sha256.slice(0, 8)}</span>
                </>
              ) : (
                <span className="text-muted">no red-team certificate yet</span>
              )}
            </dd>
          </dl>
        </div>

        {/* Delegation chain */}
        <section className="border-t border-line px-4 py-4 sm:px-6" aria-labelledby="chain-h">
          <h2 id="chain-h" className="label text-[10px] text-ink">Delegation chain · human → agent</h2>
          <ol className="mt-3 space-y-0">
            {p.delegation_chain.map((c, i) => (
              <li key={c.mandate_id} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-3 last:pb-0">
                {i < p.delegation_chain.length - 1 && <span aria-hidden className="absolute bottom-0 left-[0.8rem] top-6 w-px bg-line" />}
                <span className={cn("num relative grid h-6 w-6 place-items-center border bg-surface text-[11px]", i === 0 ? "border-ink text-ink" : "border-line text-muted")}>{i + 1}</span>
                <div className="min-w-0">
                  <p className={cn("text-[14px] leading-tight text-ink", i === 0 && "display text-[1.05rem]")}>{i === 0 ? "You — the human principal" : c.name ?? "Sub-agent"}</p>
                  <p className="num mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
                    <Link href={`/m/${c.mandate_id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">№ {c.mandate_id}</Link>
                    {c.sha256 && <span title={c.sha256}>signed #{c.sha256.slice(0, 8)}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Limits */}
        <section className="border-t border-line px-4 py-4 sm:px-6" aria-labelledby="limits-h">
          <h2 id="limits-h" className="label text-[10px] text-ink">Authority · limits enforced by code</h2>
          <dl className="num mt-2 text-[12px]">
            {limits.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 border-b border-line/70 py-1.5 last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-right text-ink sm:text-left">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Verify / download */}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="num min-w-0 text-[11px] text-muted" aria-live="polite">
            {check === "valid" ? (
              <span className="text-allow">✓ Valid — Ed25519 signature checks against Writ&apos;s public key</span>
            ) : check === "invalid" ? (
              <span className="text-deny">✗ Invalid — signature does not match this passport</span>
            ) : (
              <>
                sha256 <span className="text-ink" title={proof.sha256}>{proof.sha256.slice(0, 24)}…</span> · Ed25519
              </>
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" className="min-h-11" onClick={verify} disabled={check === "busy"}>
              <ShieldCheck size={14} aria-hidden /> {check === "busy" ? "Verifying…" : "Verify"}
            </Button>
            <a
              href={`/api/agents/${p.agent.id}/passport?download`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[2px] bg-ink px-4 text-sm font-medium text-on-accent hover:bg-ink/90"
            >
              <Download size={14} aria-hidden /> Download
            </a>
          </div>
        </div>

        {/* Machine-readable zone */}
        <div className="border-t-[3px] border-double border-ink bg-surface-2 px-4 py-3 sm:px-6" aria-label="Machine-readable zone">
          {lines.map((l, i) => (
            <p key={i} className="mrz text-ink">{l}</p>
          ))}
        </div>
      </article>

      {root && root !== p.agent.id && (
        <p className="mx-auto mt-4 max-w-[760px] text-[12px] text-muted">
          Issued under the root mandate{" "}
          <Link href={`/agents/${root}`} className="num text-ink underline decoration-line underline-offset-4 hover:decoration-ink">№ {root}</Link> — a sub-agent&apos;s
          authority is always narrower than its parent&apos;s.
        </p>
      )}
    </div>
  );
}
