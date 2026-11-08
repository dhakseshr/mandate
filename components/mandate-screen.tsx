"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileQuestion, Loader2 } from "lucide-react";
import type { MandateView } from "@/lib/ledger";
import { PolicyReview } from "./policy-review";
import { MissionControl } from "./mission-control";
import { Badge, signatureOf, type Tone } from "./ui";
import { Ap2Seal } from "./ap2-seal";

// Dates arrive as strings over JSON.
export type View = MandateView;

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  AWAITING_AUTH: "accent",
  ACTIVE: "allow",
  FULFILLED: "accent",
  EXPIRED: "neutral",
  VOIDED: "neutral",
};

export function MandateScreen({ id }: { id: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/mandates/${id}`, { cache: "no-store" });
    if (!r.ok) return setError("Mandate not found");
    setView(await r.json());
  }, [id]);

  // Poll while there's anything live to watch. Simple and robust on any host.
  const live = !view || ["AWAITING_AUTH", "ACTIVE"].includes(view.mandate.status) || view.run?.status === "RUNNING";
  useEffect(() => {
    refresh();
    if (!live) return;
    const t = setInterval(refresh, 1200);
    return () => clearInterval(t);
  }, [refresh, live]);

  if (error)
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <FileQuestion className="mx-auto text-faint" size={32} />
        <p className="mt-3 font-semibold">We can&apos;t find that mandate</p>
        <p className="mt-1 text-sm text-muted">It may have been created on another database. Start a fresh one, or browse past mandates in the ledger.</p>
        <div className="mt-5 flex justify-center gap-2 text-sm">
          <Link href="/demo" className="rounded-xl bg-accent px-4 py-2 font-medium text-white">Guided demo</Link>
          <Link href="/ledger" className="rounded-xl border border-line px-4 py-2 font-medium">Ledger</Link>
        </div>
      </div>
    );
  if (!view)
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
        <Loader2 className="animate-spin" size={16} /> Loading mandate…
      </div>
    );

  const { mandate } = view;
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-line px-5 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Mandate <span className="num ml-1 normal-case tracking-normal">№ {mandate.id}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Ap2Seal id={mandate.id} hash={signatureOf(mandate)} />
            <Badge tone={STATUS_TONE[mandate.status] ?? "neutral"} className="text-xs">
              {mandate.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="px-5 py-4">
          <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">{mandate.policy.goal || "Your mandate"}</h1>
          {!["DRAFT", "AWAITING_AUTH"].includes(mandate.status) && (
            <p className="mt-1.5 max-w-3xl border-l-2 border-accent/40 pl-3 text-sm text-muted">“{mandate.rawText}”</p>
          )}
        </div>
      </div>
      {["DRAFT", "AWAITING_AUTH"].includes(mandate.status) ? (
        <PolicyReview view={view} onChange={refresh} />
      ) : (
        <MissionControl view={view} onChange={refresh} />
      )}
    </div>
  );
}
