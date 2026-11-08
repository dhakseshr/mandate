// Delegation: an agent (or the human) can hand a sub-agent a sub-mandate that is strictly narrower
// than its own. Every sub-mandate draws on the ROOT's single PayPal authorization; spend at any
// level counts against every ancestor; revoking a parent revokes the whole subtree.
import { randomBytes } from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { model } from "@/lib/ai/provider";
import { attenuate, inherit } from "@/lib/policy/attenuate";
import { PolicySchema, type Policy } from "@/lib/policy/schema";
import { delegableOf, getChain, getMandate, logEvent, newId, treeKey, withMandateLock } from "@/lib/ledger";
import { canonical, signMandate } from "@/lib/signing";
import { createHash } from "node:crypto";

export const SubMandateRequest = z.object({
  name: z.string().min(2).max(60).describe("Role of the sub-agent, e.g. 'Monitor agent'"),
  goal: z.string().min(3).max(200),
  search_query: z.string().min(2).max(120),
  budget_total: z.number().positive(),
  approval_threshold: z.number().positive().nullable().optional(),
  max_per_item: z.number().positive().nullable().optional(),
  max_items: z.number().int().positive().default(1),
  categories_allow: z.array(z.string()).optional(),
  merchants_block: z.array(z.string()).optional(),
  must_have: z.array(z.string()).optional(),
  agentMode: z.enum(["builtin", "external"]).default("builtin"),
});
export type SubMandateRequest = z.infer<typeof SubMandateRequest>;

export type DelegationResult =
  | { ok: true; mandateId: string; name: string; budget: number; agentToken: string; signatureHash: string }
  | { ok: false; name: string; violations: { field: string; message: string }[] };

export async function createSubMandate(parentId: string, req: SubMandateRequest, by: "human" | "agent" = "human"): Promise<DelegationResult> {
  const p0 = await getMandate(parentId);
  if (!p0) throw new Error("Parent mandate not found");

  return withMandateLock(treeKey(p0), async () => {
    const parent = (await getMandate(parentId))!;
    if (parent.status !== "ACTIVE") return { ok: false as const, name: req.name, violations: [{ field: "status", message: `Parent mandate is ${parent.status}` }] };
    const chain = await getChain(parent);
    if (chain.length >= 4) return { ok: false as const, name: req.name, violations: [{ field: "depth", message: "Delegation depth limit (3) reached" }] };

    const child: Policy = PolicySchema.parse(
      inherit(parent.policy, {
        goal: req.goal,
        search_query: req.search_query,
        budget_total: Math.round(req.budget_total * 100) / 100,
        approval_threshold: req.approval_threshold ?? undefined,
        max_per_item: req.max_per_item ?? undefined,
        max_items: req.max_items,
        ...(req.categories_allow?.length ? { categories_allow: req.categories_allow } : {}),
        merchants_block: req.merchants_block,
        must_have: req.must_have ?? [],
      }),
    );
    const { money, items } = await delegableOf(parent);
    const check = attenuate(parent.policy, child, money, items);
    if (!check.ok) {
      await logEvent({
        mandateId: parent.id,
        type: "POLICY_VERDICT",
        tool: "delegate",
        verdict: "DENY",
        rule: "ATTENUATION",
        title: `Blocked delegation to ${req.name} — ${check.violations[0].message}`,
        amount: req.budget_total,
        detail: { request: req, violations: check.violations, by },
      });
      return { ok: false as const, name: req.name, violations: check.violations };
    }

    const root = chain[chain.length - 1];
    const id = newId("man");
    const agentToken = `mdt_${randomBytes(24).toString("base64url")}`;
    const expiresAt = new Date(Math.min(parent.expiresAt?.getTime() ?? Date.now() + 72 * 3600_000, Date.now() + child.expires_in_hours * 3600_000));
    // The child's signed document embeds its parent's signature hash → a verifiable chain of authority.
    const doc = {
      "mandate.id": id,
      "mandate.parent": { id: parent.id, sha256: parent.signatureHash },
      "mandate.root": { id: root.id, sha256: root.signatureHash, paypal_authorization_id: root.authorizationId },
      "mandate.policy": child,
      "mandate.name": req.name,
      "mandate.expires_at": expiresAt.toISOString(),
    };
    const sig = signMandate(doc);
    await db.insert(schema.mandates).values({
      id,
      rawText: `${req.name}: ${req.goal}`,
      policy: child,
      status: "ACTIVE",
      name: req.name,
      parentId: parent.id,
      rootId: root.id,
      budgetTotal: child.budget_total,
      authorizedAmount: child.budget_total, // a slice of the root's PayPal hold
      expiresAt,
      redTeam: root.redTeam,
      agentMode: req.agentMode,
      agentToken,
      signatureHash: sig.hash,
      signature: sig.signature,
      signingPublicKey: sig.publicKey,
      signedAt: new Date(),
      paypalOrderId: root.paypalOrderId,
    });
    await logEvent({
      mandateId: parent.id,
      type: "SYSTEM",
      tool: "delegate",
      title: `Delegated $${child.budget_total.toFixed(2)} to ${req.name} — “${req.goal}”`,
      amount: child.budget_total,
      detail: { childId: id, by, sha256: sig.hash, attenuation: "passed" },
    });
    await logEvent({
      mandateId: id,
      type: "SYSTEM",
      tool: "delegate",
      title: `Sub-mandate signed #${sig.hash.slice(0, 8)} — narrower than its parent on every rule, backed by the root PayPal hold`,
      detail: { parentId: parent.id, rootId: root.id, sha256: sig.hash },
    });
    return { ok: true as const, mandateId: id, name: req.name, budget: child.budget_total, agentToken, signatureHash: sig.hash };
  });
}

