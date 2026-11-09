import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export const PAYPAL_BASE = () =>
  env.paypal.sandbox() ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const basic = Buffer.from(`${env.paypal.clientId()}:${env.paypal.clientSecret()}`).toString("base64");
  const r = await fetch(`${PAYPAL_BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!r.ok) throw new PayPalError(r.status, await r.json().catch(() => ({})), "oauth2/token");
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

export class PayPalError extends Error {
  constructor(public status: number, public body: any, public path: string) {
    super(`PayPal ${status} on ${path}: ${body?.details?.[0]?.issue ?? body?.name ?? body?.error ?? "error"}`);
  }
  get debugId(): string | undefined {
    return this.body?.debug_id;
  }
}

/**
 * Thin PayPal REST wrapper.
 * `idempotencyKey` maps to PayPal-Request-Id so a retried capture can never double-charge.
 */
export async function paypal<T = any>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const r = await fetch(PAYPAL_BASE() + path, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(method !== "GET" ? { "PayPal-Request-Id": opts.idempotencyKey ?? randomUUID() } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new PayPalError(r.status, json, path);
  return json as T;
}

/**
 * Multipart PayPal call (Disputes API: provide-evidence / accept-claim). The JSON request goes in an
 * `input` part; evidence documents (PDF/PNG/JPG/GIF only) go in file parts.
 */
export async function paypalForm<T = any>(
  path: string,
  input: unknown,
  files: { field: string; name: string; type: string; bytes: Uint8Array }[] = [],
  idempotencyKey?: string,
): Promise<T> {
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify(input)], { type: "application/json" }), "input.json");
  for (const f of files) form.append(f.field, new Blob([Buffer.from(f.bytes)], { type: f.type }), f.name);
  const r = await fetch(PAYPAL_BASE() + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken()}`, "PayPal-Request-Id": idempotencyKey ?? randomUUID() },
    body: form,
    cache: "no-store",
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new PayPalError(r.status, json, path);
  return json as T;
}
