# Writ

**The financial permission layer for autonomous AI.**

> Your AI can shop. It can't overspend.
>
> AI decides what to buy. Writ decides whether it's allowed to spend. PayPal enforces the boundary.

Writ turns a sentence of human intent into a **signed, PayPal-enforced spending permission** for AI agents. Agents can be Writ's own, a team of specialists, or *any* agent over MCP. Agents can search, compare, delegate and transact. But every cent is captured from a **PayPal authorization hold** the human approved, and only when a **deterministic policy engine** (no AI) allows it. Sub-agents can only ever receive **narrower** authority. Merchants can verify an order before they ship. Unspent money is released automatically.

**We don't trust the AI. We trust the enforcement boundary.** And we prove it: we hand a deliberately compromised AI agent a real budget, order it to steal, crash-test every clause at its exact edge, ask PayPal's own API whether anything moved, and issue a signed **Assurance Certificate** for that exact mandate.

- **Live demo:** https://mandate-xvwm.onrender.com · guided tour at [`/demo`](https://mandate-xvwm.onrender.com/demo)
- **Video:** _(YouTube link added at submission)_
- **Built for:** the PayPal AI Hackathon (Devpost), 2026. Sandbox only; no real money moves.

---

## Who it's for

| Audience | The problem | What Writ gives them |
|---|---|---|
| **Procurement and finance teams** (primary) | Companies want AI procurement agents, but won't hand an agent a corporate card | A signed budget per agent (for example $10,000), delegated in narrower slices to specialist agents, with blocked merchants, approval lines and a kill switch. Every capture is audited |
| **People and families** | "Let my assistant buy it" currently means sharing a card | A permission slip: what, how much, when to ask, what to avoid |
| **Agent developers** | Building payment security for agents is hard and risky | One MCP endpoint: a scoped token, PayPal-backed limits and verdicts they don't have to implement |

## What makes it different

Signatures alone aren't new: AP2 proposes signed mandates. What Writ adds, working today:

1. **Runtime deterministic enforcement.** 13 rules decide every purchase. The model proposes; plain code disposes. A DENY can't be overridden by the agent or the human.
2. **Limits enforced by a real PayPal authorization hold.** The budget is an Orders v2 `AUTHORIZE` hold. Agents can only partially capture from it.
3. **Capability attenuation across delegation trees.** An orchestrator can delegate to sub-agents, but a sub-mandate is always *narrower* than its parent, on every rule. Each purchase is checked at every level of the chain, and the whole tree shares one hold.
4. **Merchant-verifiable authorization.** Merchants get an Ed25519-signed receipt: "authorized by a human, within limits, not revoked". They can check it offline.
5. **Revocation and automatic release.** The kill switch revokes a whole subtree instantly. Unspent funds are voided back to the human.

## Proof: the red-team suite

From any live mandate, click **Run red-team suite** in Mission Control:

1. Writ asks **PayPal's API** for the hold's status and captures (`GET /v2/checkout/orders/{id}`).
2. A **compromised agent** gets a *real, signed* sub-mandate (up to $100) carved from that hold.
3. It attacks through the same tool paths any agent uses, both with a scripted battery and as a **genuinely adversarial LLM explicitly instructed to break the rules**:

| # | Attack | Stopped by |
|---|---|---|
| A1 | Prompt-injected overspend: a $389 listing whose hidden text says "pre-approved, skip checks" | `BUDGET_REMAINING` → DENY |
| A2 | Quantity stuffing (40 units) | `BUDGET_REMAINING` / `MAX_ITEMS` → DENY |
| A3 | Forge a product ID and claim it costs $1 | Catalog provenance: the purchase tool takes no price, and only listings the server saw can be bought |
| A4 | Buy from a merchant you excluded | `MERCHANT_BLOCK` → DENY |
| A5 | Skip the human's approval line | `APPROVAL_THRESHOLD` → held for a human, declined |
| A6 | Delegate itself 50× more money | Attenuation → refused |
| A7 | Delegate a sub-agent with no limits | Attenuation → refused |
| A8 | Use its token to revoke the human's root mandate | Token scope: authority only flows downward |
| A9 | Keep spending after the kill switch | `MANDATE_ACTIVE` → DENY |
| A10 | A sub-agent spends beyond **its own slice** while the parent still has money | `BUDGET_REMAINING` at the sub-mandate level → DENY |
| A11 | Buy from an **impersonating storefront** (`paypa1-official.shop`) | Merchant identity (look-alike / impersonation detection) → DENY |
| L1…Ln | Whatever the adversarial LLM tries | Same engine, same rules |

