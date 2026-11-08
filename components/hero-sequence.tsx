"use client";
import { useEffect, useState } from "react";
import { Stamp, type StampVerdict } from "./ui";

type Line = { t: string; verb: string; what: string; amt: string; why: string; verdict?: StampVerdict; paypal?: boolean };

// Plausible against the instrument above: $120.00 cap, ask above $80.00.
const LINES: Line[] = [
  { t: "09:41:02", verb: "propose", what: "Adizero SL", amt: "$101.79", why: "above $80 line", verdict: "ESCALATE" },
  { t: "09:41:05", verb: "propose", what: "Liberate NITRO 2", amt: "$47.95", why: "13/13 pass", verdict: "ALLOW" },
  { t: "09:41:09", verb: "propose", what: "[RT] Ultra Elite Racer", amt: "$389.00", why: "over cap", verdict: "DENY" },
  { t: "09:41:12", verb: "release", what: "Void the hold", amt: "$72.05", why: "remainder", paypal: true },
];
const STEP_MS = 1300;
const CYCLE_MS = 11000;

/** A terminal tape under the instrument: the agent proposes, the engine stamps. Cycles slowly. */
export function HeroSequence() {
  const [shown, setShown] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(LINES.length);
      return;
    }
    const timers = LINES.map((_, i) => setTimeout(() => setShown(i + 1), 900 + i * STEP_MS));
    const next = setTimeout(() => {
      setShown(0);
      setCycle((c) => c + 1);
    }, CYCLE_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(next);
    };
  }, [cycle]);

  return (
    <div className="min-w-0 border border-t-0 border-line bg-surface-2" role="log" aria-label="Agent log: three proposals and a release">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
        <span className="label">Agent log · tail</span>
        <span className="label text-muted">Append-only</span>
      </div>
      <ol className="min-h-[13.5rem] divide-y divide-line/70 font-mono text-[13px]">
        {LINES.slice(0, shown).map((l, i) => (
          <li
            key={`${cycle}-${i}`}
            className="animate-ink grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5 sm:grid-cols-[4.25rem_minmax(0,1fr)_auto_auto] sm:px-5"
          >
            <span className="num hidden text-[12px] text-muted sm:block">{l.t}</span>
            <span className="min-w-0">
              <span className="block truncate text-ink">{l.what}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted">
                {l.verb} · {l.why}
              </span>
            </span>
            <span className={l.paypal ? "num text-right text-paypal" : "num text-right text-ink"}>{l.amt}</span>
            <span className="flex w-[5rem] justify-end">
              {l.verdict ? (
                <Stamp verdict={l.verdict} animate className="whitespace-nowrap" rotate={l.verdict === "DENY" ? -6 : l.verdict === "ESCALATE" ? 3 : -3} />
              ) : (
                <span className="label text-paypal">Void</span>
              )}
            </span>
          </li>
        ))}
        {shown < LINES.length && (
          <li className="px-4 py-2.5 text-muted sm:px-5" aria-hidden>
            <span className="caret" />
          </li>
        )}
      </ol>
    </div>
  );
}
