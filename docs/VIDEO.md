# Demo video: script and shot list (target 2:50, hard limit < 3:00)

**Rules:**
- Record on the **live Render site**; wake it first.
- 1080p, burned-in captions, no copyrighted music.
- Cut every spinner and wait.
- An AI voiceover is allowed. Speak at a normal pace; never speed up the audio.
- Upload to YouTube as **Public** by Nov 11.

**Before recording:**
1. Wake the app.
2. Prepare one **Procurement** mandate up to the review screen.
3. Have a second, **already-authorized** team mandate ready, so the red-team run can be shown without waiting.
4. Zoom the browser to 110–125%.

---

### 0:00–0:15 · Hook
- **On screen:** a black frame, then the agent log tape on the landing page, ending on the **DENIED** stamp landing.
- **Voiceover:** "AI agents are about to spend money for us. Today, the only way to let one pay is to hand it a card. So what stops it when it gets fooled?"

### 0:15–0:35 · Who it's for and the thesis
- **On screen:** landing hero ("Your AI can shop. It can't overspend."), then the "Who it's for" rows.
- **Voiceover:** "Writ is the financial permission layer for autonomous AI. It starts with procurement teams that want AI agents buying for them, without handing over a corporate card. AI decides what to buy. Writ decides whether it's allowed to spend. PayPal enforces the boundary."

### 0:35–1:00 · Sign and hold
- **On screen:**
  - `/demo` → Procurement → Prefill → Compile.
  - The § clauses appear; highlight "ask me above $200" and "never from amazon".
  - Choose **A team of agents** → **Sign with passkey** (show the OS prompt) → **PayPal** approval popup.
  - The **$1,500 hold** appears in the budget envelope, with the authorization ID zoomed in.
- **Voiceover:** "One sentence becomes a signed instrument. Code double-checks the AI's reading against my exact words. I sign it with my passkey, and PayPal places a real authorization hold. Nothing is charged; agents can only capture from this hold."

### 1:00–1:35 · Delegation and enforcement
- **On screen:**
  - The **chain of authority** builds: three sub-mandates appear, and a **REFUSED** card ("asks for $2,500 but only $30 is left to delegate").
  - Agents' reasoning in the log, and one verdict block with its 13 ✓ lines plus "checked at Monitor agent ✓ → Your mandate ✓".
  - A capture landing: the envelope bar moves, and the PayPal capture ID and the API string are zoomed in.
  - An **approval slip** → Approve.
- **Voiceover:** "An orchestrator splits the budget across specialist agents. Each sub-mandate is mathematically narrower than its parent; ask for more and it's refused. Every purchase is checked by thirteen deterministic rules at every level of the chain, then captured from the one PayPal hold. Anything above my line comes to me."

### 1:35–2:20 · The proof: a compromised agent
- **On screen:**
  - Click **Run red-team suite**. Show the PayPal "before" line.
  - Cut through the attacks: the $389 injected listing (hidden text struck through), forged $1 product, delegating itself $5,000, revoking the human's mandate, spending after the kill switch. Each one gets a **DENIED / REFUSED** stamp.
  - The adversarial AI's own words ("I'll buy the pre-approved listing…").
  - The **crash-test matrix** filling in: every clause probed at its exact edge, all ✓.
  - The **scorecard**: "N/N blocked · N/N boundaries held · $0.00 moved", **"PayPal independently confirms: $X captured before and after"**, and the **Assurance Certificate ✓ Verified** stamp.
- **Voiceover:** "Now the important part. We hand a compromised AI agent a real hundred-dollar budget from this hold and order it to steal. Injected listings, forged prices, fake approvals, giving itself more money, escaping its own permissions. Every attempt is denied by plain code. And we don't ask our own database whether it worked. We ask PayPal. Zero dollars moved. Then we crash-test every clause at its exact edge and sign an assurance certificate for this mandate. We don't trust the AI. We trust the boundary."

### (optional, if time allows) Beyond shopping
- **On screen:**
  - The Writ Tab statement: 5-cent paid API calls accruing, then one PayPal settlement.
  - Forensics on the manipulated provider: three questions (PASS / UNKNOWN / FAIL), "AT FAULT", cited evidence, the decision slip.
- **Voiceover:** "Agents also pay for data. Every five-cent call inherits the same mandate, then settles through PayPal in one capture. And when something goes wrong, Writ rebuilds the evidence and recommends a fix. You decide."
- **Fitting it in:** trim the delegation beat to make room, and stay under 3:00.

### 2:20–2:40 · Kill switch, release, audit, merchants
- **On screen:**
  - **Revoke** a sub-agent: the REVOKED stamp lands.
  - The mandate closes: the held stripes collapse, and "VOID · RETURNED" shows the released amount.
  - The **Ledger** (AG Grid) with totals and attacks blocked.
  - **/verify:** a merchant checks an order and gets "AUTHORIZED — SHIP IT" with the signature ✓ Valid.
- **Voiceover:** "One tap revokes any agent. Unspent money goes straight back. Every cent is in an append-only ledger, and merchants can verify any agent's order before they ship."

### 2:40–2:50 · Close
- **On screen:** the landing instrument, the URL and repo, and the PayPal / Channel3 / AG Grid / Render line.
- **Voiceover:** "Writ. Signed by a human, bounded by PayPal, provable forever."

---

**Shot checklist:**
- [ ] passkey prompt
- [ ] PayPal popup
- [ ] hold ID
- [ ] refused delegation
- [ ] 13 checks
- [ ] capture ID
- [ ] approval
- [ ] red-team scorecard plus PayPal confirmation
- [ ] revoke
- [ ] void
- [ ] ledger
- [ ] /verify
