import type { View } from "../mandate-screen";
import { det, type Ev } from "../log/shared";

export const RED_TEAM_AGENT = "Red-team agent";

export type Outcome = "DENIED" | "REFUSED" | "HELD_FOR_HUMAN" | "CONTAINED" | "NOT_APPLICABLE" | "BREACH";
export type AttackResult = {
  id: string;
  name: string;
  technique: string;
  blocked: boolean;
  outcome: Outcome;
  rule: string;
  detail: string;
  by: "harness" | "adversary-llm";
};
export type Snapshot = {
  order_id?: string | null;
  authorization_id?: string | null;
  authorization_status?: string | null;
  authorized?: number | null;
  captured?: number | null;
  capture_count?: number | null;
  fetched_at?: string | null;
};
export type CrashCase = { id: string; clause: string; case: string; expected: string; verdict: string; rule?: string; held: boolean };
export type CrashTest = { total: number; held: number; cases: CrashCase[] };
export type Certificate = { id?: string; sha256?: string; url?: string };
export type Scorecard = {
  crashTest?: CrashTest;
  certificate?: Certificate;
  attempts: number;
  blocked: number;
  breaches: number;
  moved: number;
  paypal: { before?: Snapshot; after?: Snapshot };
  redTeamMandateId?: string;
  results: AttackResult[];
};

export const isScorecard = (e: Ev) => e.type === "POLICY_VERDICT" && e.rule === "RED_TEAM_SCORECARD";
export const isSuiteStart = (e: Ev) => e.tool === "redteam" && e.type === "PAYPAL" && /^Red team starting/.test(e.title);
const isSuiteFail = (e: Ev) => e.tool === "redteam" && /^Red-team run failed/.test(e.title);

export const scorecardOf = (e: Ev): Scorecard | null => {
  const s = det(e).scorecard as Scorecard | undefined;
  return s && Array.isArray(s.results) ? s : null;
};

/** Every mandate in the subtree that belongs to a red-team agent (the agent itself and anything it delegated to). */
export function hostileIds(tree: View["tree"] | undefined): Set<string> {
  const out = new Set<string>();
  const nodes = tree ?? [];
  for (const t of nodes) if (t.name === RED_TEAM_AGENT) out.add(t.id);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of nodes)
      if (!out.has(t.id) && t.parentId && out.has(t.parentId)) {
        out.add(t.id);
        grew = true;
      }
  }
  return out;
}

/** Where the suite stands, derived purely from the append-only log. */
export function suiteState(view: View) {
  const { events } = view;
  const hostile = hostileIds(view.tree);
  let iStart = -1;
  let iScore = -1;
  let iFail = -1;
  events.forEach((e, i) => {
    if (isSuiteStart(e)) iStart = i;
    if (isScorecard(e)) iScore = i;
    if (isSuiteFail(e)) iFail = i;
  });
  const running = iStart >= 0 && iStart > iScore && iStart > iFail;
  const scoreEv = iScore >= 0 ? events[iScore] : null;
  const scorecard = scoreEv ? scorecardOf(scoreEv) : null;
  const since = running ? events.slice(iStart + 1) : [];
  const attempts = since.filter((e) => e.type === "POLICY_VERDICT" && hostile.has(e.mandateId)).length;
  const phases = [
    { text: "PayPal asked", done: running },
    { text: "Scripted attacks", done: since.some((e) => e.type === "POLICY_VERDICT" && hostile.has(e.mandateId)) },
    { text: "Adversarial AI", done: since.some((e) => e.tool === "redteam" && /^Adversarial AI agent released/.test(e.title)) },
    { text: "Kill switch", done: since.some((e) => e.tool === "revoke" && e.type === "HUMAN" && hostile.has(e.mandateId) && /Red-team run complete/i.test(e.title)) },
    { text: "PayPal asked again", done: since.some((e) => e.tool === "redteam" && e.type === "PAYPAL" && /independently confirms/.test(e.title)) },
  ];
  return {
    running,
    attempts,
    phases,
    scorecard,
    scoreEv,
    startEv: iStart >= 0 ? events[iStart] : null,
    failed: iFail > iStart && iFail > iScore ? events[iFail] : null,
    hostile,
  };
}
