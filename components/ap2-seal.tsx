"use client";
import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Seal, cn } from "./ui";

/**
 * Signed-mandate seal + live verification + AP2 export.
 * Verification is real: GET /api/mandates/[id]/ap2 re-checks the Ed25519 signature server-side.
 * Renders nothing for unsigned mandates.
 */
export function Ap2Seal({ id, hash, className }: { id: string; hash: string | null; className?: string }) {
  const [valid, setValid] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hash) return;
    let gone = false;
    fetch(`/api/mandates/${id}/ap2`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !gone && setValid(j?.verification?.valid ?? null))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [id, hash]);
  if (!hash) return null;
  const h = hash.replace(/^0x/, "");
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Seal hash={h} size={80} animate />
      <div className="min-w-0 space-y-1.5">
        <p className="label text-muted">AP2 intent mandate</p>
        <p className="label" aria-live="polite">
          {valid === true ? (
            <span className="text-allow" title="Ed25519 signature verified against the mandate's public key">
              Verified ✓
            </span>
          ) : valid === false ? (
            <span className="text-deny">Signature invalid ✕</span>
          ) : (
            <span className="text-muted">Verifying…</span>
          )}
          <span className="num ml-2 normal-case tracking-normal text-muted" title={`sha256 ${h}`}>
            sha256 {h.slice(0, 8)}…{h.slice(-4)}
          </span>
        </p>
        <a
          href={`/api/mandates/${id}/ap2?download`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
          title="Download as an AP2 IntentMandate (JSON + Ed25519 signature)"
        >
          <ArrowDown size={14} aria-hidden /> Export AP2 mandate (.json)
        </a>
      </div>
    </div>
  );
}
