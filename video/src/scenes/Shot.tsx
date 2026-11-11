// A footage shot: the live app in a floating frame, an eased camera, and timed overlays.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { BrowserFrame, Cam, Footage } from "../components/Screen";
import { Label, Microprint, Paper, Slate, Statement, InkWords, ease } from "../components/primitives";

export type ShotProps = {
  take: string;
  /** seconds into the take */
  from: number;
  rate?: number;
  cams?: Cam[];
  /** "full": big centered frame. "right": frame on the right with a text column on the left. "left": mirrored. */
  layout?: "full" | "right" | "left";
  slate?: { n: string; title: string };
  /** Left/right column copy for split layouts. */
  side?: { kicker?: string; lines: string[]; italicLast?: boolean; at?: number };
  overlay?: React.ReactNode;
  /** subtle 3D drift amount (deg) */
  tilt?: number;
  /** "▸▸ 6× · real run" badge when sped up */
  speedBadge?: boolean;
  dark?: boolean;
  fade?: number;
};

export const Shot: React.FC<ShotProps> = ({ take, from, rate = 1, cams, layout = "full", slate, side, overlay, tilt = 1, speedBadge, dark, fade }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200, mass: 0.9 } });
  const drift = interpolate(f, [0, durationInFrames], [-1, 1]);
  const full = layout === "full";
  const width = full ? 1640 : 1180;
  const x = full ? 0 : layout === "right" ? 300 : -300;
  const rotY = full ? drift * 2.2 * tilt : (layout === "right" ? -7 : 7) * tilt + drift * 1.5 * tilt;
  const rotX = full ? 4 * tilt * (1 - enter) + 1.5 * tilt : 2.5 * tilt;
  return (
    <Paper dark={dark}>
      <Microprint y={0} dark={dark} />
      {slate && <Slate n={slate.n} title={slate.title} dark={dark} y={48} />}
      <BrowserFrame width={width} x={x} y={full ? 26 : 10} rotateX={rotX} rotateY={rotY} scale={0.92 + 0.08 * enter}>
        <Footage src={`${take}.webm`} from={from} rate={rate} cams={cams} width={width} fade={fade} />
      </BrowserFrame>
      {side && <SideCopy {...side} layout={layout} />}
      {speedBadge && rate > 1.05 && (
        <div style={{ position: "absolute", right: 70, bottom: 44 }}>
          <Label size={16} color={dark ? C.nightInk : C.muted}>▸▸ {Math.round(rate)}× · real run</Label>
        </div>
      )}
      <AbsoluteFill style={{ pointerEvents: "none" }}>{overlay}</AbsoluteFill>
    </Paper>
  );
};

const SideCopy: React.FC<NonNullable<ShotProps["side"]> & { layout: string }> = ({ kicker, lines, italicLast, at = 8, layout }) => {
  const left = layout === "right";
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, [left ? "left" : "right"]: 96, width: 560, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {kicker && <Label size={18} color={C.muted} style={{ marginBottom: 26 }}>{kicker}</Label>}
      {lines.map((l, i) => (
        <Statement key={i} size={58} italic={italicLast && i === lines.length - 1} style={{ marginBottom: 14 }}>
          <InkWords text={l} start={at + i * 22} per={3} />
        </Statement>
      ))}
    </div>
  );
};

/** Big verdict word that lands on the beat, with a hairline underline sweep. */
export const Beat: React.FC<{ word: string; at: number; color: string; x: number; y: number; size?: number }> = ({ word, at, color, x, y, size = 120 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  if (f < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${1.35 - 0.35 * p}) rotate(-4deg)`, transformOrigin: "left center", opacity: p }}>
      <div style={{ border: `5px double ${color}`, color, padding: "10px 28px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, fontSize: size * 0.5, letterSpacing: "0.16em", background: "rgba(248,246,239,.92)", filter: "url(#rough)", boxShadow: "0 20px 50px -24px rgba(0,0,0,.5)" }}>
        {word}
      </div>
    </div>
  );
};
