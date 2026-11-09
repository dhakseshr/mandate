"use client";
// Guilloche rosette generated from a document's hash: the same hash always engraves the same face.
// Drawn on <canvas> (cheap, crisp, no DOM weight); colour follows the theme's --ink.
import { useEffect, useMemo, useRef } from "react";
import { clsx as cn } from "clsx";

const TAU = Math.PI * 2;

/** 32 bytes from a hex hash, or from any string via FNV-1a (e.g. a mandate id). */
export function hashBytes(src: string): number[] {
  const hex = src.replace(/^0x/, "");
  if (/^[0-9a-f]{16,}$/i.test(hex)) {
    const out: number[] = [];
    for (let i = 0; i + 1 < hex.length && out.length < 32; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
    while (out.length < 32) out.push(out[out.length % 8] ^ 0x5a);
    return out;
  }
  const out: number[] = [];
  let h = 0x811c9dc5;
  for (let i = 0; out.length < 32; i++) {
    h ^= src.charCodeAt(i % Math.max(1, src.length)) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push(h & 0xff);
  }
  return out;
}

type Curve = Float32Array; // x0,y0,x1,y1… in unit space (radius 1)

/** The rosette's line set: an outer rope, a middle mesh, an inner rose, and three rule circles. */
function buildCurves(b: number[], density: number): Curve[] {
  const curves: Curve[] = [];
  const steps = 420;
  const lines = (n: number) => Math.max(5, Math.round(n * density));
  const band = (count: number, r: (theta: number, k: number, count: number) => number) => {
    for (let k = 0; k < count; k++) {
      const c = new Float32Array((steps + 1) * 2);
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * TAU;
        const rr = r(t, k, count);
        c[i * 2] = Math.cos(t) * rr;
        c[i * 2 + 1] = Math.sin(t) * rr;
      }
      curves.push(c);
    }
  };
  const circle = (r: number) => band(1, () => r);

  // Outer rope.
  const nA = 16 + (b[0] % 14);
  const mA = 3 + (b[1] % 5);
  const phA = (b[2] / 255) * TAU;
  const cA = lines(14);
  band(cA, (t, k, n) => 0.875 + 0.06 * Math.sin(nA * (t + (k * TAU) / (nA * n))) + 0.014 * Math.sin(mA * t + phA));

  // Middle mesh, two interleaved harmonics.
  const nB = 7 + (b[3] % 9);
  const qB = nB * 2 + 1 + (b[4] % 3);
  const phB = (b[5] / 255) * TAU;
  const cB = lines(18);
  band(cB, (t, k, n) => {
    const s = t + (k * TAU) / (nB * n);
    return 0.62 + 0.085 * Math.sin(nB * s) + 0.022 * Math.sin(qB * s + phB);
  });

  // Inner rose.
  const p = 5 + (b[6] % 7);
  const q = 2 + (b[7] % 4);
  const cC = lines(12);
  band(cC, (t, k, n) => {
    const s = t + (k * TAU) / (p * n);
    return 0.2 + 0.2 * (0.5 + 0.5 * Math.cos(p * s)) * (1 + 0.1 * Math.sin(q * t + b[8] / 40));
  });

  circle(0.985);
  circle(0.775);
  circle(0.465);
  circle(0.185);
  return curves;
}

function readInk(el: HTMLElement) {
  return getComputedStyle(el).color || "#121210";
}

/**
 * A generative guilloche rosette. `hash` drives every parameter.
 * `animate` engraves it on first view (every line grows around the circle at once);
 * reduced motion draws it complete.
 */
export function Rosette({
  hash,
  size,
  animate = false,
  duration = 1600,
  strength = 1,
  className,
  style,
  label,
}: {
  hash: string;
  style?: React.CSSProperties;
  size: number;
  animate?: boolean;
  duration?: number;
  /** Line opacity multiplier (0–1). */
  strength?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const density = Math.min(1.5, Math.max(0.42, size / 260));
  const curves = useMemo(() => buildCurves(hashBytes(hash), density), [hash, density]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const half = (size * dpr) / 2;
    const lw = Math.max(0.45, Math.min(1.1, size / 520)) * dpr;
    let ink = readInk(canvas);
    let raf = 0;
    let progress = 0;

    const draw = (frac: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.globalAlpha = Math.min(1, 0.78 * strength);
      const scale = half - lw;
      for (const c of curves) {
        const total = c.length / 2;
        const upto = Math.max(2, Math.floor(total * frac));
        ctx.beginPath();
        ctx.moveTo(half + c[0] * scale, half + c[1] * scale);
        for (let i = 1; i < upto; i++) ctx.lineTo(half + c[i * 2] * scale, half + c[i * 2 + 1] * scale);
        ctx.stroke();
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = () => {
      if (!animate || reduced) {
        progress = 1;
        draw(1);
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const x = Math.min(1, (now - t0) / duration);
        progress = 1 - Math.pow(1 - x, 3);
        draw(progress);
        if (x < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    let io: IntersectionObserver | null = null;
    if (animate && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            run();
          }
        },
        { threshold: 0.2 },
      );
      io.observe(canvas);
    } else run();

    // Re-ink when the theme changes.
    const retheme = () => {
      ink = readInk(canvas);
      draw(progress || (animate ? 0 : 1));
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", retheme);
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      mq.removeEventListener("change", retheme);
      mo.disconnect();
    };
  }, [curves, size, animate, duration, strength]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ ...style, width: size, height: size }}
      className={cn("block text-ink", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
