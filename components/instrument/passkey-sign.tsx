"use client";
// "Sign with passkey" — the human's own WebAuthn signature over sha256(intent document).
import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Button, cn } from "../ui";

const KEY = "writ.passkey.credentialId";
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const save = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
};

export function PasskeySign({
  mandateId,
  signed,
  intentHash,
  onSigned,
  disabled,
}: {
  mandateId: string;
  signed: boolean;
  intentHash: string | null;
  onSigned: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  async function call(body: unknown) {
    const r = await fetch(`/api/mandates/${mandateId}/passkey`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Passkey step failed");
    return j;
  }

  async function sign() {
    setError(null);
    try {
      setBusy("Preparing…");
      let step = await call({ step: "start", credentialId: read() });
      if (step.mode === "register") {
        setBusy("Create a passkey for Writ…");
        const reg = await startRegistration({ optionsJSON: step.options });
        step = await call({ step: "register", response: reg });
        save(step.credentialId);
      }
      setBusy("Sign with your passkey…");
      const auth = await startAuthentication({ optionsJSON: step.options });
      await call({ step: "sign", response: auth });
      onSigned();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      setError(/NotAllowed|abort|cancel/i.test(msg) ? "Signing was cancelled." : msg);
    } finally {
      setBusy(null);
    }
  }

  if (signed)
    return (
      <div className="border-l-2 border-allow pl-3">
        <p className="label text-allow">Signed with your passkey</p>
        <p className="mt-1 text-sm text-muted">
          Your device signed sha256 <span className="num text-ink">#{intentHash?.slice(0, 12)}</span> of exactly these clauses. Edit any clause and you&apos;ll need to sign again.
        </p>
      </div>
    );

  return (
    <div className={cn("grid gap-2", !supported && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={sign} disabled={disabled || !!busy || !supported}>
          {busy ?? "Sign with passkey"}
        </Button>
        <span className="text-sm text-muted">Face ID, Touch ID, Windows Hello or a security key. Recommended, not required.</span>
      </div>
      {!supported && <p className="text-xs text-muted">This browser doesn&apos;t support passkeys — you can still authorize with PayPal.</p>}
      {error && <p className="text-sm text-deny">{error}</p>}
    </div>
  );
}
