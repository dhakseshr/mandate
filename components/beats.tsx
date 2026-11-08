import { Check } from "lucide-react";
import { cn } from "./ui";

/** Slim horizontal progress stepper. `current` = index of the active beat; anything before it is done. */
export function Beats({
  steps, current, done: doneFlags, tone = "accent", className,
}: { steps: string[]; current: number; done?: boolean[]; tone?: "accent" | "escalate" | "deny"; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-1.5 overflow-hidden", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const active = i === current;
        const done = !active && (doneFlags ? !!doneFlags[i] : i < current);
        return (
          <li key={s} className={cn("flex min-w-0 items-center gap-1.5", active ? "flex-[2_1_0%]" : "flex-1")} aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                done && "bg-allow text-white",
                active && (tone === "escalate" ? "bg-escalate text-white animate-ring" : tone === "deny" ? "bg-deny text-white" : "bg-accent text-white"),
                !done && !active && "bg-surface-2 text-faint ring-1 ring-inset ring-line",
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("truncate text-xs", active ? "font-semibold text-ink" : done ? "text-muted" : "text-faint", !active && "hidden sm:inline")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("h-px min-w-3 flex-1", done ? "bg-allow" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}
