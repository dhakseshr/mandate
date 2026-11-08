# Devpost submission: Writ

> Paste each section into the matching Devpost field. Keep the headings, since judges skim them.

## Tagline (≤ 200 chars)
The financial permission layer for autonomous AI: signed by a human, bounded by a PayPal hold, enforced by deterministic code. We don't trust the AI. We trust the boundary.

## Inspiration
AI agents are starting to buy things for people and companies, but today "letting an agent pay" means handing it a card. No payment system can answer four basic questions about an agent's purchase:
- Who authorized it?
- Within what limits?
- Can the agent hand that authority to another agent?
- Who can prove it afterwards?

PayPal and Google's AP2 work describes signed *mandates* as the answer. We wanted to build the part that actually **enforces** them at runtime, on real PayPal rails, even when the AI itself has been compromised.

## What it does
You write a rule in plain English, for example: *"Onboarding kit for the design team: monitors, headphones, lamps. $1,500 total, ask me before anything over $200, nothing from Amazon."*

1. **The policy.** An LLM compiles it into numbered clauses on a signed instrument. Deterministic code then cross-checks the result against your literal words, restoring any cap, approval line or exclusion the model dropped.
2. **The signatures.** You sign with a **passkey**, whose WebAuthn challenge is the sha256 of the mandate. You then approve a **PayPal authorization hold** for the budget. Writ seals an **AP2-shaped IntentMandate** (Ed25519) bound to that authorization ID.
3. **The agents.** A single agent, a team of agents, or *any* external agent over **MCP** shops real catalogs (Channel3). An orchestrator can delegate **sub-mandates**, which are always *narrower* than their parent on every rule (capability attenuation). An over-reaching delegation is refused with the reason.
4. **The verdict.** Every proposed purchase is checked by a **13-rule deterministic engine at every level of the delegation chain**:
   - **ALLOW:** partial capture from the hold, plus a signed merchant verification receipt and tracking via the PayPal Agent Toolkit.
   - **ESCALATE:** an approval slip goes to the human. If they decline with a reason, the agent adapts.
   - **DENY:** nobody can override it, not the agent and not the human.
5. **The kill switch** revokes any agent's subtree instantly. When the work is done, the **unspent hold is voided** and refunds run through the Agent Toolkit. PayPal **webhooks** (signature-verified) reconcile everything into an append-only **AG Grid ledger**.
6. **The proof.** The **red-team suite** hands a deliberately compromised AI agent a real $100 sub-mandate from the live hold and orders it to steal: prompt-injected overspend, forged prices, quantity stuffing, blocked merchants, skipping approvals, delegating itself more money, escaping its token scope, and spending after revocation. a sub-agent exceeding its own slice while the parent still has money. Writ then runs a **policy-specific Crash Test**, a boundary matrix generated from the mandate's own clauses (budget + $0.01, approval line + $0.01, one item too many, every blocked merchant and subdomain, rating − 0.1, deadline + 1 day, expiry, revocation, and every way a delegation could widen authority). It asks **PayPal's own API** before and after, and issues a signed **Assurance Certificate** bound to that exact mandate hash. Example: *"13/13 attacks blocked · 18/18 boundaries held · $0.00 moved — certificate PASSED"*.
7. **Merchants** can verify any agent order at `/verify` and get a signed, offline-verifiable receipt.
8. **Writ Tab: agents pay for data.** Paid APIs answer **HTTP 402** with a signed price. Writ verifies it, the same engine checks the call at every level of the chain, and charges accrue on a tab that **settles as one PayPal capture**. A 5-cent call can't escape the mandate. (The providers are simulated; the PayPal settlement is real.)
9. **Writ Forensics: an authorized payment isn't the same as a correct one.** Every purchase has an evidence graph. Code answers three questions (*authorized? did the agent follow the instruction? did the merchant or provider deliver?*), and an investigation agent cites evidence for every claim (uncited claims are dropped). It **recommends**: you approve a refund (via the Agent Toolkit) or a signed dispute pack.
10. **Agent Passport:** a signed, verifiable credential stating any agent's authority and delegation chain, up to the human.

## How we built it
**PayPal:**
- **Orders v2** (`intent=AUTHORIZE`, `/authorize`, `GET` for independent evidence)
- **Payments v2** (partial `capture` with idempotency keys, `void`, `refund`)
- **PayPal Agent Toolkit** (`create_refund`, `create_shipment_tracking`, `get_shipment_tracking`), wrapped so it only runs behind the policy engine
- **Webhooks** with `verify-webhook-signature`
- **JS SDK v6** for the human's approval
- **AP2 concepts:** signed IntentMandate, user signature, and the mandate hash stamped into each capture's `invoice_id`

