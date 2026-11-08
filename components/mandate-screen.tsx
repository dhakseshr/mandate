"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MandateView } from "@/lib/ledger";
import { PolicyReview } from "./policy-review";
import { MissionControl } from "./mission-control";
import { Badge, SealTag, cn, signatureOf, type Tone } from "./ui";
import { Ap2Seal } from "./ap2-seal";

// Dates arrive as strings over JSON.
export type View = MandateView;

const STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  AWAITING_AUTH: { label: "Awaiting signature", tone: "accent" },
  ACTIVE: { label: "Active · hold live", tone: "paypal" },
  FULFILLED: { label: "Fulfilled", tone: "accent" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  VOIDED: { label: "Voided", tone: "neutral" },
  REVOKED: { label: "Revoked · agents stopped", tone: "deny" },
};

const norm = (s: string) => s.replace(/[\s.“”"']+/g, " ").trim().toLowerCase();

export function MandateScreen({ id }: { id: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/mandates/${id}`, { cache: "no-store" });
    if (!r.ok) return setError("Mandate not found");
    setView(await r.json());
  }, [id]);

  // Poll while there's anything live to watch. Simple and robust on any host.
  const live = !view || ["AWAITING_AUTH", "ACTIVE"].includes(view.mandate.status) || view.run?.status === "RUNNING" || !!view.teamRunning;
  useEffect(() => {
    refresh();
    if (!live) return;
    const t = setInterval(refresh, 1200);
    return () => clearInterval(t);
  }, [refresh, live]);

  if (error)
    return (
      <div className="mx-auto max-w-[560px] border border-line bg-surface">
        <p className="label border-b border-line px-5 py-3 text-muted">
          Mandate <span className="num normal-case tracking-normal text-ink">№ {id}</span>
        </p>
        <div className="px-5 py-6">
          <h1 className="display text-3xl leading-tight">No mandate on file under this number.</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            It may have been drafted against another database. Draft a fresh one, or look it up in the ledger.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/demo" className="inline-flex min-h-11 items-center rounded-[2px] bg-ink px-4 text-sm font-medium text-on-accent hover:bg-ink/90">
              Run the guided demo
            </Link>
            <Link href="/ledger" className="inline-flex min-h-11 items-center rounded-[2px] border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink/40">
              Open the ledger
            </Link>
          </div>
        </div>
      </div>
    );

  if (!view)
    return (
      <p className="label flex items-center gap-2 py-24 text-muted" role="status">
        Retrieving mandate <span className="num normal-case tracking-normal text-ink">№ {id}</span>
        <span className="caret" />
      </p>
    );

  const { mandate } = view;
  const reviewing = ["DRAFT", "AWAITING_AUTH"].includes(mandate.status);
  const base = STATUS[mandate.status] ?? { label: mandate.status.replace("_", " "), tone: "neutral" as Tone };
  // A sub-mandate spends an allocation of the root's hold, not a hold of its own.
  const status = mandate.status === "ACTIVE" && (mandate as { parentId?: string | null }).parentId ? { ...base, label: "Active · allocation live" } : base;
  const hash = signatureOf(mandate);
  const mx = mandate as typeof mandate & { signedWith?: string | null; passkeyIntentHash?: string | null; parentId?: string | null; name?: string | null };
  const goal = mandate.policy.goal || "Your mandate";
  const showQuote = !reviewing && mandate.rawText && norm(mandate.rawText) !== norm(goal);

  return (
    <div className={cn("space-y-8", reviewing && "mx-auto max-w-[800px]")}>
      <header className="animate-ink border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="label text-muted">
            Mandate <span className="num normal-case tracking-normal text-ink">№ {mandate.id}</span>
          </span>
          <Badge tone={status.tone} className="border-[3px] border-double px-2 py-1">
            {status.label}
          </Badge>
          <SealTag hash={hash} />
          {mx.signedWith === "passkey" && (
            <span className="label inline-flex items-center gap-1.5 text-ink" title={mx.passkeyIntentHash ? `Passkey signed intent sha256 ${mx.passkeyIntentHash}` : undefined}>
              <span className="text-allow" aria-hidden>✓</span>
              Signed with passkey
              {mx.passkeyIntentHash && (
                <span className="text-muted">
                  · intent <span className="num normal-case tracking-normal text-ink">#{mx.passkeyIntentHash.slice(0, 8)}</span>
                </span>
              )}
            </span>
          )}
          {mx.parentId && (
            <span className="label text-muted">
              {mx.name ? <span className="text-ink">{mx.name}</span> : "Sub-mandate"} · under{" "}
              <Link href={`/m/${mx.parentId}`} className="num normal-case tracking-normal text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                № {mx.parentId}
              </Link>
            </span>
          )}
        </div>

        {reviewing ? (
          <div className="mt-5">
            <h1 className="display text-balance text-4xl leading-[1.05] sm:text-5xl">You are signing this.</h1>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted">
              Read the clauses below. Click any one to amend it. Nothing moves until you approve the hold on PayPal.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="min-w-0">
              <h1 className="display text-balance text-3xl leading-[1.1] sm:text-4xl">{goal}</h1>
              {showQuote && (
                <p className="display mt-3 max-w-[70ch] text-pretty text-lg italic leading-snug text-muted">“{mandate.rawText}”</p>
              )}
            </div>
            <Ap2Seal id={mandate.id} hash={hash} />
          </div>
        )}
      </header>

      {reviewing ? <PolicyReview view={view} onChange={refresh} /> : <MissionControl view={view} onChange={refresh} />}
    </div>
  );
}
