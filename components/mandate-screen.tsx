"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MandateView } from "@/lib/ledger";
import { PolicyReview } from "./policy-review";
import { MissionControl } from "./mission-control";
import { Badge, type Tone } from "./ui";

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

  if (error) return <p className="text-deny">{error}</p>;
  if (!view) return <Loader2 className="mx-auto animate-spin text-muted" />;

  const { mandate } = view;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Mandate</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{mandate.policy.goal}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">“{mandate.rawText}”</p>
        </div>
        <Badge tone={STATUS_TONE[mandate.status] ?? "neutral"} className="text-xs">
          {mandate.status.replace("_", " ")}
        </Badge>
      </div>
      {["DRAFT", "AWAITING_AUTH"].includes(mandate.status) ? (
        <PolicyReview view={view} onChange={refresh} />
      ) : (
        <MissionControl view={view} onChange={refresh} />
      )}
    </div>
  );
}
