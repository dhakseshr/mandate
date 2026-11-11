// Punch-cancellation lettering (5×7 dot matrix), ported from the app's components/punch.tsx.
// Columns are punched left to right, each hole popping in like a ticket punch.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";

const G: Record<string, string> = {
  A: ".###.#...##...#######...##...##...#",
  C: ".###.#...##....#....#....#...#.###.",
  D: "####.#...##...##...##...##...#####.",
  E: "######....#....####.#....#....#####",
  I: ".###...#....#....#....#....#...###.",
  K: "#...##..#.#.#..##...#.#..#..#.#...#",
  L: "#....#....#....#....#....#....#####",
  N: "#...##...###..##.#.##..###...##...#",
  O: ".###.#...##...##...##...##...#.###.",
  R: "####.#...##...#####.#.#..#..#.#...#",
  S: ".#####....#.....###.....#....#####.",
  T: "#####..#....#....#....#....#....#..",
  U: "#...##...##...##...##...##...#.###.",
  V: "#...##...##...##...##...#.#.#...#..",
  Y: "#...##...#.#.#...#....#....#....#..",
  "0": ".###.#...##..###.#.###..##...#.###.",
  "$": "..#...####.#....###....#.####...#..",
  ".": "................................#..",
  " ": "...................................",
};

export const Punch: React.FC<{ text: string; dot: number; start: number; color?: string; colFrames?: number }> = ({ text, dot, start, color = C.deny, colFrames = 1.2 }) => {
  const f = useCurrentFrame();
  const gap = dot * 0.55;
  const cell = dot + gap;
  const chars = text.toUpperCase().split("");
  let col = 0;
  return (
    <svg width={chars.length * 6 * cell} height={7 * cell} style={{ overflow: "visible" }}>
      {chars.map((ch, ci) => {
        const g = G[ch] ?? G[" "];
        const dots: React.ReactNode[] = [];
        for (let x = 0; x < 5; x++) {
          const colIndex = col + x;
          const t = start + colIndex * colFrames;
          const p = interpolate(f, [t, t + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          for (let y = 0; y < 7; y++) {
            if (g[y * 5 + x] !== "#") continue;
            const cx = (ci * 6 + x) * cell + dot / 2;
            const cy = y * cell + dot / 2;
            const s = p === 0 ? 0 : p < 1 ? 1.35 - 0.35 * p : 1;
            dots.push(<circle key={`${x}-${y}`} cx={cx} cy={cy} r={(dot / 2) * s} fill={color} opacity={p} />);
          }
        }
        col += 6;
        return <g key={ci}>{dots}</g>;
      })}
    </svg>
  );
};

/** Rubber-stamp verdict (rotated, double-ruled, slightly rough), landing with a squash. */
export const Stamp: React.FC<{ text: string; start: number; color?: string; size?: number; rotate?: number }> = ({ text, start, color = C.deny, size = 64, rotate = -5 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (f < start) return null;
  const s = 1.6 - 0.6 * p;
  return (
    <div
      style={{
        display: "inline-block",
        transform: `rotate(${rotate}deg) scale(${s})`,
        opacity: Math.min(1, p * 1.4),
        border: `${size * 0.07}px double ${color}`,
        color,
        padding: `${size * 0.12}px ${size * 0.32}px`,
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: "0.18em",
        fontSize: size,
        lineHeight: 1,
        filter: "url(#rough)",
      }}
    >
      {text}
    </div>
  );
};
