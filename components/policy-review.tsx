"use client";
import { useRef, useState } from "react";
import { PayPalProvider, PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { PasskeySign } from "./instrument/passkey-sign";
import type { Policy } from "@/lib/policy/schema";
import type { View } from "./mandate-screen";
import { cn, usd } from "./ui";
import {
  InstrumentFace,
  ClauseRow,
  SignatureLine,
  CLAUSE_FIELDS,
  VALIDITY_FIELD,
  AutonomyChoice,
  editText,
  isSet,
  parseEdit,
  type ClauseField,
} from "./instrument";

/**
 * "You are signing this." The compiled policy rendered as the instrument itself.
 * Every clause is the edit control; the stub below the perforation holds the
 * shopping instruction, the signature rule and the PayPal button (the signature).
 */
export function PolicyReview({ view, onChange }: { view: View; onChange: () => void }) {
  const { mandate } = view;
  const policy = mandate.policy;
  const [editing, setEditing] = useState<keyof Policy | null>(null);
  const open = useRef<keyof Policy | null>(null); // guards Enter + blur double-commit
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  type Mode = "builtin" | "team" | "external";
  const rawMode = (mandate as any)?.agentMode as string | undefined;
  const agentMode: Mode = rawMode === "external" || rawMode === "team" ? rawMode : "builtin";
  const [modeBusy, setModeBusy] = useState(false);
  async function setMode(mode: Mode) {
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

  function edit(f: ClauseField) {
    if (authorizing) return;
    setEditing(f.key);
    open.current = f.key;
    setAdding(false);
    setDraft(editText(policy[f.key]));
  }

  async function save(f: ClauseField) {
    if (open.current !== f.key) return;
    open.current = null;
    const value = parseEdit(f, draft);
    setEditing(null);
    if (value === undefined) return;
    if (JSON.stringify(value) === JSON.stringify(policy[f.key] ?? (f.kind === "list" ? [] : null))) return;
    const r = await fetch(`/api/mandates/${mandate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy: { [f.key]: value } }),
    });
    if (!r.ok) setError((await r.json()).error);
    else setError(null);
    onChange();
  }

  const unset = CLAUSE_FIELDS.filter((f) => !isSet(policy[f.key]) && f.key !== editing);
  const today = new Date();

  const rowProps = (f: ClauseField) => ({
    editing: editing === f.key,
    draft,
    onEdit: () => edit(f),
    onDraft: setDraft,
    onCommit: () => save(f),
    onCancel: () => {
      open.current = null;
      setEditing(null);
    },
    disabled: authorizing,
  });

  const afterClauses = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          disabled={authorizing || unset.length === 0}
          className="label min-h-11 text-muted transition-colors duration-[120ms] hover:text-ink disabled:opacity-40"
        >
          {adding ? "− Close" : "+ Add clause"}
        </button>
        <p className="text-xs text-muted">Click any clause to amend it.</p>
      </div>
      {adding && (
        <div className="animate-ink flex flex-wrap gap-2 pb-3">
          {unset.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => edit(f)}
              className="min-h-11 rounded-[2px] border border-line px-3 text-sm text-ink transition-colors duration-[120ms] hover:border-ink/50 sm:min-h-9"
            >
              <span className="text-muted">+</span> {f.short}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The policy engine is plain code: 13 deterministic checks on every purchase. The AI can propose; it can&apos;t approve.
      </p>

      {policy.ambiguities.length > 0 && (
        <aside className="mt-5 border-l-2 border-escalate py-1 pl-4" aria-label="Open questions">
          <span className="label text-escalate">Open questions · {policy.ambiguities.length}</span>
          <ol className="mt-2 space-y-1.5">
            {policy.ambiguities.map((q, i) => (
              <li key={q} className="grid grid-cols-[2rem_1fr] text-[15px] leading-snug">
                <span className="num text-sm text-muted">Q{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-muted">Answer by amending a clause or adding a preference. Otherwise the agent uses its judgment, inside these clauses.</p>
        </aside>
      )}
    </>
  );

  const validity =
    editing === VALIDITY_FIELD.key ? (
      <ol>
        <ClauseRow clause={{ ...VALIDITY_FIELD, value: policy.expires_in_hours, set: true }} n={0} {...rowProps(VALIDITY_FIELD)} />
      </ol>
    ) : (
      <button
        type="button"
        onClick={() => edit(VALIDITY_FIELD)}
        disabled={authorizing}
        className="group flex min-h-11 w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left"
        aria-label={`Amend validity: ${policy.expires_in_hours} hours`}
      >
        <span className="label text-muted">Valid for</span>
        <span className="num text-sm font-medium text-ink underline decoration-line decoration-dotted underline-offset-[5px] group-hover:decoration-ink">
          {policy.expires_in_hours} h
        </span>
        <span className="text-sm text-muted">from signing; after that the engine denies every purchase.</span>
      </button>
    );

  const stub = (
    <div className="grid gap-6">
      <AutonomyChoice
        mandateId={mandate.id}
        value={policy.autonomy}
        approvalThreshold={policy.approval_threshold}
        maxPerItem={policy.max_per_item}
        onChange={onChange}
        disabled={authorizing}
      />

      <fieldset disabled={authorizing}>
        <legend className="label mb-3 text-muted">Instruction · who shops</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who shops">
          {(
            [
              ["builtin", "One agent shops for me", "Starts as soon as PayPal confirms the hold."],
              ["team", "A team of agents", "An orchestrator delegates narrower sub-mandates to specialists. One hold."],
              ["external", "My own AI agent (MCP)", "Claude or any MCP client. Same clauses, same hold."],
            ] as const
          ).map(([mode, title, sub]) => {
            const on = agentMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMode(mode)}
                className={cn(
                  "flex min-h-11 items-start gap-3 rounded-[2px] border px-3 py-3 text-left transition-colors duration-[120ms]",
                  on ? "border-ink bg-surface" : "border-line hover:border-ink/40",
                )}
              >
                <span className={cn("mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center border", on ? "border-ink" : "border-muted")} aria-hidden>
                  {on && <span className="h-1.5 w-1.5 bg-ink" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{title}</span>
                  <span className="block text-sm text-muted">
                    {modeBusy && !on ? "Recording instruction…" : sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <SignatureLine pendingDate={today} method={(mandate as any)?.signedWith ?? null} />
      <PasskeySign mandateId={mandate.id} signed={(mandate as any)?.signedWith === "passkey"} intentHash={(mandate as any)?.passkeyIntentHash ?? null} onSigned={onChange} disabled={authorizing} />

      <div>
        <p className="text-pretty text-[15px] leading-relaxed text-ink">
          Nothing is charged. PayPal places a hold for <span className="num font-medium text-paypal-navy">{usd(mandate.budgetTotal)}</span>; the agent
          can only capture from it.
        </p>
        <p className="mt-1 text-sm text-muted">Approving the hold is your signature. The mandate is then frozen and sealed with Ed25519.</p>
      </div>

      {error && (
        <p role="alert" className="border-l-2 border-deny pl-3 text-sm text-deny">
          {error}
        </p>
      )}

      <div className="min-h-12 sm:max-w-[420px]">
        {authorizing ? (
          <p className="label flex min-h-12 items-center gap-2 text-ink" role="status">
            PayPal is confirming the hold · starting your agent <span className="caret" />
          </p>
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
    </div>
  );

  return (
    <InstrumentFace
      mandate={mandate}
      forceShow={editing && editing !== VALIDITY_FIELD.key ? [editing] : []}
      renderClause={(c, n) => <ClauseRow key={c.key} clause={c} n={n} {...rowProps(c)} />}
      afterClauses={afterClauses}
      validity={validity}
      stub={stub}
    />
  );
}
