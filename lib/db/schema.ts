import { pgTable, text, jsonb, numeric, integer, timestamp, index, boolean } from "drizzle-orm/pg-core";
import type { Policy, Product, Evaluation } from "@/lib/policy/schema";

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const mandates = pgTable("mandates", {
  id: id(),
  rawText: text("raw_text").notNull(),
  policy: jsonb("policy").$type<Policy>().notNull(),
  // DRAFT -> AWAITING_AUTH -> ACTIVE -> FULFILLED | EXPIRED | VOIDED
  status: text("status").notNull().default("DRAFT"),
  paypalOrderId: text("paypal_order_id"),
  authorizationId: text("authorization_id"),
  payerEmail: text("payer_email"),
  budgetTotal: money("budget_total").notNull(),
  authorizedAmount: money("authorized_amount").notNull().default(0),
  spentTotal: money("spent_total").notNull().default(0),
  refundedTotal: money("refunded_total").notNull().default(0),
  itemsBought: integer("items_bought").notNull().default(0),
  summary: text("summary"),
  /** Red-team demo: a poisoned listing is injected into search results. */
  redTeam: boolean("red_team").notNull().default(false),
  /** sha256 of the canonical signed mandate document (AP2-shaped IntentMandate + policy + PayPal hold). */
  signatureHash: text("signature_hash"),
  signature: text("signature"),
  signingPublicKey: text("signing_public_key"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  /** Delegation tree: a sub-mandate is always narrower than its parent and draws on the ROOT's PayPal hold. */
  parentId: text("parent_id"),
  rootId: text("root_id"),
  /** Short role name for sub-mandates, e.g. "Monitor agent". */
  name: text("name"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  /** Human signature: a WebAuthn assertion whose challenge IS the sha256 of the intent document. */
  signedWith: text("signed_with"), // "passkey" | null
  passkeyCredentialId: text("passkey_credential_id"),
  passkeyIntentHash: text("passkey_intent_hash"),
  passkeyAssertion: jsonb("passkey_assertion"),
  passkeyChallenge: text("passkey_challenge"), // pending registration challenge
  /** "builtin" = Mandate's own agent shops; "external" = any agent connects over MCP with agentToken;
   *  "team" = an orchestrator splits the mandate into sub-mandates, each shopped by its own agent. */
  agentMode: text("agent_mode").notNull().default("builtin"),
  /** Bearer token scoping an external (MCP) agent to exactly this mandate. Issued at authorization. */
  agentToken: text("agent_token").unique(),
  /** Products the agent has seen, keyed by id. Purchases must reference these — the model can't invent prices. */
  catalog: jsonb("catalog").$type<Record<string, Product>>().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const agentRuns = pgTable("agent_runs", {
  id: id(),
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  // RUNNING | WAITING_APPROVAL | DONE | ERROR
  status: text("status").notNull().default("RUNNING"),
  messages: jsonb("messages").$type<unknown[]>().notNull().default([]),
  error: text("error"),
  startedAt: createdAt(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/** Append-only audit ledger: every thought, tool call, policy verdict, PayPal call and human action. */
export const agentEvents = pgTable(
  "agent_events",
  {
    id: id(),
    mandateId: text("mandate_id").notNull().references(() => mandates.id),
    runId: text("run_id"),
    ts: createdAt(),
    // THOUGHT | TOOL_CALL | TOOL_RESULT | POLICY_VERDICT | PAYPAL | HUMAN | SYSTEM
    type: text("type").notNull(),
    tool: text("tool"),
    title: text("title").notNull(),
    detail: jsonb("detail"),
    verdict: text("verdict"), // ALLOW | ESCALATE | DENY
    rule: text("rule"),
    amount: money("amount"),
    merchant: text("merchant"),
    paypalId: text("paypal_id"),
  },
  (t) => [index("events_mandate_idx").on(t.mandateId, t.ts)],
);

export const purchases = pgTable("purchases", {
  id: id(),
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  product: jsonb("product").$type<Product>().notNull(),
  merchant: text("merchant").notNull(),
  quantity: integer("quantity").notNull().default(1),
  amount: money("amount").notNull(),
  captureId: text("capture_id"),
  // CAPTURED | REFUNDED | PARTIALLY_REFUNDED
  status: text("status").notNull(),
  refundId: text("refund_id"),
  trackingNumber: text("tracking_number"),
  rationale: text("rationale"),
  createdAt: createdAt(),
});

/** Human-in-the-loop: a purchase the policy escalated. */
export const approvals = pgTable("approvals", {
  id: id(),
  mandateId: text("mandate_id").notNull().references(() => mandates.id),
  runId: text("run_id"),
  product: jsonb("product").$type<Product>().notNull(),
  quantity: integer("quantity").notNull().default(1),
  rationale: text("rationale"),
  evaluation: jsonb("evaluation").$type<Evaluation>().notNull(),
  // PENDING | APPROVED | REJECTED
  status: text("status").notNull().default("PENDING"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** WebAuthn credentials (passkeys) used to sign mandates. No accounts: a passkey IS the signer. */
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(), // credential id (base64url)
  publicKey: text("public_key").notNull(), // COSE public key, base64url
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  createdAt: createdAt(),
});

/** PayPal webhook idempotency. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // PayPal event id
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: createdAt(),
});

/** Cached product searches (Channel3 quota is limited). */
export const searchCache = pgTable("search_cache", {
  key: text("key").primaryKey(),
  results: jsonb("results").$type<Product[]>().notNull(),
  createdAt: createdAt(),
});
