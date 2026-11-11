import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { ColdOpen, EndCard, Problem, Title, Chapter } from "./scenes/Type";
import { AttackShot, BenchShot, LandingShot } from "./scenes/Act1";
import { Agents, Compose, Released, Review, SignPasskey } from "./scenes/Act2";
import { PayPalHold, PAYPAL_FRAMES } from "./scenes/PayPal";
import { AttackRows, AttackRunning, AttackStart, Certificate, ForensicsFault, ForensicsRefund, KillSwitch, LedgerShot, McpCard, Scorecard, TabShot } from "./scenes/Act3";

const Steal = () => <Chapter n="5" title="The attack" line="Now, order one to steal." dark />;

/** [scene, frames @30fps, name] — the edit decision list. */
export const SCENES: [React.FC, number, string][] = [
  [ColdOpen, 120, "Cold open · the injected listing"],
  [AttackShot, 180, "The AI was fooled · DENIED"],
  [Title, 105, "Title"],
  [Problem, 255, "The problem"],
  [LandingShot, 180, "Landing · who it's for"],
  [BenchShot, 300, "The boundary · the bench"],
  [Compose, 177, "Describe the mission"],
  [Review, 174, "You are signing this · VOID"],
  [SignPasskey, 210, "Team · passkey seal"],
  [PayPalHold, PAYPAL_FRAMES, "PayPal authorization hold"],
  [Agents, 210, "Agents at work"],
  [Released, 165, "Captured · voided back"],
  [TabShot, 252, "Writ Tab · Payouts"],
  [McpCard, 180, "Any agent · MCP"],
  [Steal, 75, "Chapter · the attack"],
  [AttackStart, 240, "Run the red-team suite"],
  [AttackRunning, 172, "The attack runs"],
  [Scorecard, 278, "Scorecard · $0.00 moved"],
  [AttackRows, 210, "Every attack, every rule"],
  [Certificate, 190, "Crash test · certificate"],
  [KillSwitch, 330, "Kill switch · REVOKED · VOID"],
  [ForensicsFault, 195, "Forensics · at fault"],
  [ForensicsRefund, 240, "Refund via Agent Toolkit"],
  [LedgerShot, 195, "Ledger · AG Grid"],
  [EndCard, 240, "End card"],
];
export const FILM_FRAMES = SCENES.reduce((s, [, d]) => s + d, 0);

export const Film: React.FC = () => (
  <AbsoluteFill>
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="2.2" /></filter>
    </svg>
    <Series>
      {SCENES.map(([S, d], i) => (
        <Series.Sequence key={i} durationInFrames={d}>
          <S />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
