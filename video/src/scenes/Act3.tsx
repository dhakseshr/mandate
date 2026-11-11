// Act 3: the Tab, the attack, PayPal's testimony, the kill switch, forensics, the ledger.
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, mono } from "../theme";
import { Shot, Beat } from "./Shot";
import { Chip, Label, Paper, Microprint, useProgress } from "../components/primitives";
import redteam from "../../public/footage/redteam.json";
import forensics from "../../public/footage/forensics.json";
import tab from "../../public/footage/tab.json";
import ledger from "../../public/footage/ledger.json";

type Take = { marks: { t: number; label: string; box: null | { x: number; y: number; width: number; height: number } }[] };
const t = (take: Take, label: string) => {
  const x = take.marks.find((k) => k.label.startsWith(label));
  if (!x) throw new Error(`marker ${label} missing`);
  return x.t;
};

/** Writ Tab: pay-per-call data, one PayPal capture, Payouts to providers. */
export const TabShot: React.FC = () => (
  <Shot
    take="tab"
    from={t(tab, "tab") - 0.3}
    rate={1.25}
    slate={{ n: "4", title: "Agents pay for data, too" }}
    cams={[{ at: 0, x: 280, y: 0, w: 2000 }, { at: 150, x: 330, y: 330, w: 1600 }, { at: 300, x: 330, y: 360, w: 1500 }]}
    fade={0.82}
    overlay={
      <>
        <Chip start={40} x={120} y={930} size={26}>HTTP 402 · signed price · per call</Chip>
        <Chip start={170} x={120} y={930} size={26} tone="paypal" anchor="right">1 PayPal capture · 1 Payouts batch</Chip>
      </>
    }
  />
);

/** Click "Run red-team suite", confirm the compromised agent's signed slice. */
export const AttackStart: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "rt head") - 0.5}
    rate={1.5}
    fade={0.42}
    slate={{ n: "5", title: "The attack" }}
    cams={[{ at: 0, x: 230, y: 0, w: 2100 }, { at: 110, x: 1050, y: 0, w: 1450 }]}
  />
);

/** The suite running: PayPal asked, attacks, adversarial AI, kill, PayPal asked again. */
export const AttackRunning: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "start click")}
    rate={(t(redteam, "scorecard") - t(redteam, "start click") - 0.3) / (172 / 30)}
    speedBadge
    fade={0.5}
    cams={[{ at: 0, x: 230, y: 0, w: 2100 }]}
    overlay={<Chip start={10} x={120} y={930} size={26} tone="deny">A compromised agent · a real $100 slice of this hold · told to steal</Chip>}
  />
);

/** Scorecard head: attacks blocked, money moved, PayPal's own before/after. */
export const Scorecard: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "scorecard") + 0.6}
    cams={[{ at: 0, x: 280, y: 60, w: 2000 }, { at: 150, x: 300, y: 100, w: 1960 }]}
    overlay={<Chip start={110} x={120} y={930} size={28} tone="paypal">$0.00 moved · confirmed by PayPal&apos;s API, before and after</Chip>}
  />
);

/** Every attack, every rule that stopped it. */
export const AttackRows: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "sc scroll 0") - 0.3}
    rate={2.1}
    speedBadge
    cams={[{ at: 0, x: 280, y: 40, w: 2000 }]}
    overlay={<Chip start={20} x={120} y={940} size={26}>Scripted attacks + an AI told to break the rules · same engine</Chip>}
  />
);

/** Crash test held, assurance certificate issued. */
export const Certificate: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "sc scroll 7") - 0.3}
    rate={0.9}
    cams={[{ at: 0, x: 280, y: 150, w: 2000 }, { at: 180, x: 300, y: 200, w: 1960 }]}
    overlay={<Chip start={60} x={120} y={940} size={26}>Assurance certificate · Ed25519-signed · verifiable offline</Chip>}
  />
);

