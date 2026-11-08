import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { getMandate, logEvent } from "@/lib/ledger";
import { authorizeEnvelope } from "@/lib/paypal/envelope";
import { startAgentInBackground } from "@/lib/agent/run";
import { mandateDocument, signMandate } from "@/lib/signing";
import { planTeam } from "@/lib/delegation";

export const runtime = "nodejs";

/** Step 2: buyer approved in PayPal → authorize the hold, activate the mandate, start the agent. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orderId } = z.object({ orderId: z.string() }).parse(await req.json());
  const m = await getMandate(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (m.status === "ACTIVE") return NextResponse.json({ ok: true });
  if (m.paypalOrderId !== orderId) return NextResponse.json({ error: "Order does not belong to this mandate" }, { status: 400 });

  try {
    const auth = await authorizeEnvelope(orderId);
    const expiresAt = new Date(Date.now() + m.policy.expires_in_hours * 3_600_000);
    await db
      .update(schema.mandates)
      .set({
        status: "ACTIVE",
        authorizationId: auth.authorizationId,
        authorizedAmount: auth.amount,
        payerEmail: auth.payerEmail,
        expiresAt,
      })
      .where(eq(schema.mandates.id, id));
    await logEvent({
      mandateId: id,
      type: "PAYPAL",
      title: `You authorized a $${auth.amount.toFixed(2)} budget with PayPal`,
      amount: auth.amount,
      paypalId: auth.authorizationId,
      detail: { ...auth, api: `POST /v2/checkout/orders/${orderId}/authorize` },
    });

    // Freeze + sign the mandate, bound to the PayPal authorization that backs it.
    const doc = mandateDocument({ ...m, authorizationId: auth.authorizationId, authorizedAmount: auth.amount, expiresAt });
    const sig = signMandate(doc);
    await db
      .update(schema.mandates)
      .set({ signatureHash: sig.hash, signature: sig.signature, signingPublicKey: sig.publicKey, signedAt: new Date() })
      .where(eq(schema.mandates.id, id));
    await logEvent({
      mandateId: id,
      type: "SYSTEM",
      title: `Mandate signed (Ed25519) #${sig.hash.slice(0, 8)} — AP2 IntentMandate bound to PayPal authorization`,
      detail: { sha256: sig.hash, export: `/api/mandates/${id}/ap2` },
    });
    // Scoped credential for external agents (MCP). Useless beyond this mandate's signed policy.
    const agentToken = `mdt_${randomBytes(24).toString("base64url")}`;
    await db.update(schema.mandates).set({ agentToken }).where(eq(schema.mandates.id, id));

    if (m.agentMode === "external") {
      await logEvent({
        mandateId: id,
        type: "SYSTEM",
        title: "Waiting for your AI agent to connect over MCP",
        detail: { mcp_endpoint: "/api/mcp" },
      });
    } else if (m.agentMode === "team") {
      // Orchestrator splits the mandate into attenuated sub-mandates; each specialist agent shops in parallel.
      void planTeam(id)
        .then((results) => results.forEach((r) => r.ok && startAgentInBackground(r.mandateId)))
        .catch(async (e) => {
          console.error("[team]", e);
          await logEvent({ mandateId: id, type: "SYSTEM", title: "Orchestrator failed to plan the team — press Resume to retry" });
        });
    } else {
      startAgentInBackground(id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[authorize]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
