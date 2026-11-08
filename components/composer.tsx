"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button, Card } from "./ui";

const EXAMPLES = [
  "Running shoes for my marathon, max $120, arrive by Saturday, ask me before spending over $80. Nothing from Amazon.",
  "Noise-cancelling headphones under $150 for studying, well rated, ask me above $100.",
  "A birthday gift for my mom who loves gardening, around $50, must arrive within 5 days.",
];

export function Composer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/mandates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong");
      router.push(`/m/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="p-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim().length > 4 && submit()}
        rows={4}
        placeholder="Tell your agent what to buy, your budget, and your rules…"
        className="w-full resize-none rounded-xl bg-transparent p-4 text-lg leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-3">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setText(ex)}
              className="max-w-[16rem] truncate rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
        <Button onClick={submit} disabled={busy || text.trim().length < 5}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          {busy ? "Compiling policy…" : "Create mandate"}
        </Button>
      </div>
      {error && <p className="px-4 pb-3 text-sm text-deny">{error}</p>}
    </Card>
  );
}
