// Punch-cancellation lettering: how a bank cancels a cheque — the word is punched through as holes.
// Writ uses it only for irreversible acts (DENIED, VOID, REVOKED). Decisions get rubber stamps; finals get punched.
import { cn } from "./ui";

// 5×7 matrix, hand-drawn. '#' = hole.
const G: Record<string, string> = {
  A: ".###.#...##...#######...##...##...#",
  B: "####.#...##...#####.#...##...#####.",
  C: ".###.#...##....#....#....#...#.###.",
  D: "####.#...##...##...##...##...#####.",
  E: "######....#....####.#....#....#####",
  F: "######....#....####.#....#....#....",
  G: ".###.#...##....#.####...##...#.###.",
  H: "#...##...##...#######...##...##...#",
  I: ".###...#....#....#....#....#...###.",
  K: "#...##..#.#.#..##...#.#..#..#.#...#",
  L: "#....#....#....#....#....#....#####",
  M: "#...###.###.#.##.#.##...##...##...#",
  N: "#...##...###..##.#.##..###...##...#",
  O: ".###.#...##...##...##...##...#.###.",
  P: "####.#...##...#####.#....#....#....",
  R: "####.#...##...#####.#.#..#..#.#...#",
  S: ".#####....#.....###.....#....#####.",
  T: "#####..#....#....#....#....#....#..",
  U: "#...##...##...##...##...##...#.###.",
  V: "#...##...##...##...##...#.#.#...#..",
  W: "#...##...##...##.#.##.#.##.#..#.#.",
  Y: "#...##...#.#.#...#....#....#....#..",
  "0": ".###.#...##..###.#.###..##...#.###.",
  "1": "..#...##....#....#....#....#...###.",
  "2": ".###.#...#....#...#...#...#...#####",
  "3": "####.....#....#.###.....#....#####.",
  "4": "...#...##..#.#.#..#.#####...#....#.",
  "5": "######....####.....#....##...#.###.",
  "6": ".###.#....#....####.#...##...#.###.",
  "7": "#####....#...#...#...#....#....#...",
  "8": ".###.#...##...#.###.#...##...#.###.",
  "9": ".###.#...##...#.####....#....#.###.",
  ".": "................................#..",
  "·": "...............#..................",
  "-": "...............###...............",
  " ": "...................................",
};

const tones = { deny: "text-deny", ink: "text-ink", paypal: "text-paypal", allow: "text-allow", escalate: "text-escalate", muted: "text-muted" } as const;

/**
 * Punched word. `dot` is the hole diameter in px. Straight, never rotated: a machine did this.
 * `animate` punches column by column (reduced motion: all at once).
 */
export function Punch({
  text,
  dot = 6,
  tone = "deny",
  animate = false,
  delay = 0,
  className,
  label,
}: {
  text: string;
  dot?: number;
  tone?: keyof typeof tones;
  animate?: boolean;
  /** ms before the first column. */
  delay?: number;
  className?: string;
  /** Screen-reader text; defaults to the word. */
  label?: string;
}) {
  const chars = text.toUpperCase().split("");
  const pitch = dot * 1.42;
  const charW = 5 * pitch;
  const gapW = pitch * 1.25;
  const width = chars.length * charW + (chars.length - 1) * gapW;
  const height = 7 * pitch;
  const holes: { x: number; y: number; col: number }[] = [];
  chars.forEach((ch, ci) => {
    const g = (G[ch] ?? G[" "]).padEnd(35, ".");
    for (let i = 0; i < 35; i++) {
      if (g[i] !== "#") continue;
      const c = i % 5;
      const r = Math.floor(i / 5);
      holes.push({ x: ci * (charW + gapW) + c * pitch + pitch / 2, y: r * pitch + pitch / 2, col: ci * 6 + c });
    }
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label ?? text}
      className={cn("block max-w-full shrink-0 overflow-visible", tones[tone], animate && "animate-punch", className)}
    >
      {holes.map((h, i) => (
        <circle
          key={i}
          cx={h.x}
          cy={h.y}
          r={dot / 2}
          fill="currentColor"
          style={animate ? { animationDelay: `${delay + h.col * 22}ms` } : undefined}
        />
      ))}
    </svg>
  );
}
