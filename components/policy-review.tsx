"use client";
import { useState } from "react";
import { PayPalProvider, PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { AlertCircle, ArrowDown, Bot, Cpu, HelpCircle, Loader2, Lock, Pencil, Plug } from "lucide-react";
import type { Policy } from "@/lib/policy/schema";
import type { View } from "./mandate-screen";
import { Card, cn, usd } from "./ui";
import { Envelope } from "./envelope";

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
  if (f.kind === "money") return <span className="num">{usd(v as number)}</span>;
  if (f.kind === "rating") return <span className="num">★ {String(v)}+</span>;
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

  const agentMode: "builtin" | "external" = (mandate as any)?.agentMode === "external" ? "external" : "builtin";
  const [modeBusy, setModeBusy] = useState(false);
  async function setMode(mode: "builtin" | "external") {
    if (mode === agentMode || modeBusy) return;
    setModeBusy(true);
    const r = await fetch(`/api/mandates/${mandate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentMode: mode }),
    });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "Couldn't change the agent mode.");
    setModeBusy(false);
    onChange();
  }

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
      <Card className="p-5 sm:p-6">
        <div className="rounded-xl bg-surface-2/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">You wrote</p>
          <p className="mt-1 text-[15px] leading-relaxed">“{mandate.rawText}”</p>
        </div>
        <div className="my-3 flex items-center gap-2 text-[11px] font-medium text-faint">
          <span className="h-px flex-1 bg-line" />
          <ArrowDown size={12} /> compiled into {FIELDS.length} machine-checked rules
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Your agent&apos;s rules</h2>
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1 text-xs text-faint"><Pencil size={11} /> Tap a rule to edit</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const v = policy[f.key];
            const isEditing = editing === f.key;
            const byPayPal = f.key === "budget_total";
            return (
              <button
                key={f.key}
                onClick={() => {
                  if (isEditing) return;
                  setEditing(f.key);
                  setDraft(Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
                }}
                className={cn(
                  "group rounded-xl border px-4 py-3 text-left transition hover:border-accent",
                  byPayPal ? "border-paypal/40 bg-paypal/5 sm:col-span-2" : "border-line bg-surface-2/50",
                  isEditing && "border-accent ring-2 ring-accent-soft",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">{f.label}</p>
                  {byPayPal ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-paypal"><Lock size={10} /> enforced by PayPal hold</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-faint"><Cpu size={10} /> policy engine</span>
                  )}
                </div>
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
                  <p className={cn("mt-0.5 truncate font-medium", byPayPal && "text-lg")}>{display(f, v)}</p>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-faint">
          The policy engine is plain code — 13 deterministic checks on every purchase. The AI can propose; it can&apos;t approve.
        </p>
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

      <Card className="h-fit p-5 sm:p-6 lg:sticky lg:top-20">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock size={14} className="text-paypal" /> Approve the budget hold</div>
        <Envelope authorized={mandate.budgetTotal} captured={0} preview className="border-0 bg-surface-2/50 p-4" />
        <p className="mt-3 text-sm text-muted">
          PayPal places a hold for this amount. Your agent can only capture from it — purchases that break your rules are blocked, and anything left is released when it&apos;s done.
        </p>
        <fieldset className="mt-5" disabled={authorizing}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Who shops</legend>
          <div className="grid gap-2" role="radiogroup">
            {([
              ["builtin", Bot, "Mandate's agent shops for me", "Starts as soon as the hold is approved."],
              ["external", Plug, "Connect my own AI agent (MCP)", "Claude or any MCP client — same rules, same hold."],
            ] as const).map(([mode, I, title, sub]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={agentMode === mode}
                onClick={() => setMode(mode)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  agentMode === mode ? "border-accent bg-accent-soft" : "border-line hover:border-accent/60",
                )}
              >
                <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", agentMode === mode ? "border-accent" : "border-line")}>
                  {agentMode === mode && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium"><I size={14} className="text-accent" /> {title}</span>
                  <span className="block text-xs text-muted">{sub}</span>
                </span>
                {modeBusy && agentMode !== mode && <Loader2 size={14} className="ml-auto mt-0.5 animate-spin text-faint" />}
              </button>
            ))}
          </div>
        </fieldset>
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
