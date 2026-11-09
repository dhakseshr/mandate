"use client";
// "How often should agents ask you?" — one-click autonomy profiles. A profile moves the ask-above line
// and per-item cap relative to the budget; the server never lets it loosen a limit the human wrote.
import { useState } from "react";
import { cn, usd } from "../ui";

export type Autonomy = "careful" | "balanced" | "autopilot";

const PROFILES: readonly [Autonomy, string, string][] = [
  ["careful", "Careful", "Ask me above 10% of the budget; no single item over 30%."],
  ["balanced", "Balanced", "Ask me above 25% of the budget."],
  ["autopilot", "Autopilot", "Only my own stated limits apply. Budget and blocks are always enforced."],
];

export function AutonomyChoice({
  mandateId,
  value,
  approvalThreshold,
  maxPerItem,
  onChange,
  disabled,
}: {
  mandateId: string;
  value: Autonomy | null | undefined;
  approvalThreshold: number | null | undefined;
  maxPerItem: number | null | undefined;
  onChange: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<Autonomy | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Autonomy) {
    if (next === value || busy || disabled) return;
    setBusy(next);
    setError(null);
    try {
      const r = await fetch(`/api/mandates/${mandateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autonomy: next }),
      });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "Couldn't change the profile.");
    } catch {
      setError("Couldn't change the profile.");
    }
    setBusy(null);
    onChange();
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="label mb-3 text-muted">Instruction · how often should agents ask you?</legend>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How often should agents ask you?">
        {PROFILES.map(([key, title, sub]) => {
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(key)}
              className={cn(
                "flex min-h-11 items-start gap-3 rounded-[2px] border px-3 py-3 text-left transition-colors duration-[120ms]",
                on ? "border-ink bg-surface" : "border-line hover:border-ink/40",
              )}
            >
              <span className={cn("mt-[5px] h-3 w-3 shrink-0 rotate-45 border", on ? "border-ink bg-ink" : "border-muted")} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="block text-sm text-muted">{busy === key ? "Amending the clauses…" : sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        <span>A profile can&apos;t loosen a limit you wrote yourself.</span>
        {value && (
          <span className="num text-[12px] text-ink" aria-live="polite">
            Now: ask above {approvalThreshold != null ? usd(approvalThreshold) : "— (your limits only)"}
            {maxPerItem != null ? ` · max ${usd(maxPerItem)} per item` : ""}
          </span>
        )}
      </p>
      {error && (
        <p role="alert" className="mt-2 border-l-2 border-deny pl-3 text-sm text-deny">
          {error}
        </p>
      )}
    </fieldset>
  );
}
