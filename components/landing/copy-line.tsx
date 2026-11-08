"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** One terminal line with a copy button. */
export function CopyLine({ prompt = "$", text, label }: { prompt?: string; text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
      <span aria-hidden className="num select-none pt-[3px] text-[13px] text-muted">
        {prompt}
      </span>
      <code className="num min-w-0 flex-1 break-all pt-[3px] text-[12px] sm:text-[13px] lg:text-[12px] leading-relaxed text-ink">{text}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          } catch {
            /* clipboard unavailable */
          }
        }}
        aria-label={`Copy ${label}`}
        className="label -my-1.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[2px] border border-line bg-surface px-2.5 text-muted hover:border-ink/40 hover:text-ink"
      >
        {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span aria-live="polite">{done ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
