"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Stamp, cn, usd, type StampVerdict } from "@/components/ui";
import { CopyId } from "@/components/log/shared";

type Verdict = "ALLOW" | "ESCALATE" | "DENY";
type Receipt = {
  "receipt.type"?: string;
  "receipt.issued_at"?: string;
  verdict: Verdict;
  rule: string;
  message: string;
  mandate: { id: string; sha256: string | null; status: string; root: { id: string; sha256: string | null; paypal_authorization_id: string | null } };
  order: { merchant: string; total: { currency_code: string; value: string } | number; items: number | unknown[] };
};
type Proof = { sha256: string; signature: string; public_key_pem: string; type?: string; canonicalization?: string };
type Result =
  | { kind: "receipt"; authorized: boolean; receipt: Receipt; proof: Proof; items: Item[] }
  | { kind: "unknown"; mandateId: string }
  | { kind: "error"; message: string };
type Item = { title: string; price: number; quantity: number };

const VERDICT: Record<Verdict, { stamp: StampVerdict; text: string; line: string; tone: string }> = {
  ALLOW: { stamp: "ALLOW", text: "Authorized — ship it", line: "A signed human mandate covers this order, within its limits, right now.", tone: "text-allow" },
  ESCALATE: { stamp: "ESCALATE", text: "Hold — human approval required", line: "The mandate allows this only with the human's sign-off. Don't ship until they approve.", tone: "text-escalate" },
  DENY: { stamp: "DENY", text: "Do not fulfil", line: "No human authorized this order. Shipping it is at your own risk.", tone: "text-deny" },
};

const field =
  "mt-1.5 min-h-11 w-full rounded-[2px] border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted focus:border-ink sm:text-sm";

