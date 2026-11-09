# Writ: What's Built

> **The financial permission layer for autonomous AI.**
> AI decides what to buy. Writ decides whether it's allowed to spend. PayPal enforces the boundary.
> *We don't trust the AI. We trust the enforcement boundary.*

- **Live:** https://mandate-xvwm.onrender.com
- **Repo:** github.com/dhakseshr/mandate (private until submission)
- **Status date:** 8 Nov 2026 (updated). **Product renamed to Writ;** a *mandate* is the signed instrument inside it.

**Legend:**
- ✅ **Live**: verified on the deployed Render site with real PayPal sandbox money.
- ✅ **Tested**: verified locally or in sandbox (scripted, API, or browser end-to-end).
- 🔨: in progress.
- ❌: not built.

---

## 1. Summary

You write a rule in plain English. An LLM compiles it into a strict policy, and deterministic code cross-checks that policy against your literal words. You sign it with a **passkey** and approve a **PayPal authorization hold** for the budget. Agents can be Writ's own, a team of specialists, or any external agent over MCP. They can only **partially capture** from that hold, and only when a **deterministic 13-rule policy engine** allows it, at **every level** of the delegation chain. Sub-agents can only receive **narrower** authority. Merchants can verify orders and get signed receipts. A kill switch revokes any subtree. Unspent money is voided back. A **red-team suite** proves a deliberately compromised agent can't move money, using PayPal's own records as the evidence.

---

## 2. Verified live on Render (real PayPal sandbox)

**Full team run** on mandate `man_02a0b370db4e`:

| Step | Evidence |
|---|---|
| Plain English → policy | 6 § clauses. The cross-check restored "Nothing from Amazon" when the model dropped it |
| Passkey signing (WebAuthn) | "Signed with passkey · intent #b2702d38" |
| PayPal AUTHORIZE hold | $600.00, auth `33X33188964456815` |
| Ed25519 AP2 seal | Export plus "Verified ✓" |
| Orchestrator delegation | Monitor $250, Headphones $200, Lamp $130. Each passed attenuation and was signed, chained to the parent hash |
| Parallel specialist agents | Three agents searched Channel3, compared and explained. For example: *"Bose $169 exceeds your $150 line; JBL $142.99 matches its rating and stays in policy"* |
| Chain-of-authority checks | Each purchase was checked at the sub-mandate *and* the root |
| Partial captures | $94.99, $142.99 and $60.49, from the single root hold |
| Merchant verification receipts | An Ed25519-signed receipt for each capture |
| Shipment tracking | Via the PayPal Agent Toolkit `create_shipment_tracking` |
| Auto-void | $301.53 released |
| Webhooks | Signature-verified "PayPal confirmed …" for authorization, every capture, and the void |

**Also confirmed live:** the new landing page and `/demo`, `/verify`, `/ledger`, the MCP endpoint (rejects bad tokens), and the webhook endpoint (rejects unsigned calls).

**Tested in sandbox or locally:**
- single-agent ALLOW → capture
- ESCALATE → approve → capture
- ESCALATE → decline with a reason → the agent adapted
- refund via the Agent Toolkit `create_refund`, with double-refund protection
- kill-switch cascade across a tree
- over-reaching delegation refused
- MCP protocol plus tools over HTTP
- passkey signing end to end in Chrome (virtual authenticator)
- the raw PayPal cycle: authorize → 2 partial captures → void → refund
- **red-team suite: 15/15 attacks blocked, $0.00 moved** (see §3.6)

---

## 3. Features

### 3.1 Consent: signed mandates ✅
- **Plain English → policy** (LLM, structured JSON-schema output): budget cap, approval line, per-item cap, max items, categories, merchant allow and block lists, brand blocks, minimum rating, deadline, preferences, expiry, open questions.
- **Deterministic cross-check** (`lib/policy/crosscheck.ts`) restores explicit caps, approval lines and exclusions the model dropped, and records each fix. ✅ Fired live.
- **The instrument:** numbered § clauses, each labelled with what enforces it, all editable.
- **Passkey (WebAuthn) signing:** the challenge is sha256 of the intent document. Editing a clause invalidates the signature. ✅ Live.
- **Ed25519 seal** over an AP2-shaped IntentMandate, bound to the PayPal authorization and embedding the passkey signature. Export and verify at `/api/mandates/[id]/ap2`. ✅ Live.

