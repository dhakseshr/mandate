"use client";
import { useState } from "react";
import { PayPalProvider, PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { AlertCircle, HelpCircle, Loader2, Lock } from "lucide-react";
import type { Policy } from "@/lib/policy/schema";
import type { View } from "./mandate-screen";
import { Card, usd } from "./ui";

type Field =
  | { key: keyof Policy; label: string; kind: "money" | "number" | "rating" | "date" }
  | { key: keyof Policy; label: string; kind: "list" };

const FIELDS: Field[] = [
  { key: "budget_total", label: "Budget cap", kind: "money" },
  { key: "approval_threshold", label: "Ask me above", kind: "money" },
  { key: "max_per_item", label: "Max per item", kind: "money" },
  { key: "max_items", label: "Max items", kind: "number" },
  { key: "deliver_by", label: "Deliver by", kind: "date" },
  { key: "min_rating", label: "Min rating", kind: "rating" },
  { key: "categories_allow", label: "Categories", kind: "list" },
  { key: "merchants_block", label: "Blocked merchants", kind: "list" },
  { key: "brands_block", label: "Blocked brands", kind: "list" },
  { key: "must_have", label: "Preferences", kind: "list" },
];

function display(f: Field, v: unknown) {
  if (v == null || (Array.isArray(v) && v.length === 0)) return <span className="text-faint">Not set</span>;
  if (f.kind === "money") return usd(v as number);
  if (f.kind === "rating") return `★ ${v}+`;
  if (f.kind === "date") return new Date(v as string).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (f.kind === "list") return (v as string[]).join(", ");
  return String(v);
}

function parse(f: Field, raw: string): unknown {
  const s = raw.trim();
  if (f.kind === "list") return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (!s) return f.key === "budget_total" || f.key === "max_items" ? undefined : null;
  if (f.kind === "date") return s;
  const n = Number(s.replace(/[$,★+\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function PolicyReview({ view, onChange }: { view: View; onChange: () => void }) {
  const { mandate } = view;
  const policy = mandate.policy;
  const [editing, setEditing] = useState<keyof Policy | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  async function save(f: Field) {
    const value = parse(f, draft);
    setEditing(null);
    if (value === undefined) return;
    const r = await fetch(`/api/mandates/${mandate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy: { [f.key]: value } }),
    });
    if (!r.ok) setError((await r.json()).error);
    else setError(null);
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Your agent&apos;s rules</h2>
          <p className="text-xs text-faint">Click any rule to edit</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const v = policy[f.key];
            const isEditing = editing === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  if (isEditing) return;
                  setEditing(f.key);
                  setDraft(Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
                }}
                className="group rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-left transition hover:border-accent"
              >
                <p className="text-xs text-muted">{f.label}</p>
                {isEditing ? (
                  <input
                    autoFocus
                    type={f.kind === "date" ? "date" : "text"}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => save(f)}
                    onKeyDown={(e) => e.key === "Enter" && save(f)}
                    className="mt-0.5 w-full bg-transparent font-medium outline-none"
                  />
                ) : (
                  <p className="mt-0.5 truncate font-medium">{display(f, v)}</p>
                )}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 flex items-center gap-1 text-sm text-deny"><AlertCircle size={14} /> {error}</p>}
        {policy.ambiguities.length > 0 && (
          <div className="mt-5 rounded-xl bg-escalate-soft p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-escalate">
              <HelpCircle size={15} /> Worth clarifying
            </p>
            <ul className="space-y-1 text-sm text-ink">
              {policy.ambiguities.map((q) => <li key={q}>• {q}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Add answers as Preferences above, or let the agent use its judgment.</p>
          </div>
        )}
      </Card>

      <Card className="h-fit p-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted"><Lock size={14} /> Budget authorization</div>
        <p className="text-4xl font-semibold tracking-tight">{usd(mandate.budgetTotal)}</p>
        <p className="mt-3 text-sm text-muted">
          PayPal places a hold for this amount. Your agent can only capture from it — purchases that break your rules are blocked, and anything left is released when it&apos;s done.
        </p>
        <div className="mt-5 min-h-12">
          {authorizing ? (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Authorizing & starting your agent…
            </div>
          ) : (
            <PayPalProvider clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!} environment="sandbox" pageType="checkout">
              <PayPalOneTimePaymentButton
                presentationMode="auto"
                createOrder={async () => {
                  const r = await fetch(`/api/mandates/${mandate.id}/order`, { method: "POST" });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j.error);
                  return { orderId: j.orderId };
                }}
                onApprove={async ({ orderId }: { orderId: string }) => {
                  setAuthorizing(true);
                  const r = await fetch(`/api/mandates/${mandate.id}/authorize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId }),
                  });
                  if (!r.ok) {
                    setAuthorizing(false);
                    setError((await r.json()).error);
                  }
                  onChange();
                }}
                onError={(e: unknown) => setError(`PayPal: ${String((e as Error)?.message ?? e)}`)}
              />
            </PayPalProvider>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-faint">Sandbox mode — no real money moves</p>
      </Card>
    </div>
  );
}