export function VerifyDesk({ initialMandate }: { initialMandate: string }) {
  const [mandateId, setMandateId] = useState(initialMandate);
  const [merchant, setMerchant] = useState("bestbuy.com");
  const [title, setTitle] = useState("27-inch IPS monitor");
  const [price, setPrice] = useState("129.99");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [n, setN] = useState(0);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    const items: Item[] = [{ title: title.trim(), price: Number(price), quantity: Math.max(1, Math.floor(Number(qty) || 1)) }];
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate_id: mandateId.trim(), merchant: merchant.trim(), items }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 || j.reason === "UNKNOWN_MANDATE") setResult({ kind: "unknown", mandateId: mandateId.trim() });
      else if (!r.ok) setResult({ kind: "error", message: j.error ?? "The order couldn't be checked." });
      else setResult({ kind: "receipt", authorized: !!j.authorized, receipt: j.receipt, proof: j.proof, items });
      setN((x) => x + 1);
    } catch {
      setResult({ kind: "error", message: "Network error — the order wasn't checked." });
    }
    setBusy(false);
  }

  const total = (Number(price) || 0) * Math.max(1, Math.floor(Number(qty) || 1));

  return (
    <div className="grid grid-cols-1 gap-8 border-t border-line pt-10 lg:grid-cols-12 lg:gap-10">
      {/* The question */}
      <section aria-labelledby="ask" className="min-w-0 lg:col-span-5">
        <h2 id="ask" className="label">
          The order the agent placed
        </h2>
        <form onSubmit={submit} className="mt-5 border border-line bg-surface">
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <label className="block">
              <span className="label text-[10px] text-muted">Mandate ID · the agent presents it</span>
              <input required value={mandateId} onChange={(e) => setMandateId(e.target.value)} placeholder="man_…" className={cn(field, "num")} spellCheck={false} autoCapitalize="off" />
            </label>
            <label className="block">
              <span className="label text-[10px] text-muted">Your domain</span>
              <input required minLength={3} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="shop.example.com" className={cn(field, "num")} spellCheck={false} autoCapitalize="off" />
            </label>
            <label className="block">
              <span className="label text-[10px] text-muted">Item</span>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's in the cart" className={field} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <label className="block">
                <span className="label text-[10px] text-muted">Unit price · USD</span>
                <input required inputMode="decimal" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={cn(field, "num")} />
              </label>
              <label className="block">
                <span className="label text-[10px] text-muted">Qty</span>
                <input required inputMode="numeric" type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className={cn(field, "num")} />
              </label>
            </div>
          </div>
          <div className="num flex items-baseline justify-between border-t-[3px] border-double border-ink px-4 py-2.5 text-[12px] sm:px-5">
            <span className="label pt-[3px] text-[10px] text-ink">Order total</span>
            <span className="text-[15px] font-medium text-ink">{usd(total)}</span>
          </div>
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <Button type="submit" className="min-h-11 w-full" disabled={busy}>
              {busy ? "Asking Mandate…" : "Verify this order"}
            </Button>
            <p className="mt-2.5 text-[12px] leading-snug text-muted">Read-only. Nothing is captured; the check is recorded in the mandate&apos;s ledger.</p>
          </div>
        </form>

        <div className="mt-6 border border-line bg-surface-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="label text-[10px]">Same check, from your checkout</span>
            <span className="label text-[10px] text-muted">HTTP</span>
          </div>
          <pre className="num overflow-x-auto whitespace-pre-wrap break-all px-4 py-3 text-[11px] leading-relaxed text-ink">{`POST /api/verify
{ "mandate_id": "${mandateId || "man_…"}",
  "merchant": "${merchant}",
  "items": [{ "title": "…", "price": ${Number(price) || 0}, "quantity": ${Math.max(1, Math.floor(Number(qty) || 1))} }] }`}</pre>
        </div>
      </section>

      {/* The answer */}
      <section aria-labelledby="answer" aria-live="polite" className="min-w-0 lg:col-span-7">
        <h2 id="answer" className="label">
          Mandate&apos;s answer
        </h2>
        <div className="mt-5">
          {!result ? (
            <EmptyReceipt />
          ) : result.kind === "receipt" ? (
            <SignedReceipt key={n} r={result} />
          ) : result.kind === "unknown" ? (
            <Unknown key={n} id={result.mandateId} />
          ) : (
            <p role="alert" className="border-l-2 border-deny pl-3 text-sm text-deny">
              {result.message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyReceipt() {
  return (
    <div className="border border-dashed border-line px-5 py-10 text-center sm:px-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-dashed border-muted/60" aria-hidden>
        <span className="label text-[8px] leading-tight text-muted">
          No
          <br />
          receipt
        </span>
      </span>
      <p className="display mt-4 text-xl italic text-muted">Ask before you ship.</p>
      <p className="mx-auto mt-2 max-w-[36ch] text-sm leading-relaxed text-muted">
        The receipt says ship, hold, or don&apos;t — and is signed, so you can prove it later.
      </p>
    </div>
  );
}

function Unknown({ id }: { id: string }) {
  return (
    <article className="animate-ink border border-line bg-surface shadow-paper">
      <div className="perforation" aria-hidden />
      <div className="px-5 pb-6 pt-3 sm:px-8">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label text-ink">Verification receipt</span>
          <span className="label text-muted">Unsigned</span>
        </div>
        <div className="py-8">
          <Stamp verdict="DENY" size="md" rotate={-5} animate className="text-xl sm:text-2xl">
            Do not fulfil
          </Stamp>
        </div>
        <p className="num text-[13px] text-deny">UNKNOWN_MANDATE</p>
        <p className="mt-1 text-[15px] leading-relaxed text-ink">
          No mandate on file under <span className="num">№ {id || "—"}</span>. Nobody authorized an agent to buy with this number.
        </p>
      </div>
    </article>
  );
}

function SignedReceipt({ r }: { r: Extract<Result, { kind: "receipt" }> }) {
  const { receipt, proof, items } = r;
  const v = VERDICT[receipt.verdict] ?? VERDICT.DENY;
  const issued = receipt["receipt.issued_at"];
  const total = typeof receipt.order.total === "number" ? receipt.order.total : Number(receipt.order.total?.value ?? 0);
  const [check, setCheck] = useState<{ valid: boolean; hash?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function verifySig() {
    setChecking(true);
    try {
      const res = await fetch("/api/verify?check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt, signature: proof.signature, public_key_pem: proof.public_key_pem }),
      });
      const j = await res.json().catch(() => ({}));
      setCheck({ valid: !!j.valid, hash: j.hash });
    } catch {
      setCheck({ valid: false });
    }
    setChecking(false);
  }

  const chain: { k: string; v: React.ReactNode }[] = [
    {
      k: "Mandate",
      v: (
        <>
          <Link href={`/m/${receipt.mandate.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            № {receipt.mandate.id}
          </Link>
          {receipt.mandate.sha256 && <span className="text-muted"> · signed #{receipt.mandate.sha256.slice(0, 8)}</span>}
          <span className={cn("ml-2", receipt.mandate.status === "ACTIVE" ? "text-paypal" : receipt.mandate.status === "REVOKED" ? "text-deny" : "text-muted")}>
            {receipt.mandate.status}
          </span>
        </>
      ),
    },
  ];
  if (receipt.mandate.root && receipt.mandate.root.id !== receipt.mandate.id)
    chain.push({
      k: "Under root",
      v: (
        <>
          <Link href={`/m/${receipt.mandate.root.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            № {receipt.mandate.root.id}
          </Link>
          {receipt.mandate.root.sha256 && <span className="text-muted"> · signed #{receipt.mandate.root.sha256.slice(0, 8)}</span>}
        </>
      ),
    });
  chain.push({
    k: "PayPal hold",
    v: receipt.mandate.root?.paypal_authorization_id ? (
      <CopyId value={receipt.mandate.root.paypal_authorization_id} label="PayPal authorization" />
    ) : (
      <span className="text-muted">none on file</span>
    ),
  });

  return (
    <article className="animate-ink border border-line bg-surface shadow-paper" aria-label={`Verification receipt: ${v.text}`}>
      <div className="perforation" aria-hidden />
      <div className="px-5 pt-2 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="label text-ink">Verification receipt</span>
          <span className="num text-[11px] text-muted">
            {issued ? new Date(issued).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : ""}
          </span>
        </div>

        {/* The answer, stamped */}
        <div className="border-b border-ink/70 pb-6 pt-8">
          <div className="pl-1">
            <Stamp verdict={v.stamp} size="md" rotate={-4} animate className="max-w-[19rem] text-xl leading-[1.15] sm:max-w-[30rem] sm:text-[1.6rem]">
              {v.text}
            </Stamp>
          </div>
          <div className="mt-7 min-w-0">
            <p className={cn("num text-[12px] font-medium", v.tone)}>
              {receipt.verdict} · {receipt.rule}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{receipt.message}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{v.line}</p>
          </div>
        </div>

        {/* The order */}
        <div className="py-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
            <span className="label text-[10px] text-muted">Order · {receipt.order.merchant}</span>
            <span className="label text-[10px] text-muted">Amount</span>
          </div>
          <ul className="num text-[13px]">
            {items.map((it, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5">
                <span className="min-w-0 truncate text-ink">
                  {it.title}
                  {it.quantity > 1 && <span className="text-muted"> × {it.quantity}</span>}
                </span>
                <span className="shrink-0 text-ink">{usd(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="num flex items-baseline justify-between border-b-[3px] border-double border-ink py-1.5 text-[13px]">
            <span className="label pt-[3px] text-[10px] text-ink">Total</span>
            <span className="text-[15px] font-medium text-ink">{usd(total)}</span>
          </div>
        </div>

        {/* Chain of authority */}
        <div className="pb-4">
          <span className="label text-[10px] text-muted">Chain of authority</span>
          <ol className="num mt-2 text-[12px]">
            {chain.map((c, i) => (
              <li key={c.k} className="relative grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 pb-2 pl-4 last:pb-0">
                <span aria-hidden className={cn("absolute left-[3px] top-[7px] h-[7px] w-[7px] border border-ink", i === chain.length - 1 && "border-paypal bg-paypal")} />
                {i < chain.length - 1 && <span aria-hidden className="absolute bottom-0 left-[6px] top-[16px] w-px bg-ink/40" />}
                <span className="label pt-[2px] text-[10px] text-muted">{c.k}</span>
                <span className="min-w-0 break-words">{c.v}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Proof stub */}
      <div className="relative" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <div className="perforation relative" />
      </div>
      <div className="px-5 pb-5 pt-3 sm:px-8">
        <dl className="num grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px]">
          <dt className="label pt-[3px] text-[10px] text-muted">Receipt sha256</dt>
          <dd className="min-w-0">
            <CopyId value={proof.sha256} paypal={false} label="receipt hash" />
          </dd>
          <dt className="label pt-[3px] text-[10px] text-muted">Ed25519 sig</dt>
          <dd className="min-w-0">
            <CopyId value={proof.signature} paypal={false} label="signature" />
          </dd>
          <dt className="label pt-[3px] text-[10px] text-muted">Public key</dt>
          <dd className="min-w-0">
            <CopyId value={proof.public_key_pem.replace(/-----[^-]+-----|\s/g, "")} paypal={false} label="public key" />
          </dd>
        </dl>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="ghost" className="min-h-11 shrink-0" onClick={verifySig} disabled={checking}>
            {checking ? "Checking…" : "Verify signature"}
          </Button>
          <p className="num text-[12px]" aria-live="polite">
            {check == null ? (
              <span className="text-muted">Re-checks the signature against Mandate&apos;s public key.</span>
            ) : check.valid ? (
              <span className="text-allow">
                ✓ Valid{check.hash ? <span className="text-muted"> · sha256 #{check.hash.slice(0, 12)}</span> : null}
              </span>
            ) : (
              <span className="text-deny">✗ Invalid — this receipt was altered or not signed by Mandate</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
