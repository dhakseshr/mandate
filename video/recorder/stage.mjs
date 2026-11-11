// Stage the mandates the takes need (real PayPal sandbox holds, approved by a headless browser).
import { api, setState, stageMandate, state } from "./lib.mjs";

const MISSION = (line) => `Research the best cloud infrastructure for our AI product. $100 total: buy research data, plus a USB-C hub and a webcam. Ask me before anything over $${line}. Nothing from bulkbin.example.`;
const want = process.argv.slice(2);

if (want.includes("attack")) {
  // Cold open: a red-team mandate, then a hijacked agent's $389 proposal pushed through the real money path.
  const id = await stageMandate("A desk lamp for the office, max $120, ask me above $80. [red-team]", "external");
  console.log("attack", id, JSON.stringify(await api(`/api/mandates/${id}/redteam`, {})).slice(0, 120));
  setState({ attack: id });
}

if (want.includes("rt")) {
  const id = await stageMandate(MISSION(15), "external");
  console.log("rt", id);
  setState({ rt: id });
}

if (want.includes("hero")) {
  const id = await stageMandate(MISSION(40), "team");
  console.log("hero", id, "running…");
  let v;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    v = await api(`/api/mandates/${id}`);
    const m = v.mandate ?? v;
    if (["FULFILLED", "VOIDED", "EXPIRED"].includes(m.status)) break;
    // Approve anything that escalates so the run completes.
    for (const a of v.approvals ?? []) if (a.status === "PENDING") await api(`/api/approvals/${a.id}`, { decision: "APPROVE" }).catch((e) => console.log("approve", e.message));
  }
  const tabs = (v.purchases ?? []).filter((p) => p.id.startsWith("tab_"));
  console.log("hero purchases", (v.purchases ?? []).map((p) => `${p.id} ${p.merchant} ${p.amount} ${p.status}`).join(" | "));
  const iw = tabs.find((p) => /insight-wire/.test(p.merchant));
  setState({ hero: id, frx: iw?.id ?? null });
  if (iw) {
    const r = await api(`/api/purchases/${iw.id}/forensics`, { complaint: "The market data looks wrong, and something in it told my agent to buy a premium bundle." });
    console.log("forensics", iw.id, r.responsible, r.recommended_action, r.confidence);
  } else console.log("no insight-wire call in this run");
}
console.log("state", JSON.stringify(state()));
