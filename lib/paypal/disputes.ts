// PayPal Disputes API (v1/customer/disputes). Writ is the merchant of record in the sandbox, so a
// buyer's dispute lands on Writ's own captures; Writ answers it with evidence or accepts the claim.
import { env } from "@/lib/env";
import { paypal, paypalForm } from "./client";

export interface PayPalDispute {
  dispute_id: string;
  reason?: string;
  status: string;
  dispute_state?: string;
  dispute_life_cycle_stage?: string;
  dispute_amount?: { value: string; currency_code: string };
  disputed_transactions?: { seller_transaction_id?: string; buyer_transaction_id?: string }[];
  messages?: { posted_by: string; content: string; time_posted?: string }[];
  evidences?: { evidence_type: string; source?: string; notes?: string }[];
  dispute_outcome?: { outcome_code?: string; amount_refunded?: { value: string } };
  links?: { href: string; rel: string; method?: string }[];
  create_time?: string;
}

export const getDispute = (id: string) => paypal<PayPalDispute>(`/v1/customer/disputes/${encodeURIComponent(id)}`);

/** Disputes on one capture (seller transaction id). */
export async function listDisputesFor(captureId: string) {
  const r = await paypal<{ items?: { dispute_id: string }[] }>(`/v1/customer/disputes?disputed_transaction_id=${encodeURIComponent(captureId)}&page_size=20`);
  return r.items ?? [];
}

/** All recent disputes on the merchant account. */
export async function listRecentDisputes() {
  const r = await paypal<{ items?: { dispute_id: string }[] }>(`/v1/customer/disputes?page_size=50`);
  return r.items ?? [];
}

export const hasLink = (d: PayPalDispute, rel: string) => !!d.links?.some((l) => l.rel === rel);

/** SANDBOX ONLY: move a dispute to WAITING_FOR_SELLER_RESPONSE so the merchant can submit evidence. */
export async function requireSellerEvidence(id: string) {
  if (!env.paypal.sandbox()) throw new Error("require-evidence is a sandbox-only API");
  return paypal(`/v1/customer/disputes/${encodeURIComponent(id)}/require-evidence`, { body: { action: "SELLER_EVIDENCE" } });
}

export interface EvidenceItem {
  evidence_type: string;
  notes?: string;
  evidence_info?: { tracking_info?: { carrier_name: string; tracking_number: string }[]; refund_ids?: { refund_id: string }[] };
}

export function provideEvidence(id: string, evidences: EvidenceItem[], file: { name: string; bytes: Uint8Array }, key: string) {
  return paypalForm(`/v1/customer/disputes/${encodeURIComponent(id)}/provide-evidence`, { evidences }, [{ field: "evidence-file", name: file.name, type: "application/pdf", bytes: file.bytes }], key);
}

export function acceptClaimRest(id: string, note: string, key: string) {
  return paypalForm(`/v1/customer/disputes/${encodeURIComponent(id)}/accept-claim`, { note, accept_claim_type: "REFUND" }, [], key);
}