/** Kill switch: revoke, punched REVOKED, the hold released, VOID. */
export const KillSwitch: React.FC = () => (
  <Shot
    take="redteam"
    from={t(redteam, "revoke click") - 0.6}
    rate={1.55}
    slate={{ n: "6", title: "The kill switch" }}
    cams={[
      { at: 0, x: 1150, y: 260, w: 1350 },
      { at: 150, x: 1150, y: 420, w: 1350 },
      { at: 190, x: 240, y: 315, w: 2040 },
      { at: 330, x: 250, y: 315, w: 2020 },
    ]}
    overlay={<Chip start={235} x={120} y={110} size={26} tone="paypal" anchor="right">Payments v2 · void · the whole hold released</Chip>}
  />
);

/** Forensics: the manipulated provider, at fault; every claim cites evidence. */
export const ForensicsTop: React.FC = () => (
  <Shot
    take="forensics"
    from={t(forensics, "forensics top") + 0.3}
    rate={1.4}
    slate={{ n: "7", title: "When it goes wrong" }}
    cams={[{ at: 0, x: 200, y: 160, w: 2200 }, { at: 140, x: 280, y: 240, w: 2000 }]}
  />
);
export const ForensicsFault: React.FC = () => (
  <Shot
    take="forensics"
    from={t(forensics, "questions") + 0.4}
    slate={{ n: "7", title: "When it goes wrong" }}
    cams={[{ at: 0, x: 280, y: 200, w: 2000 }, { at: 90, x: 1150, y: 300, w: 1300 }]}
    overlay={<Chip start={30} x={120} y={940} size={26}>Every claim cites evidence E1…E9 · uncited claims dropped by code</Chip>}
  />
);
export const ForensicsRefund: React.FC = () => (
  <Shot
    take="forensics"
    from={t(forensics, "chip target") + 0.5}
    rate={1.6}
    cams={[{ at: 0, x: 900, y: 200, w: 1600 }, { at: 120, x: 1050, y: 320, w: 1300 }]}
    overlay={<Chip start={150} x={120} y={940} size={26} tone="paypal">Refund via the PayPal Agent Toolkit · approved by a human</Chip>}
  />
);

/** The append-only audit ledger (AG Grid). */
export const LedgerShot: React.FC = () => (
  <Shot
    take="ledger"
    from={t(ledger, "ledger") - 2.5}
    slate={{ n: "8", title: "Every cent, on the record" }}
    cams={[{ at: 0, x: 120, y: 120, w: 2300 }, { at: 200, x: 280, y: 200, w: 1900 }]}
    overlay={<Chip start={60} x={120} y={940} size={26}>Append-only ledger · AG Grid · traceable to PayPal IDs</Chip>}
  />
);

/** Any agent over MCP: a terminal card with the real command shape. */
export const McpCard: React.FC = () => {
  const a = useProgress(4, 20);
  const lines = [
    ["$", "claude mcp add --transport http writ \\"],
    ["", '  "https://writ-…run.app/api/mcp?token=mdt_••••••••"'],
    ["", ""],
    ["›", "propose_purchase { product_id, quantity }"],
    ["←", '{ "status": "DENIED", "rule": "BUDGET_REMAINING" }'],
  ];
  return (
    <Paper>
      <Microprint y={0} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 90 }}>
        <div style={{ width: 620 }}>
          <Label size={18} color={C.muted}>Any agent · MCP</Label>
          <div style={{ fontFamily: "Bodoni Moda", fontSize: 76, lineHeight: 1.05, marginTop: 20, color: C.ink, opacity: a }}>
            Claude, or any MCP agent.
            <br />
            <i>Same rules. Same hold.</i>
          </div>
        </div>
        <div style={{ width: 980, background: C.night, color: C.nightInk, fontFamily: mono, fontSize: 26, padding: "34px 40px", boxShadow: "0 50px 100px -50px rgba(0,0,0,.6)", border: `1.5px solid ${C.ink}`, opacity: a }}>
          {lines.map(([p, l], i) => {
            const v = useProgress(14 + i * 14, 12);
            return (
              <div key={i} style={{ opacity: v, minHeight: 40, whiteSpace: "pre", color: p === "←" ? C.nightDeny : C.nightInk }}>
                <span style={{ color: "#8a8476", marginRight: 16 }}>{p}</span>
                {l}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Paper>
  );
};

export const _b = Beat;
