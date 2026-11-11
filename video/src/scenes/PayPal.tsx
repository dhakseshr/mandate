// The human's approval: the real PayPal sandbox window opens over Writ, logs in, Complete Purchase.
import React from "react";
import { interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, mono, sans } from "../theme";
import { Shot } from "./Shot";
import { Chip } from "../components/primitives";
import take from "../../public/footage/paypal.json";

const mark = (l: string) => take.marks.find((m) => m.label.startsWith(l))!.t;
const OPENED = (take.videos as { file: string; openedAt: number }[]).find((v) => v.file.includes("popup"))!.openedAt;

const FROM = mark("paypal button") - 0.9;
const RATE = 2.2;
/** scene frame at which a main-take timestamp is reached */
const at = (sec: number) => Math.round(((sec - FROM) / RATE) * 30);

/** The PayPal popup (900×1080 content in the top-left of a 2560×1440 recording), as a floating window. */
const PopupWindow: React.FC<{ openAt: number; closeAt: number }> = ({ openAt, closeAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - openAt, fps, config: { damping: 18, mass: 0.7, stiffness: 140 } });
  const out = interpolate(f, [closeAt - 8, closeAt], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vis = Math.min(s, out);
  if (f < openAt || vis <= 0.001) return null;
  const W = 690, H = (W * 1080) / 900, bar = 42;
  const k = W / 900;
  return (
    <div
      style={{
        position: "absolute",
        right: 190,
        top: 96,
        width: W,
        transform: `translateY(${(1 - vis) * 40}px) scale(${0.9 + 0.1 * vis})`,
        opacity: vis,
        border: `1.5px solid ${C.ink}`,
        background: "#fff",
        boxShadow: "0 70px 140px -50px rgba(0,0,0,.7)",
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: C.surface2, borderBottom: `1px solid ${C.line}`, fontFamily: mono, fontSize: 15, color: C.muted }}>
        <span style={{ color: C.allow }}>●</span> https://www.sandbox.paypal.com/checkoutnow
        <span style={{ marginLeft: "auto", fontFamily: sans, fontWeight: 700, fontSize: 12, letterSpacing: "0.14em", color: C.paypal, border: `1.5px solid ${C.paypal}`, padding: "2px 7px" }}>SANDBOX</span>
      </div>
      <div style={{ width: W, height: H, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 2560 * k, height: 1440 * k }}>
          <Sequence from={openAt} layout="none">
            <OffthreadVideo src={staticFile("footage/paypal-popup1.webm")} startFrom={Math.round(Math.max(0, (FROM + (openAt / 30) * RATE - OPENED)) * 30)} playbackRate={RATE} muted style={{ width: "100%", height: "100%" }} />
          </Sequence>
        </div>
      </div>
    </div>
  );
};

// End on "PayPal is confirming the hold" (the next page shows this mandate's MCP token).
export const PAYPAL_FRAMES = at(mark("popup closed")) + 50;

export const PayPalHold: React.FC = () => {
  const openAt = at(OPENED) + 2;
  const closeAt = at(mark("popup closed"));
  return (
    <Shot
      take="paypal"
      from={FROM}
      rate={RATE}
      tilt={0.6}
      speedBadge
      cams={[{ at: 0, x: 280, y: 200, w: 2000 }, { at: closeAt + 50, x: 330, y: 260, w: 1850 }]}
      overlay={
        <>
          <PopupWindow openAt={openAt} closeAt={closeAt} />
          <Chip start={at(mark("review screen"))} x={120} y={940} size={26} tone="paypal">The human approves in PayPal · Orders v2 · intent=AUTHORIZE · $100.00</Chip>
          <Chip start={closeAt + 10} x={120} y={200} size={22} anchor="right">Sandbox · real API calls, test money</Chip>
        </>
      }
    />
  );
};
