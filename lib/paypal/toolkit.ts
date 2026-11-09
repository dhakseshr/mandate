// PayPal's official Agent Toolkit. Its ai-sdk adapter targets AI SDK v4, so we don't hand its
// tools to the model directly. Instead we call each tool's `execute` from our own guarded v7
// tools — the model never gets raw access to PayPal.
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { env } from "@/lib/env";

let toolkit: PayPalAgentToolkit | null = null;

function get() {
  toolkit ??= new PayPalAgentToolkit({
    clientId: env.paypal.clientId(),
    clientSecret: env.paypal.clientSecret(),
    configuration: {
      // Keys match the toolkit's internal action map (verified against @paypal/agent-toolkit 1.11).
      actions: {
        orders: { get: true },
        shipment: { create: true, get: true },
        payments: { createRefund: true, getRefunds: true },
        transactions: { list: true },
        disputes: { list: true, get: true, create: true }, // create = accept_dispute_claim
        insights: { get: true },
      },
      context: { sandbox: env.paypal.sandbox() },
    },
  });
  return toolkit;
}

export type ToolkitTool =
  | "get_order"
  | "create_shipment_tracking"
  | "get_shipment_tracking"
  | "create_refund"
  | "get_refund"
  | "list_transactions"
  | "list_disputes"
  | "get_dispute"
  | "accept_dispute_claim";

/**
 * Call a toolkit tool and return parsed JSON. The toolkit sometimes returns a JSON string and
 * sometimes reports API failures as a string instead of throwing — normalise both into a throw.
 */
export async function callToolkit<T = any>(name: ToolkitTool, args: Record<string, unknown>): Promise<T> {
  const tools = get().getTools() as Record<string, { execute?: (a: any, o?: any) => Promise<unknown> }>;
  const t = tools[name];
  if (!t?.execute) throw new Error(`PayPal Agent Toolkit tool not enabled: ${name}`);
  const raw = await t.execute(args, { toolCallId: name, messages: [] });
  let out: any = raw;
  if (typeof raw === "string") {
    try {
      out = JSON.parse(raw);
    } catch {
      throw new Error(`Toolkit ${name}: ${raw.slice(0, 200)}`);
    }
  }
  if (out && typeof out === "object" && (out.error || out.name === "UNPROCESSABLE_ENTITY" || out.debug_id && !out.id))
    throw new Error(`Toolkit ${name}: ${JSON.stringify(out).slice(0, 300)}`);
  return out as T;
}

export function enabledToolkitTools(): string[] {
  return Object.keys(get().getTools());
}
