// The live app, recorded at 2560×1440, shown in a floating browser frame with an eased camera.
import React from "react";
import { interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mono, sans } from "../theme";
import { inOut } from "./primitives";

export const SRC_W = 2560;
export const SRC_H = 1440;

/** A camera keyframe: at scene frame `at`, show the source region starting (x, y) with width w (16:9). */
export type Cam = { at: number; x: number; y: number; w: number };

export function camAt(cams: Cam[], f: number): { x: number; y: number; w: number } {
  if (f <= cams[0].at) return cams[0];
  for (let i = 0; i < cams.length - 1; i++) {
    const a = cams[i], b = cams[i + 1];
    if (f <= b.at) {
      const k = interpolate(f, [a.at, b.at], [0, 1], { easing: inOut });
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k };
    }
  }
  return cams[cams.length - 1];
}

/** Full-frame cam (no zoom). */
export const FULL: Omit<Cam, "at"> = { x: 0, y: 0, w: SRC_W };
/** Zoom on a box from the recorder (already in source pixels: the viewport is 2560 wide), with padding. */
export function focus(box: { x: number; y: number; width: number; height: number }, pad = 1.5, at = 0): Cam {
  const bx = box.x, by = box.y, bw = box.width, bh = box.height;
  let w = Math.max(bw * pad, (bh * pad * 16) / 9, 800);
  w = Math.min(w, SRC_W);
  const h = (w * 9) / 16;
  const x = Math.min(Math.max(0, bx + bw / 2 - w / 2), SRC_W - w);
  const y = Math.min(Math.max(0, by + bh / 2 - h / 2), SRC_H - h);
  return { at, x, y, w };
}

export const Footage: React.FC<{
  src: string;
  /** seconds into the recording where this shot starts */
  from: number;
  rate?: number;
  cams?: Cam[];
  width: number;
  muted?: boolean;
  /** fade the lower part of the frame into paper, from this fraction of the height */
  fade?: number;
}> = ({ src, from, rate = 1, cams = [{ at: 0, ...FULL }], width, fade }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const height = (width * 9) / 16;
  const c = camAt(cams, f);
  const k = width / c.w;
  return (
    <div style={{ width, height, overflow: "hidden", position: "relative", background: C.bg }}>
      <div style={{ position: "absolute", left: -c.x * k, top: -c.y * k, width: SRC_W * k, height: SRC_H * k }}>
        <OffthreadVideo src={staticFile(`footage/${src}`)} startFrom={Math.round(from * fps)} playbackRate={rate} muted style={{ width: "100%", height: "100%" }} />
      </div>
      {fade !== undefined && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(238,235,225,0) ${fade * 100}%, rgba(238,235,225,.97) ${Math.min(100, fade * 100 + 16)}%, #eeebe1 100%)` }} />
      )}
    </div>
  );
};

/** Browser chrome in the Intaglio idiom: square corners, ink hairline, mono address, a SANDBOX chip. */
export const BrowserFrame: React.FC<{
  width: number;
  url?: string;
  children: React.ReactNode;
  rotateX?: number;
  rotateY?: number;
  scale?: number;
  x?: number;
  y?: number;
  shadow?: number;
}> = ({ width, url = "writ-307007912526.us-central1.run.app", children, rotateX = 0, rotateY = 0, scale = 1, x = 0, y = 0, shadow = 1 }) => {
  const bar = Math.round(width * 0.028);
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, perspective: 2600 }}>
      <div
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
          border: `1.5px solid ${C.ink}`,
          background: C.surface,
          boxShadow: `0 ${60 * shadow}px ${120 * shadow}px -${50 * shadow}px rgba(18,18,16,${0.55 * shadow}), 0 2px 0 ${C.line}`,
        }}
      >
        <div style={{ height: bar, display: "flex", alignItems: "center", gap: bar * 0.4, padding: `0 ${bar * 0.55}px`, borderBottom: `1px solid ${C.line}`, background: C.surface2 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: bar * 0.3, height: bar * 0.3, border: `1.5px solid ${C.ink}`, opacity: 0.55 }} />
          ))}
          <div style={{ flex: 1, height: bar * 0.62, border: `1px solid ${C.line}`, background: C.surface, display: "flex", alignItems: "center", padding: `0 ${bar * 0.4}px`, fontFamily: mono, fontSize: bar * 0.38, color: C.muted, marginLeft: bar * 0.3 }}>
            <span style={{ color: C.allow, marginRight: bar * 0.25 }}>●</span>https://{url}
          </div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: bar * 0.32, letterSpacing: "0.16em", color: C.paypal, border: `1.5px solid ${C.paypal}`, padding: `${bar * 0.08}px ${bar * 0.25}px` }}>PAYPAL SANDBOX</div>
        </div>
        {children}
      </div>
    </div>
  );
};
