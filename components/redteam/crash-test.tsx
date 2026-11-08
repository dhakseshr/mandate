"use client";
import { useState } from "react";
import { Button } from "../ui";
import { CrashMatrix } from "./scorecard";
import type { CrashTest as CT } from "./suite";

/**
 * Crash-test this mandate: read-only and instant. Every clause of the signed policy is probed
 * just inside and just outside its line — no agent, no PayPal call, nothing moves.
 */
export function CrashTest({ mandateId }: { mandateId: string }) {
  const [t, setT] = useState<(CT & { ranAt?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/mandates/${mandateId}/crashtest`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(j.cases)) setErr(j.error ?? "The crash test couldn't run.");
    else setT(j);
    setBusy(false);
  }

  return (
    <section aria-label="Crash test" className="border border-line bg-surface">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="min-w-0 text-[13px] leading-snug text-muted">
          <span className="label mr-2 text-[10px] text-ink">Crash test</span>
          Probe every clause of this policy one cent inside and one cent outside its line. Read-only; nothing is proposed or captured.
        </p>
        <Button variant="ghost" className="min-h-11 shrink-0" onClick={run} disabled={busy} aria-expanded={!!t}>
          {busy ? "Testing…" : t ? "Run again" : "Crash-test this mandate"}
        </Button>
      </div>
      {err && <p className="num border-t border-line px-4 py-2 text-[12px] text-deny sm:px-6">✗ {err}</p>}
      {t && (
        <div className="animate-ink border-t border-line px-4 pb-4 pt-2 sm:px-6">
          <CrashMatrix t={t} bare />
          {t.ranAt && (
            <p className="num mt-2 text-[11px] text-muted">
              ran {new Date(t.ranAt).toLocaleTimeString("en-GB", { hour12: false })} · {t.cases.length} cases · deterministic, same answer every time
            </p>
          )}
        </div>
      )}
    </section>
  );
}