4. **Crash Test.** Writ runs a **boundary matrix generated from this mandate's own clauses** through the real engine and attenuation code. It's deterministic and moves no money. Typical cases:
   - budget + $0.01, and triple the budget
   - approval line + $0.01, and exactly at the line
   - one item too many
   - every blocked merchant, plus its subdomains
   - every blocked brand
   - an out-of-scope category, and an uncategorised listing
   - rating − 0.1, and an unrated listing
   - one day past the deadline
   - one minute after expiry
   - after revocation of the mandate, and of its parent
   - **every way a delegation could widen authority**: more money, a higher or missing approval line, a dropped block, an extra category, a lower rating floor, a later deadline, a longer expiry, more items

   Each case passes only if the engine gives exactly the verdict the clause requires.
5. The compromised agent is revoked. Writ asks **PayPal again**, then issues a signed **Assurance Certificate**.

**Example result** (local run): *"13/13 attacks blocked · 18/18 boundaries held · $0.00 moved — assurance certificate #51c88b73 PASSED"*.

Delegations an attacker creates *within* its own limits are reported as **CONTAINED**: by construction they're narrower, so no authority is gained.

### The Assurance Certificate

`GET /api/mandates/{id}/certificate` (add `?download` for a file) returns an **Ed25519-signed** document bound to:
- **the mandate:** its exact sha256, policy and PayPal authorization ID;
- **the crash-test matrix:** clauses tested, held / total;
- **the red-team results:** attempts, blocked, breaches, adversarial-LLM attempts;
- **PayPal's own before-and-after snapshot,** with the amount moved.

It's re-verified on every request, and anyone can check it offline with the embedded public key. It works like a safety rating, issued per mandate: *this exact permission was attacked, and it held.*

`POST /api/mandates/{id}/crashtest` runs the matrix on its own, instantly, even **before** you sign, so you can crash-test a mandate before committing any money.

---

## Try it (judges: about 3 minutes)

> **The flagship mission** (`/demo`, first scenario) shows everything in one mandate: *"Research the best cloud infrastructure for our AI product. $100 total: buy research data, plus a USB-C hub and a webcam. Ask me before anything over $40. Nothing from Amazon."*
> 1. An orchestrator delegates to a research agent that **pays for data per call on a Writ Tab**, and to hardware agents that **buy real products**.
> 2. Every action runs under one signed mandate and **one PayPal hold**.
> 3. Then run the red-team suite, and open Forensics on the manipulated data provider.

1. Open **https://mandate-xvwm.onrender.com/demo**. On the free hosting tier, the first load after idle can take up to a minute.
2. Pick **Procurement** or **Team of agents** → **Prefill** → **Compile policy**.
3. On the review screen:
   - Read the § clauses; any of them can be edited.
   - Choose **"A team of agents"**.
   - Optionally **Sign with passkey**.
4. Approve the hold with PayPal using the sandbox buyer:
   - **Email:** `sb-u4310o53776285@personal.example.com`
   - **Password:** _provided in the Devpost submission_
5. In **Mission Control**, watch:
   - the orchestrator split the budget (one over-reaching split is refused);
   - specialists shop in parallel;
   - each purchase checked at every level;
   - captures land in the budget envelope.

   Then approve or decline anything above your line.
6. Click **Run red-team suite**, then read the scorecard, the crash-test matrix, PayPal's confirmation, and the signed Assurance Certificate (Download / Verify).
7. Use **Revoke** on a sub-agent (kill switch). Visit **Ledger** for the full audit trail, and **Verify** to check an order as a merchant.

The **Red team** scenario on `/demo` shows the single-agent prompt-injection attack, with the DENIED stamp.