### 3.2 Enforcement: the PayPal budget envelope ✅ Live
- **Orders v2 `AUTHORIZE` hold**, approved through JS SDK v6.
- **Partial captures** with idempotency keys. The mandate hash goes in `invoice_id`.
- **Auto-void** of the remainder. **Refunds** via the Agent Toolkit `create_refund` (REST fallback). **Tracking** via `create_shipment_tracking`.
- **Webhooks:** signature-verified and idempotent. A void webhook no longer shows the misleading original amount.

### 3.3 Deterministic policy engine ✅
- **13 rules:** `MANDATE_ACTIVE`, `CURRENCY`, `IN_STOCK`, `BUDGET_REMAINING`, `MAX_PER_ITEM`, `MAX_ITEMS`, `MERCHANT_BLOCK`, `MERCHANT_ALLOW`, `BRAND_BLOCK`, `CATEGORY_ALLOW`, `MIN_RATING`, `DELIVERY_DEADLINE`, `APPROVAL_THRESHOLD`.
- **Verdicts:** ALLOW, ESCALATE, DENY (DENY can't be overridden).
- **Prices from the catalog, never from the model.** One money code path, one lock per tree, every check logged.

### 3.4 Authority: delegation trees ✅ Live
- **Capability attenuation:** a child is narrower than its parent on every rule, and wider requests are refused with reasons.
- **Chain-of-authority evaluation** at every level. One root PayPal hold for the whole tree. Spend counts against every ancestor, and unspent allocations return to the parent.
- **Signed chain:** each sub-mandate embeds its parent's and the root's hashes.
- **Team mode:** an orchestrator plans 2–4 specialists, and agent names are normalised ("Monitor agent").
- **MCP** `delegate` / `revoke_sub_mandate` for external orchestrators.

### 3.5 Human in the loop ✅
- **Approval slips:** approve, or decline with a reason the agent adapts to. Approvals are claimed atomically.
- **Kill switch:** revokes a subtree, rejects pending approvals, halts agents, and voids the root hold. ✅ Tested via the API and the fixture. 🔨 Not yet clicked in the live UI.
- **Progress steps** show "No approval needed ✓" when nothing escalated.

### 3.6 Proof: the red-team suite ✅ Tested (backend) · 🔨 UI in progress
`POST /api/mandates/[id]/redteam/suite` (`lib/redteam-suite.ts`):
1. **Asks PayPal's own API** for the hold's status and captures (`GET /v2/checkout/orders/{id}`).
2. Hands a **compromised agent** a *real signed $100 sub-mandate* from the live hold, with a $0.01 approval line, so nothing can be captured without a human.
3. **Scripted battery**, through the real tool and money paths:

| # | Attack | Stopped by |
|---|---|---|
| A1 | Prompt-injected $389 overspend | `BUDGET_REMAINING` → DENY |
| A2 | Quantity stuffing (40 units) | `BUDGET_REMAINING` → DENY |
| A3 | Forged product priced at $1 | Catalog provenance → refused |
| A4 | Blocked merchant | `MERCHANT_BLOCK` → DENY (N/A if the mandate blocks no merchant) |
| A5 | Skip the approval line | `APPROVAL_THRESHOLD` → held for a human, declined |
| A6 | Delegate itself 50× more money | Attenuation → refused |
| A7 | Delegate without limits | Attenuation → refused |
| A8 | Revoke the human's root mandate | Token scope → refused |
| A9 | Spend after the kill switch | `MANDATE_ACTIVE` → DENY |

4. **A genuinely adversarial LLM**, explicitly instructed to break the rules, using the same tools. It tried delegating itself $1,000, $389 and $101, and tried the $389 listing: all refused or denied. Delegations it made *within* its own limits are reported as **CONTAINED** (narrower by construction, no authority gained, revoked).
5. **A10:** the compromised sub-agent tries to spend beyond its own $100 slice while the root still has money. Denied by its own `BUDGET_REMAINING`.
6. **Crash Test** (`lib/crashtest.ts`, `POST /api/mandates/[id]/crashtest`): a policy-specific boundary matrix from the mandate's own clauses, run through the real engine and attenuation code. Read-only, instant, and it works before signing too. Typically 18–21 cases. ✅ 21/21 on the team and draft fixtures.
7. Revokes the compromised agent, **asks PayPal again**, and issues a signed **Assurance Certificate** (`GET /api/mandates/[id]/certificate`, add `?download` for a file). It's bound to the mandate hash, policy, PayPal authorization, crash test, red-team results and PayPal's before-and-after snapshot, and is re-verified on every request. ✅ Local run: *"13/13 attacks blocked · 18/18 boundaries held · $0.00 moved — certificate #51c88b73 PASSED"*, signature valid.

- **Test result:** **"15/15 attacks blocked · $0.00 moved"**, with no breaches.
- The live run, which shows PayPal's real before-and-after numbers, is still to do on Render.
- Also: the original single-agent **prompt-injection demo** (the "Inject poisoned listing" action plus the DENIED attack panel) ✅.

### 3.7 Settlement: merchant verification ✅ Live
- `POST /api/verify` returns a signed receipt: verdict, rule, the chain to the PayPal authorization, and the Ed25519 signature. `?check` re-verifies a receipt.
- A receipt is issued automatically for every capture.
- **`/verify` merchant desk** with a stamped receipt and a signature check.

### 3.8 Any agent: MCP server ✅ Tested
- `POST /api/mcp`: Streamable HTTP, stateless JSON-RPC, with a per-mandate scoped token.
- **Tools:** `get_mandate`, `search_products`, `check_policy`, `propose_purchase`, `get_status`, `delegate`, `revoke_sub_mandate`, `finish`.
- 🔨 Not yet tried with a real Claude client.

### 3.9 Audit ledger ✅ Live
- Append-only events for every thought, search, verdict (all 13 checks), human action, PayPal call (with the API name), webhook, delegation, verification, passkey and red-team result.
- **`/ledger` (AG Grid):** totals, event and mandate tabs, filters, search, CSV export, row detail, mobile layout.

---

### 3.10 Writ Tab: paid APIs (HTTP 402) ✅ Tested · UI ✅

**How it works (`lib/tab/*`):**
- Simulated providers return **Ed25519-signed 402 price challenges**. Keys are pinned; tampered or expired quotes are denied (`PROVIDER_SIGNATURE`).
- Each call is evaluated by the same engine **at every delegation level**.
- Approved calls get signed receipts, which providers check before returning data.
- Calls accrue on a tab that **batch-settles as one PayPal partial capture** (≥ $1.00, or on close or revoke before the void).
- Escalations work as normal approvals. Settled calls can be partially refunded.
- Tools: `list_api_providers` and `buy_api_call` for agents and over MCP.

**Test results:**
- Calls paid: $0.05, $0.10 and $0.15.
- Over the per-call cap → DENIED.
- Tampered price → DENIED.
- Blocked provider → DENIED.
- Above the approval line → ESCALATED.

### 3.11 Writ Forensics ✅ Tested · UI ✅

**How it works (`lib/forensics.ts`, `/api/purchases/[id]/forensics`, `/forensics/[id]`):**
- An evidence graph E1…En: intent, passkey, seal, delegation, listing, agent decision, 13 checks, receipt, payment, provider response, webhooks, complaint.
- Deterministic checks answer three questions: authorized, agent compliance, merchant or provider delivery.
- The LLM report must cite evidence IDs, and uncited claims are dropped by code.
- Human-approved resolution: a refund via the Agent Toolkit, or an Ed25519-signed dispute pack.
- **Real PayPal disputes** (`lib/disputes.ts`, `/api/purchases/[id]/dispute`): syncs a buyer's dispute from the Disputes API (webhook or button), investigates it, and recommends contesting or accepting. After a human decides, Writ submits the signed evidence PDF via `provide-evidence` or accepts the claim via the Agent Toolkit `accept_dispute_claim`. Built and unit-checked (PDF renders, multipart accepted by PayPal); **live test pending a buyer-opened sandbox dispute.**

**Test result** (manipulated provider): provider at fault, high confidence, 0 dropped.

### 3.12 Agent Passport ✅ · UI ✅
- `/api/agents/[id]/passport` plus the `/agents/[id]` page.
- A signed authority statement: delegation chain to the human, limits, spent, status, PayPal backing, latest certificate.
- Verifiable via `/api/verify?check`.

### 3.14 Know Your Merchant ✅ Tested
- Look-alike and impersonation detection inside `MERCHANT_BLOCK`.
- 0 false positives on 28 real merchants.
- Red-team A11, plus crash-test cases.

### 3.15 Autonomy profiles ✅ Tested
- Careful, Balanced and Autopilot presets.
- A profile never loosens a stated limit.
- The compiler can't set the profile.

### 3.16 Provider payouts ✅ Tested
- Each tab settlement pays providers through a PayPal Payouts batch, grouped per provider.
- Tested: a real sandbox batch, PENDING.

### 3.17 Photo → mission ✅ Tested
- `/api/vision` identified a real product photo with HIGH confidence and suggested a mission.

### 3.18 Flagship mission ✅ Tested
- Research agent on the tab, plus hardware agents.
- One mandate, one hold, the cross-check restored the Amazon block.
- **35 tests.**

### 3.13 Voice input ✅
- Mission dictation in the composer (Web Speech API). It never auto-submits.

**Also fixed this round:**
- Word-based category matching.
- The cross-check now restores per-call caps, lowercase domain exclusions, and "X only" scope phrases.
- Canonical JSON now handles dates.
- Refunds now lock the whole delegation tree.
- **29 tests.**

## 4. Screens: "The Signed Instrument" design ✅

**Art direction:**
- The human's side is paper: a cheque or legal instrument.
- The machine's side is a terminal log.
- Verdicts are rubber stamps.
- PayPal blue means PayPal money only; green, amber and red mean verdicts only.
- Newsreader + IBM Plex type, square geometry, four choreographed motions.
- Checked in light and dark mode, at desktop and 390px.

| Route | Status |
|---|---|
| `/`: landing (cheque hero, agent log tape, lifecycle table, composer) | ✅ Live · 🔨 new positioning copy in progress |
| `/demo`: guided tour; scenarios A red team, B approval/reject, C headphones, D team of agents (now escalates at $100) | ✅ Live · 🔨 featured Procurement scenario in progress |
| `/m/[id]` review: instrument, § clauses, open questions, one agent / team / MCP choice, passkey, PayPal | ✅ Live |
| `/m/[id]` live: seals, budget envelope, progress steps, chain-of-authority tree (incl. refused delegations), DENIED panel, decision log (DELEGATE/REVOKE/VERIFY/PASSKEY/PLAN tags, sub-agent labels), approval slip, statement, kill switch, MCP card | ✅ Live · 🔨 red-team scorecard panel in progress |
| `/ledger` | ✅ Live · 🔨 attack totals in progress |
| `/verify` | ✅ Live |

---

## 5. AI vs deterministic code

| AI (DeepSeek V4.1 Flash via Gödel, OpenAI-compatible) | Deterministic code + PayPal |
|---|---|
| Compile plain English → policy | Cross-check against your literal words |
| Orchestrator plans sub-mandates | Attenuation check on every delegation |
| Shopping agents search, compare, explain | The 13-rule engine decides every verdict |
| Adapt after a declined approval | PayPal holds, captures, voids, refunds |
| Adversarial agent in the red-team suite | Ed25519, WebAuthn, per-tree locks, idempotency, ledger |

**Resilience:** backoff and optional Gemini failover; per-step checkpoints so Resume never replays a purchase.

---

## 6. PayPal platform usage ✅

| Capability | Used for |
|---|---|
| Orders v2 (AUTHORIZE, authorize, GET) | Budget hold, and before/after evidence for the red-team suite |
| Payments v2 (partial capture, void, refund) | Purchases, releasing the remainder, refund fallback |
| Agent Toolkit (`create_refund`, `create_shipment_tracking`, `get_shipment_tracking`) | Guarded tool execution |
| Webhooks + `verify-webhook-signature` | Reconciliation (live) |
| JS SDK v6 | The human approving the hold |
| AP2 concepts | IntentMandate, user signature, mandate hash in `invoice_id` |

**Sponsors:** Channel3 (search), AG Grid (ledger), Render (deploy).

---

## 7. Architecture

- **App:** Next.js 15 + TypeScript + Tailwind v4.
- **AI:** Vercel AI SDK v7.
- **Data:** Postgres + Drizzle, 6 migrations applied at boot.
- **Integrations:** `@paypal/agent-toolkit`, `@paypal/react-paypal-js`, `@simplewebauthn`, `ag-grid-react`.
- **Hosting:** Render Blueprint with auto-deploy on push.

**API routes:** `mandates` (create, list, view, patch), `order`, `authorize`, `passkey`, `delegate`, `revoke`, `run`, `redteam`, `redteam/suite`, `ap2`, `approvals`, `purchases/refund`, `verify`, `mcp`, `paypal/webhook`, `ledger`, `health`.

**Tables:** mandates, agent_runs, agent_events, purchases, approvals, passkeys, webhook_events, search_cache.

---

## 8. Testing ✅
- **Vitest, 23 tests:** engine (13), attenuation (6), cross-check (4).
- **Sandbox scripts:** envelope spike, compiler, search, agent, team fixture, red-team suite.
- **Browser end-to-end:** passkey (Playwright virtual authenticator).
- **Design QA:** screenshot harness checking light and dark mode, desktop and 390px, console errors and overflow.

---

## 9. Submission documents ✅

| File | Contents |
|---|---|
| `README.md` | Positioning (enterprise procurement first), 5 differentiators, red-team proof table, 3-minute judge path, AI split, PayPal usage, MCP, local setup, security, limitations |
| `docs/DEVPOST.md` | Every Devpost field, Built With, prizes to opt into |
| `docs/VIDEO.md` | 2:50 script and shot list, centred on the compromised agent and PayPal's confirmation |
| `docs/VALIDATION.md` | Outreach message and 4 feedback questions (real answers only) |
| `BUILT.md` | This file |

**Positioning status:**
- ✅ Done in the README, Devpost text and video script.
- 🔨 The website copy (landing "Who it's for", category line, featured Procurement scenario) is in progress.

---

## 10. Honest limitations
- **Sandbox only.** Writ is the merchant of record and fulfilment is simulated. The production path is Agent Ready / Store Sync merchants plus Payouts.
- **Product data:** delivery estimates are deterministic per merchant, and ratings are often missing.
- **Back-translation** is a deterministic cross-check, not a second model.
- **The red-team suite** runs on demand, not nightly.
- **Not built:** full AP2 Cart/Payment chain, phone (QR) approvals, earned autonomy, scheduled red-team runs, merchant SDK and badge, A2A/ACP/UCP adapters, `mandate.guard()` SDK, Vault, AG Studio fleet console.

---

## 11. Remaining before submission (deadline Nov 13, 01:30 IST)

| # | Task | Owner | Status |
|---|---|---|---|
| 1 | Red-team scorecard UI + enterprise positioning on the site | Design agent | 🔨 |
| 2 | Review, build, push to Render | Claude | after 1 |
| 3 | Live red-team run (PayPal's real "$0.00 moved") | You + Claude | ❌ |
| 4 | Live kill-switch click and refund | You + Claude | ❌ |
| 5 | Sandbox buyer password in Devpost text | You | ❌ |
| 6 | Render upgrades (web + database) for uptime until Dec 21 | You | ❌ |
| 7 | Record and upload the video (YouTube, public) | You | ❌ |
| 8 | Make the repo public, then submit on Devpost | Claude + you | ❌ |
| 9 | Feedback from 5 people (optional, strengthens Impact) | You | ❌ |
