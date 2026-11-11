// Act 1: the attack cold open (footage), the landing, the bench.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, mono, serif } from "../theme";
import { Shot } from "./Shot";
import { Chip, Label, ease } from "../components/primitives";
import { focus } from "../components/Screen";
import attack from "../../public/footage/attack.json";
import landing from "../../public/footage/landing.json";

const m = (take: { marks: { t: number; label: string; box: null | { x: number; y: number; width: number; height: number } }[] }, label: string) => {
  const x = take.marks.find((k) => k.label.startsWith(label));
  if (!x) throw new Error(`marker ${label} missing`);
  return x;
};

/** The hijacked agent's $389 proposal, punched DENIED. */
export const AttackShot: React.FC = () => {
  const k = m(attack, "punch animates");
  // The attack panel spans the page width; frame it and fade the log (and its MCP token) into paper.
  return (
    <Shot
      take="attack"
      from={k.t - 0.4}
      fade={0.6}
      cams={[{ at: 0, x: 230, y: 0, w: 2100 }, { at: 170, x: 270, y: 10, w: 2020 }]}
      overlay={
        <>
          <Chip start={70} x={150} y={940} tone="deny" size={30}>$389.00 attempted · $0.00 moved</Chip>
          <Chip start={95} x={150} y={940} tone="paypal" size={30} anchor="right">PayPal hold intact · $120.00</Chip>
        </>
      }
    />
  );
};

/** Landing: the hero, then a glide to "who it's for". */
export const LandingShot: React.FC = () => {
  const hero = m(landing, "hero");
  return (
    <Shot
      take="landing"
      from={hero.t + 0.5}
      rate={1.05}
      slate={{ n: "1", title: "Built for procurement teams first" }}
      cams={[
        { at: 0, x: 120, y: 120, w: 2200 },
        { at: 120, x: 40, y: 40, w: 2480 },
        { at: 300, x: 160, y: 160, w: 2240 },
      ]}
    />
  );
};

/** The bench: one listing dragged across the rules, the engine's verdict column up close. */
export const BenchShot: React.FC = () => {
  const f = useCurrentFrame();
  const t60 = m(landing, "bench 60").t, t101 = m(landing, "bench 101").t, t140 = m(landing, "bench 140").t;
  const from = t60 - 3.2;
  const rate = 1.35;
  const src = from + (f / 30) * rate;
  const price = interpolate(src, [from, t60 - 0.55, t60 - 0.05, t101 - 0.55, t101 - 0.05, t140 - 0.55, t140 - 0.05], [101.79, 101.79, 60, 60, 101, 101, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const verdict = src >= t140 + 0.15 ? ["DENIED", C.deny] : src >= t101 + 0.15 ? ["ASK HUMAN", C.escalate] : src >= t60 + 0.15 ? ["ALLOWED", C.allow] : ["ASK HUMAN", C.escalate];
  return (
    <Shot
      take="landing"
      from={from}
      rate={rate}
      layout="right"
      slate={{ n: "2", title: "Three parties" }}
      cams={[{ at: 0, x: 1440, y: 330, w: 1080 }]}
      side={{ kicker: "The boundary", lines: ["AI decides what to buy.", "Writ decides whether it may spend.", "PayPal enforces it."], italicLast: true, at: 6 }}
      overlay={
        <div style={{ position: "absolute", right: 120, bottom: 70, display: "flex", alignItems: "baseline", gap: 26, background: C.surface, border: `1.5px solid ${C.ink}`, padding: "16px 26px", boxShadow: "0 24px 50px -28px rgba(0,0,0,.5)" }}>
          <Label size={16} color={C.muted}>Agent proposes</Label>
          <div style={{ fontFamily: mono, fontSize: 46, color: C.ink, minWidth: 220, textAlign: "right" }}>${price.toFixed(2)}</div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color: verdict[1], minWidth: 190 }}>{verdict[0]}</div>
        </div>
      }
    />
  );
};

export const _unused = { serif, ease };