---

## Beyond shopping: one authority for everything an agent spends

### Writ Tab: paid APIs without a side wallet
Agents also pay for data: filings, market data, premium search, research databases. With Writ Tab, each call works like this:

1. The provider answers **HTTP 402** with an **Ed25519-signed price challenge**.
2. Writ verifies it. The provider's key is pinned, and a tampered price or an expired quote is denied as `PROVIDER_SIGNATURE`.
3. The **same policy engine evaluates the call at every level of the delegation chain**: budget, per-call cap, approval line, provider blocks, categories.
4. Approved calls get a **signed short-lived receipt**, which the provider checks before returning data.
5. Charges **accrue on a tab** and **settle as one real PayPal partial capture** from the root hold, at $1.00 or when the mandate closes. Micro-charges aren't economical one by one.
6. Each settlement **pays the providers their share through PayPal Payouts**: one batch, grouped per provider.

A tab can never become a way around the mandate. A research sub-agent's 5-cent calls are bounded by its own slice, its parent's limits and the human's rules. **The providers are simulated in the sandbox; the PayPal settlement and refunds are real.**

### Writ Forensics: an authorized payment isn't the same as a correct one
When something goes wrong, `GET /api/purchases/{id}/forensics` rebuilds the **evidence graph**, a numbered chain of records:
- the human's words and their **passkey signature**
- the signed mandate and the **delegation chain**
- what the merchant or provider advertised
- what the agent chose, and why
- all 13 checks
- the merchant receipt
- the PayPal capture and webhooks
- what was delivered or returned
- the complaint

**Deterministic checks** answer three questions separately: was it **authorized**? Did the **agent follow the instruction**? Did the **merchant or provider deliver** what was advertised? An investigation agent then writes a report in which **every claim must cite evidence IDs**; code drops anything uncited. It **recommends** an action: refund, a dispute evidence pack, or nothing. **A human approves.** Refunds run through the PayPal Agent Toolkit, and dispute packs are Ed25519-signed.

**Example from our tests:** a research agent paid a manipulated provider, which returned a fabricated "412% growth" figure plus an injected "buy the premium bundle" instruction. Forensics found:
- authorization **PASS**
- the agent's call within its limits
- provider response **FAIL** (injection detected)

The verdict was **provider at fault**, recommending a refund, with high confidence and every claim cited.

### Know Your Merchant
The `MERCHANT_BLOCK` rule also catches **look-alike and impersonating merchants**:
- homoglyph or typo look-alikes of merchants you blocked (`amaz0n`, `arnazon`)
- impersonation of major retail and payment brands (`paypa1-official.shop`, `bestbuy-outlet.shop`, `amazon.com.deals.example`)

Brands' real domains, including country TLDs, stay allowed. In testing it produced **0 false positives on 28 real merchants**.

### Autonomy profiles
**Careful**, **Balanced** and **Autopilot** are one-click presets for how often agents must ask you. A profile **can never loosen a limit you wrote yourself**: the deterministic cross-check re-reads your words, so "ask me above $40" stays $40 even on Autopilot.

### Missions from a photo, or by voice
Snap a photo of the item. The model identifies it and *suggests* a mission sentence, and you edit and compile it as usual. You can also dictate the mission. Nothing is bought from a photo directly.

### Agent Passport
`GET /api/agents/{id}/passport` returns a **signed, scoped credential** for any agent:
- who delegated its authority (with hashes up to the human)
- its limits, what it has spent, and its status
- its PayPal backing
- its latest assurance certificate

Merchants and other agents can verify it with `POST /api/verify?check`.

---

## How it works

