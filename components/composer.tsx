"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button, Card } from "./ui";

const EXAMPLES = [
  "Running shoes for my marathon, max $120, arrive by Saturday, ask me before spending over $80. Nothing from Amazon.",
  "Noise-cancelling headphones under $150 for studying, well rated, ask me above $100.",
  "A birthday gift for my mom who loves gardening, around $50, must arrive within 5 days.",
];

export function Composer() {
  const router = useRouter();
  const params = useSearchParams();
  const prompt = params.get("prompt");
  const [text, setText] = useState(prompt ?? "");
  const [prefilled, setPrefilled] = useState(!!prompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Prefill from /?prompt=… (guided demo). Never auto-submits — the human still clicks.
  useEffect(() => {
    if (!prompt) return;
    setText(prompt);
    setPrefilled(true);
    const el = box.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }, [prompt]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/mandates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "We couldn't compile that mandate.");
      router.push(`/m/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const ok = text.trim().length >= 5;
  return (
    <Card id="compose" className="scroll-mt-24 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-dashed border-line px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">New mandate</span>
        {prefilled ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-accent"><Sparkles size={12} /> Prefilled from the guided demo — review, then create</span>
        ) : (
          <span className="hidden text-[11px] text-faint sm:inline">What · budget · when to ask you · what to avoid</span>
        )}
      </div>
      <textarea
        ref={box}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPrefilled(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && ok && !busy && submit()}
        rows={4}
        placeholder="e.g. “Running shoes for my marathon, max $120, ask me before spending over $40.”"
        className="slip block w-full resize-none bg-transparent px-4 py-3 text-lg leading-7 outline-none placeholder:text-faint"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/40 p-3">
        <div className="flex min-w-0 flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setText(ex);
                setPrefilled(false);
              }}
              className="max-w-[15rem] truncate rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
        <Button onClick={submit} disabled={busy || !ok} className="w-full sm:w-auto">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          {busy ? "Compiling policy…" : "Create mandate"}
        </Button>
      </div>
      {error && (
        <div className="flex items-start gap-2 border-t border-deny/20 bg-deny-soft px-4 py-3 text-sm text-deny">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="mt-0.5 text-xs text-muted">Try naming a product, a dollar budget, and when the agent should ask you — or pick an example above.</p>
          </div>
        </div>
      )}
    </Card>
  );
}