**AI:**
- Vercel AI SDK v7 tool loops with JSON-schema structured output
- DeepSeek V4.1 Flash via Gödel Machines (OpenAI-compatible), with resilient retry and failover
- Used for: the compiler, the orchestrator, the specialist shopping agents and the adversarial red-team agent

**Enforcement and crypto:**
- A pure TypeScript policy engine, attenuation rules and a cross-check (23 Vitest tests)
- Ed25519 signatures over canonical JSON
- WebAuthn passkeys (`@simplewebauthn`)
- One lock per delegation tree

**Stack and sponsors:**
- **Next.js 15**, Tailwind v4, Postgres + Drizzle
- **Channel3** product search (agentic mode)
- **AG Grid** ledger with a custom theme
- **Render** Blueprint deploy
- An **MCP server** (Streamable HTTP), so any agent can connect with a scoped token

**Writ Tab, Forensics, Passport:**
- Ed25519-signed 402 price challenges with pinned provider keys and signed receipts.
- A batch-settled tab.
- Evidence graphs with deterministic checks and citation-enforced reports.
- Signed passports.

**Design:** "The Signed Instrument". The human's side looks like a cheque or legal instrument (§ clauses, amount in words, a guilloche seal). The machine's side is a terminal log of all 13 checks. Verdicts are rubber stamps. Color carries meaning only: PayPal blue means PayPal money; green, amber and red mean verdicts.

## Challenges we ran into
- **PayPal sandbox regions.** India-to-India sandbox payments are declined, so we moved to a US merchant and buyer.
- **One hold for a whole tree.** Making a single PayPal authorization safely back a whole *tree* of agents took care: spend counts against every ancestor, unspent allocations return to the parent, and money operations are serialised per tree.
- **The model drops instructions.** It sometimes silently dropped explicit rules ("nothing from Amazon"), so we added a deterministic cross-check. It fired during our own live run.
- **Honest security testing.** A model *resisting* an injection proves nothing about the boundary. So we built a suite where the AI is *told* to attack, and we check PayPal's own records rather than our database.

## Accomplishments that we're proud of
- **A full live run on Render with real PayPal sandbox money:**
  - passkey signature
  - $600 hold
  - orchestrator delegated 3 sub-mandates
  - 3 parallel specialist agents
  - chain-of-authority checks
  - 3 partial captures with merchant receipts and tracking
  - $301.53 voided
  - every step confirmed by verified webhooks
- **A compromised agent with a real budget couldn't move a cent,** and PayPal confirmed it. Every mandate can now carry a signed **Assurance Certificate**: crash-tested at every clause's edge, red-teamed, and PayPal-verified.

## What we learned
**"AI for judgment, math for money."** The safest agent architecture isn't a smarter model. It's a boundary the model can't argue with, enforced by the payment system itself.

## What's next for Writ
- The full **AP2** Cart and Payment mandate chain
- **Dispute evidence packs** submitted via PayPal's Disputes API
- **Phone approvals**
- **Earned autonomy** (limits that widen as an agent proves reliable)
- Nightly red-team scorecards
- A merchant SDK with a "Verified agent order" badge (aligned with PayPal Agent Ready / Store Sync)
- A `mandate.guard(tools)` SDK, plus ACP/UCP adapters
- Vault recurring mandates, and Payouts for marketplace settlement

## Built with
paypal · paypal-orders-v2 · paypal-payments-v2 · paypal-agent-toolkit · paypal-js-sdk · paypal-webhooks · ap2 · ai · llm · deepseek · vercel-ai-sdk · mcp · next.js · typescript · tailwindcss · postgresql · drizzle · channel3 · ag-grid · render · webauthn · ed25519

## Try it
- **Live:** https://mandate-xvwm.onrender.com (start at `/demo`)
- **Sandbox buyer:** `sb-u4310o53776285@personal.example.com` / _password here_
- **Repo:** https://github.com/dhakseshr/mandate (MIT)

## Prizes to opt into
Best Use of Agentic Commerce · Best Use of PayPal + AI · Best Use of AG Grid · Best Use of Channel3 · Best Use of Render. These are in addition to the overall prizes.