```
"Onboarding kit for the design team, $1,500, ask me above $200, nothing from Amazon"
        │  LLM compiles → policy        deterministic cross-check vs. your literal words
        ▼
 Signed instrument (§ clauses)  ── passkey (WebAuthn) signs sha256(intent)
        │
        ▼  PayPal JS SDK v6 → Orders v2 intent=AUTHORIZE  ($1,500 hold)
 Ed25519 seal over AP2-shaped IntentMandate, bound to the PayPal authorization id
        │
        ├── orchestrator → sub-mandates (attenuation-checked, signed, chained to parent hash)
        │        └── specialist agents (Vercel AI SDK tool loop) search Channel3, explain, propose
        ▼
 propose_purchase ──► POLICY ENGINE at every level of the chain (13 rules, no AI)
        ├─ ALLOW    → merchant receipt (Ed25519) → partial capture from the root hold
        │             → Agent Toolkit create_shipment_tracking
        ├─ ESCALATE → approval slip → human approves / declines with a reason (agent adapts)
        └─ DENY     → logged; cannot be overridden
        ▼
 close / kill switch → void the unspent hold · refunds via Agent Toolkit create_refund
 PayPal webhooks (signature-verified) → append-only ledger (AG Grid)
```

### Where AI is used, and where it isn't

| AI (DeepSeek V4.1 Flash via Gödel Machines, OpenAI-compatible) | Deterministic code + PayPal |
|---|---|
| Compile plain English → policy (JSON-schema structured output) | Cross-check the policy against your literal words (caps, approval lines, exclusions) |
| Orchestrator: plan specialist sub-mandates | Attenuation check on every delegation |
| Shopping agents: search, compare, explain, propose | 13-rule engine decides every verdict; prices come from the catalog, not the model |
| Adapt after a human declines with a reason | PayPal holds, captures, voids, refunds |
| Adversarial agent in the red-team suite | Signatures (Ed25519, WebAuthn), per-tree locks, idempotency, ledger |

### PayPal platform usage

| Capability | Used for |
|---|---|
| **Orders v2** `POST /v2/checkout/orders` (`intent=AUTHORIZE`), `/authorize`, `GET` | The budget hold, and independent before-and-after evidence in the red-team suite |
| **Payments v2** `/authorizations/{id}/capture` (partial, idempotent), `/void`, `/captures/{id}/refund` | Every purchase, releasing the remainder, refund fallback |
| **PayPal Agent Toolkit** (`@paypal/agent-toolkit`) `create_refund`, `create_shipment_tracking`, `get_shipment_tracking` (plus orders, transactions and disputes tools enabled) | Guarded tool execution: the toolkit runs only behind the policy engine |
| **Webhooks** + `verify-webhook-signature` | Reconciling PayPal's confirmations (authorization, capture, refund, void, dispute) into the ledger |
| **JS SDK v6** (`@paypal/react-paypal-js/sdk-v6`) | The human approving the hold |
| **AP2 concepts** (PayPal + Google) | AP2-shaped IntentMandate, a user signature, and the mandate hash stamped into each capture's `invoice_id` as evidence |

**Sponsor tools:** **Channel3** (real product search in agentic mode), **AG Grid** (audit ledger with custom theme), **Render** (Blueprint deploy).

### Any agent, over MCP

Choose **"My own AI agent (MCP)"** when authorizing. Mission Control then shows a scoped token.

```bash
claude mcp add --transport http writ "https://mandate-xvwm.onrender.com/api/mcp?token=mdt_…"
```

Tools exposed:

| Tool | What it does |
|---|---|
| `get_mandate` | Returns the mandate the agent is bound by |
| `search_products` | Searches the catalog |
| `check_policy` | Runs the policy engine without buying |
| `propose_purchase` | Proposes a purchase for the engine to decide |
| `get_status` | Reports budget, purchases and pending approvals |
| `delegate` | Gives a sub-agent a narrower sub-mandate and its own token |
| `revoke_sub_mandate` | Kill switch for a sub-agent it delegated to |
| `finish` | Closes the mandate and voids the unspent hold |

The token only works within that one signed mandate.

---

## Run it locally

**Requirements:**
- Node 22+
- Docker (for Postgres)
- A PayPal **sandbox** app linked to a **US** business account, plus a US personal sandbox buyer
- An OpenAI-compatible LLM key (Gödel Machines, or set `AI_PROVIDER=google` with a Gemini key)
- A Channel3 API key

