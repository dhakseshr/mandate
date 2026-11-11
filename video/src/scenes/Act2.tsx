// Act 2: one live mission, recorded end to end: describe → sign → PayPal hold → agents → release.
import React from "react";
import { Shot } from "./Shot";
import { Chip } from "../components/primitives";
import live from "../../public/footage/live.json";

type Take = { marks: { t: number; label: string }[] };
const t = (take: Take, label: string) => {
  const x = take.marks.find((k) => k.label.startsWith(label));
  if (!x) throw new Error(`marker ${label} missing`);
  return x.t;
};

export const Compose: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "composer") - 0.5}
    slate={{ n: "3", title: "One live mission" }}
    cams={[{ at: 0, x: 150, y: 40, w: 2250 }, { at: 120, x: 700, y: 60, w: 1700 }]}
    fade={0.7}
    overlay={<Chip start={20} x={120} y={940} size={26}>$100 total · ask me above $15 · never bulkbin.example</Chip>}
  />
);

export const Review: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "review loaded") + 0.2}
    cams={[{ at: 0, x: 280, y: 0, w: 2000 }, { at: 70, x: 1150, y: 560, w: 1000 }, { at: 165, x: 1150, y: 560, w: 1000 }]}
    overlay={<Chip start={25} x={120} y={940} size={26}>Gemini on Vertex AI drafts the clauses · plain code re-checks them</Chip>}
  />
);

export const SignPasskey: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "team click") - 2.2}
    rate={1.6}
    cams={[{ at: 0, x: 560, y: 300, w: 1500 }, { at: 160, x: 560, y: 520, w: 1500 }]}
    overlay={<Chip start={95} x={120} y={940} size={26}>Passkey · WebAuthn signs sha256(intent)</Chip>}
  />
);

export const PayPalHold: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "paypal click") - 0.6}
    rate={1.6}
    cams={[{ at: 0, x: 0, y: 0, w: 2560 }, { at: 200, x: 280, y: 200, w: 2000 }]}
    overlay={
      <>
        <Chip start={20} x={120} y={940} size={26} tone="paypal">PayPal Orders v2 · intent=AUTHORIZE · $100.00 held</Chip>
        <Chip start={20} x={120} y={940} size={22} anchor="right">Sandbox · real API calls, test money</Chip>
      </>
    }
  />
);

export const Agents: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "mission control") + 1}
    rate={(t(live, "closed") - t(live, "mission control") - 1) / 8}
    speedBadge
    fade={0.9}
    cams={[{ at: 0, x: 200, y: 60, w: 2200 }, { at: 240, x: 280, y: 120, w: 2000 }]}
    overlay={
      <>
        <Chip start={15} x={120} y={940} size={26}>3 agents · narrower signed slices · one hold</Chip>
        <Chip start={120} x={120} y={940} size={26} anchor="right">13 rules at every level · partial captures</Chip>
      </>
    }
  />
);

export const Released: React.FC = () => (
  <Shot
    take="live"
    from={t(live, "top") + 0.4}
    cams={[{ at: 0, x: 280, y: 160, w: 2000 }, { at: 150, x: 330, y: 420, w: 1650 }]}
    overlay={<Chip start={60} x={120} y={940} size={26} tone="paypal">$15.67 captured · $84.33 voided back · webhook-verified</Chip>}
  />
);
