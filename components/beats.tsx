import { cn } from "./ui";

/**
 * Thin mono step rail. `current` = index of the active step (-1 = none, all done per flags);
 * anything before it is done unless `done` flags are given. `tone` colors the current step
 * (escalate = waiting on you, deny = attack step).
 */
export function Beats({
  steps,
  current,
  done: doneFlags,
  tone = "accent",
  className,
}: {
  steps: string[];
  current: number;
  done?: boolean[];
  tone?: "accent" | "escalate" | "deny";
  className?: string;
}) {
  const toneText = tone === "escalate" ? "text-escalate" : tone === "deny" ? "text-deny" : "text-ink";
  const toneRule = tone === "escalate" ? "border-escalate" : tone === "deny" ? "border-deny" : "border-ink";
  return (
    <ol className={cn("flex w-full gap-px", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const active = i === current;
        const done = !active && (doneFlags ? !!doneFlags[i] : i < current);
        const isAttack = /attack/i.test(s);
        // With nothing current (all done), the last step keeps its label on small screens.
        const labelled = active || (current < 0 && i === steps.length - 1);
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative min-w-0 border-t pt-2",
              active ? cn("flex-[2.4_1_0%] border-t-2", toneRule) : "flex-1",
              done && (isAttack ? "border-deny/60" : "border-ink/40"),
              !done && !active && "border-line",
            )}
          >
            <span className={cn("label flex items-baseline gap-1.5 whitespace-nowrap", active ? toneText : done && isAttack ? "text-deny" : "text-muted")}>
              <span className="num tracking-normal">{done ? "✓" : String(i + 1).padStart(2, "0")}</span>
              <span className={cn("truncate", !labelled && "max-md:sr-only max-md:left-0 max-md:top-0")}>
                {s}
                <span className="sr-only left-0 top-0">{done ? " — done" : active ? " — current" : " — upcoming"}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
