"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Download } from "lucide-react";
import { Seal } from "./ui";

/** Signed-mandate seal + AP2 export + live verification. Renders nothing for unsigned mandates. */
export function Ap2Seal({ id, hash }: { id: string; hash: string | null }) {
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
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Seal hash={hash} />
      {valid === true && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-allow" title="Signature verified against the mandate's public key">
          <BadgeCheck size={13} /> Verified
        </span>
      )}
      {valid === false && <span className="text-[11px] font-semibold text-deny">Signature invalid</span>}
      <a
        href={`/api/mandates/${id}/ap2?download`}
        className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:border-accent hover:text-accent"
        title="Download as an AP2 Intent Mandate (JSON + signature)"
      >
        <Download size={11} /> Export AP2 mandate
      </a>
    </span>
  );
}
