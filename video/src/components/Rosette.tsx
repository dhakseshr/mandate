// Guilloche rosette, ported from the app (components/rosette.tsx) as SVG so it can be engraved frame by frame.
import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { ease } from "./primitives";

const TAU = Math.PI * 2;

function hashBytes(src: string): number[] {
  const out: number[] = [];
  let h = 0x811c9dc5;
  for (let i = 0; out.length < 32; i++) {
    h ^= src.charCodeAt(i % Math.max(1, src.length)) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push(h & 0xff);
  }
  return out;
}

function curves(b: number[], density: number) {
  const out: string[] = [];
  const steps = 360;
  const lines = (n: number) => Math.max(5, Math.round(n * density));
  const band = (count: number, r: (t: number, k: number, n: number) => number) => {
    for (let k = 0; k < count; k++) {
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * TAU;
        const rr = r(t, k, count);
        d += `${i ? "L" : "M"}${(Math.cos(t) * rr).toFixed(4)} ${(Math.sin(t) * rr).toFixed(4)}`;
      }
      out.push(d);
    }
  };
  const nA = 16 + (b[0] % 14), mA = 3 + (b[1] % 5), phA = (b[2] / 255) * TAU;
  band(lines(14), (t, k, n) => 0.875 + 0.06 * Math.sin(nA * (t + (k * TAU) / (nA * n))) + 0.014 * Math.sin(mA * t + phA));
  const nB = 7 + (b[3] % 9), qB = nB * 2 + 1 + (b[4] % 3), phB = (b[5] / 255) * TAU;
  band(lines(18), (t, k, n) => { const s = t + (k * TAU) / (nB * n); return 0.62 + 0.085 * Math.sin(nB * s) + 0.022 * Math.sin(qB * s + phB); });
  const p = 5 + (b[6] % 7), q = 2 + (b[7] % 4);
  band(lines(12), (t, k, n) => { const s = t + (k * TAU) / (p * n); return 0.2 + 0.2 * (0.5 + 0.5 * Math.cos(p * s)) * (1 + 0.1 * Math.sin(q * t + b[8] / 40)); });
  for (const r of [0.985, 0.775, 0.465, 0.185]) band(1, () => r);
  return out;
}

/** Engraves in from `start` over `dur` frames: every line grows around the circle at once, like a lathe. */
export const Rosette: React.FC<{ seed: string; size: number; start?: number; dur?: number; color?: string; opacity?: number; spin?: number; density?: number; style?: React.CSSProperties }> = ({
  seed, size, start = 0, dur = 45, color = C.ink, opacity = 1, spin = 0, density = 1, style,
}) => {
  const f = useCurrentFrame();
  const paths = useMemo(() => curves(hashBytes(seed), density), [seed, density]);
  const p = interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const rot = spin * (f - start);
  return (
    <svg width={size} height={size} viewBox="-1 -1 2 2" style={{ opacity, transform: `rotate(${rot}deg)`, overflow: "visible", ...style }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={i >= paths.length - 4 ? 0.004 : 0.0024} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeOpacity={i >= paths.length - 4 ? 0.9 : 0.62} />
      ))}
    </svg>
  );
};
