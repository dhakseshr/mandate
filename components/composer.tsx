"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui";

const EXAMPLES = [
  { label: "Marathon shoes, $120, ask above $80", text: "Running shoes for my marathon, max $120, arrive by Saturday, ask me before spending over $80. Nothing from Amazon." },
  { label: "Headphones under $150", text: "Noise-cancelling headphones under $150 for studying, well rated, ask me above $100." },
  { label: "A $50 gardening gift", text: "A birthday gift for my mom who loves gardening, around $50, must arrive within 5 days." },
  { label: "Red team: a poisoned listing", text: "Running shoes for my marathon, max $120, ask me above $80. [red-team]" },
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
    <div id="compose" className="min-w-0 scroll-mt-24 border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <label htmlFor="mandate-text" className="label text-ink">
          For — in your words
        </label>
        {prefilled ? (
          <span className="label text-ink">Prefilled from the demo · read it, then compile</span>
        ) : (
          <span className="num text-xs text-muted">№ MDT-————</span>
        )}
      </div>
      <textarea
        id="mandate-text"
        ref={box}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPrefilled(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && ok && !busy && submit()}
        rows={4}
        aria-describedby="mandate-hint"
        placeholder="Running shoes for my marathon, max $120, ask me before spending over $80."
        className="ruled ruled-field display block min-h-[120px] w-full resize-none bg-transparent px-4 pb-1 text-[1.25rem] italic text-ink outline-none placeholder:text-muted sm:px-5"
      />
      <p id="mandate-hint" className="label border-t border-line px-4 py-3 leading-relaxed text-muted sm:px-5">
        What · budget · when to ask you · what to avoid
        <span className="hidden sm:inline"> &nbsp;·&nbsp; ⌘/Ctrl + Enter to compile</span>
      </p>
      <div className="flex flex-col gap-4 border-t border-line px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="min-w-0">
          <span className="label">Or start from</span>
          <ul className="mt-1 flex flex-wrap gap-x-5">
            {EXAMPLES.map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  onClick={() => {
                    setText(ex.text);
                    setPrefilled(false);
                    setError(null);
                  }}
                  title={ex.text}
                  className="inline-flex min-h-11 items-center text-sm text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  {ex.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={submit} disabled={busy || !ok} className="min-h-11 w-full shrink-0 sm:w-auto">
          {busy ? "Compiling policy…" : "Compile policy"}
          {!busy && <ArrowRight size={16} aria-hidden />}
        </Button>
      </div>
      {error && (
        <div role="alert" className="border-t border-deny/40 bg-deny-soft px-4 py-3 sm:px-5">
          <span className="label text-deny">Could not compile</span>
          <p className="mt-1.5 text-sm font-medium text-deny">{error}</p>
          <p className="mt-1 text-sm text-muted">Name a product, a dollar budget, and when the agent should ask you — or start from an example above.</p>
        </div>
      )}
    </div>
  );
}
