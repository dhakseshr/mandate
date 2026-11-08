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
      actions: {
        orders: { get: true },
        shipment: { create: true, get: true },
        refunds: { create: true, get: true },
        transactions: { list: true },
        disputes: { list: true, get: true },
        reporting: { insights: true },
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
  | "get_dispute";

export async function callToolkit(name: ToolkitTool, args: Record<string, unknown>): Promise<unknown> {
  const tools = get().getTools() as Record<string, { execute?: (a: any, o?: any) => Promise<unknown> }>;
  const t = tools[name];
  if (!t?.execute) throw new Error(`PayPal Agent Toolkit tool not enabled: ${name}`);
  return t.execute(args, { toolCallId: name, messages: [] });
}

export function enabledToolkitTools(): string[] {
  return Object.keys(get().getTools());
}