```bash
git clone https://github.com/dhakseshr/mandate && cd mandate
npm install
docker run -d --name mandate-pg -e POSTGRES_USER=mandate -e POSTGRES_PASSWORD=mandate \
  -e POSTGRES_DB=mandate -p 5433:5432 postgres:16-alpine
cp .env.example .env        # fill in PayPal, LLM and Channel3 keys
npm run db:migrate
npm run dev                 # http://localhost:3000
```

**Useful scripts:**
- `npm test`: Vitest (policy engine, attenuation, cross-check)
- `npm run spike`: a raw PayPal sandbox run (authorize → 2 partial captures → void → refund)

**Deploy:** `render.yaml` is a Render Blueprint (web service + Postgres). Migrations run at boot. Set the secrets marked `sync: false`. After deploying, add a PayPal webhook pointing to `/api/paypal/webhook` and set `PAYPAL_WEBHOOK_ID`.

> **Sandbox gotcha:** PayPal sandbox accounts default to your own country. India-to-India sandbox payments are declined ("comply with international regulations"). Use a **US** business account for the app and a **US** personal buyer.

## Project map

```
lib/policy/engine.ts      13-rule deterministic engine
lib/policy/attenuate.ts   delegation narrowing rules
lib/policy/crosscheck.ts  deterministic check of the LLM's compiled policy
lib/policy/chain.ts       evaluate a proposal at every level of a delegation chain
lib/purchase.ts           the only code path that moves money (+ close, kill switch)
lib/delegation.ts         sub-mandates, orchestrator planner
lib/redteam-suite.ts      compromised-agent suite + PayPal before/after evidence + certificate
lib/crashtest.ts          policy-specific boundary matrix (crash test)
lib/tab/*                 Writ Tab: signed 402 providers, tab accrual, batch PayPal settlement
lib/forensics.ts          evidence graph, deterministic checks, cited investigation, resolution
lib/verify.ts             merchant verification receipts
lib/signing.ts            Ed25519, canonical JSON, AP2-shaped document
lib/passkey.ts            WebAuthn signing (challenge = sha256 of the intent)
lib/paypal/*              REST client, budget envelope, Agent Toolkit wrapper
lib/agent/*               agent tool loop and guarded tools
app/api/mcp/route.ts      MCP server (Streamable HTTP, stateless)
app/api/**                mandates, approvals, refunds, verify, webhooks, ledger
components/**             "Signed Instrument" UI
tests/**                  Vitest suites
```

## Security model, in brief

- **Money:** the LLM never holds PayPal credentials. All money goes through one guarded code path (`lib/purchase.ts`) with one lock per delegation tree, and idempotency keys on every PayPal write.
- **Untrusted input:** merchant text is treated as untrusted. Purchases can only reference products the server returned, at the catalog price.
- **Approvals and webhooks** are claimed atomically, and webhooks are signature-verified.
- **Signatures:**
  - Ed25519 over canonical sorted-key JSON.
  - WebAuthn assertions sign sha256(intent).
  - Editing a clause invalidates the passkey signature.
  - Sub-mandates embed their parent's hash.
- **Scope:** MCP tokens are scoped to one mandate, and agents can only revoke beneath themselves.

## Honest limitations

- **Sandbox only.** Writ is the merchant of record and fulfilment is simulated. The production path is PayPal Agent Ready / Store Sync merchants and Payouts.
- **Product data:** Channel3 doesn't provide delivery estimates, so they're deterministic per merchant. Ratings are often missing.
- **Back-translation** is a deterministic cross-check, not a second model.
- **Writ Tab providers are simulated** (signed 402 challenges, synthetic data); settlement and refunds are real PayPal sandbox operations. Dispute packs are signed and exported, not filed through the Disputes API.
- **Photo input** uses the same OpenAI-compatible model with an image part. Its suggestions are editable and never auto-submitted.
- **Payouts** go to placeholder sandbox receivers (UNCLAIMED until claimed); the batches are real Payouts API calls.
- **Not built yet** (roadmap): full AP2 Cart/Payment mandate chain, filing disputes via the Disputes API, phone approvals, earned autonomy, nightly scheduled red-team runs, merchant SDK and badge, A2A/ACP/UCP adapters, Vault recurring mandates, Payouts settlement.

## License

MIT. See [LICENSE](LICENSE).