const PlanSchema = z.object({
  rationale: z.string().describe("One sentence: how you split the mandate"),
  children: z
    .array(
      z.object({
        name: z.string().describe("Short role name ending in 'agent', e.g. 'Monitor agent'"),
        goal: z.string(),
        search_query: z.string(),
        budget_total: z.number().positive(),
        approval_threshold: z.number().positive().nullable(),
        max_items: z.number().int().positive(),
        categories_allow: z.array(z.string()),
      }),
    )
    .min(1)
    .max(4),
});

/** Orchestrator: split a team mandate into 2-4 specialist sub-mandates. Each must pass attenuation. */
export async function planTeam(rootId: string) {
  const root = await getMandate(rootId);
  if (!root) throw new Error("Mandate not found");
  const p = root.policy;
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: PlanSchema }),
    temperature: 0,
    maxRetries: 1,
    system: `You are an orchestrator splitting a purchasing mandate across specialist sub-agents.
Each sub-agent gets ONE kind of item. Budgets must sum to AT MOST the parent's budget (leave a little slack).
Every sub-mandate must be at least as strict as the parent: approval_threshold at or below the parent's (or null only if the parent has none), max_items within the parent's, categories within the parent's.`,
    prompt: `Parent mandate: "${root.rawText}"\nParent policy: ${JSON.stringify({ budget_total: p.budget_total, approval_threshold: p.approval_threshold, max_items: p.max_items, categories_allow: p.categories_allow, must_have: p.must_have })}`,
  });
  await logEvent({ mandateId: root.id, type: "THOUGHT", title: `Orchestrator: ${output.rationale}`, detail: { plan: output.children } });
  const results: DelegationResult[] = [];
  for (const c of output.children) {
    // "usb-c-hub agent" → "USB-C hub agent"; "cloud_research-data" → "Cloud research data agent"
    const words = c.name.trim().replace(/[\s_-]+agent$/i, "").replace(/[_-]+/g, " ").replace(/\busb c\b/gi, "USB-C").split(/\s+/);
    const fixed = words.map((w) => (/^(usb-c|gpu|ai|api|ssd|hdmi|4k|it|hr|pc)$/i.test(w) ? w.toUpperCase() : w.toLowerCase()));
    const base = fixed.join(" ");
    const name = `${base.charAt(0).toUpperCase()}${base.slice(1)} agent`;
    results.push(await createSubMandate(root.id, { ...c, name, approval_threshold: c.approval_threshold, agentMode: "builtin", max_items: c.max_items }, "agent"));
  }
  return results;
}

/** Public, minimal fingerprint of a signed document (used by merchant verification). */
export const fingerprint = (doc: unknown) => createHash("sha256").update(canonical(doc)).digest("hex");
