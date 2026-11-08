"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Camera, Mic, Square, X } from "lucide-react";
import { Button, cn } from "./ui";

/* Minimal Web Speech API typing — not in lib.dom for every TS target. */
type SpeechAlt = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlt };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognizerCtor = new () => Recognizer;
const speechCtor = (): RecognizerCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Downscale a photo to ≤ maxPx on its long edge and re-encode as JPEG (keeps the vision call small). */
async function downscale(file: File, maxPx = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file isn't an image we can read."));
      i.src = url;
    });
    const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't prepare the photo.");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Vision = { item: string; details: string[]; suggested_mission: string; confidence: "LOW" | "MEDIUM" | "HIGH" };

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

  // Voice: dictate into the textarea (interim results shown live). Never submits — the human still clicks.
  const [canDictate, setCanDictate] = useState(false);
  const [listening, setListening] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const baseText = useRef("");
  useEffect(() => setCanDictate(!!speechCtor()), []);
  useEffect(() => () => rec.current?.stop(), []);
  function toggleDictation() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = true;
    baseText.current = text.trim() ? `${text.trimEnd()} ` : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText(baseText.current + finalText + interim);
      setPrefilled(false);
    };
    r.onerror = (e) => setMicErr(e.error === "not-allowed" ? "Microphone access was blocked." : "Dictation stopped.");
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    setMicErr(null);
    try {
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      setMicErr("Dictation couldn't start.");
    }
  }

  // Photo → suggested mission. The model only suggests text; the human edits it and still compiles.
  const file = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [vision, setVision] = useState<Vision | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setReading(true);
    setVision(null);
    setPhotoErr(null);
    try {
      const image = await downscale(f);
      const r = await fetch("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.item) throw new Error(j.error ?? "Couldn't read that photo — try a clearer picture, or type the mission.");
      setVision({ item: String(j.item), details: Array.isArray(j.details) ? j.details.map(String) : [], suggested_mission: String(j.suggested_mission ?? ""), confidence: j.confidence ?? "MEDIUM" });
    } catch (e) {
      setPhotoErr((e as Error).message || "Couldn't read that photo — try a clearer picture, or type the mission.");
    } finally {
      setReading(false);
      if (file.current) file.current.value = "";
    }
  }
  function applyMission() {
    if (!vision?.suggested_mission) return;
    setText(vision.suggested_mission);
    setPrefilled(false);
    setError(null);
    setVision(null);
    box.current?.focus();
  }

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
      if (!r.ok) throw new Error(j.error ?? "We couldn't draft a mandate from that mission.");
      router.push(`/m/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const ok = text.trim().length >= 5;
  return (
    <div id="compose" className="relative min-w-0 scroll-mt-24 border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <label htmlFor="mandate-text" className="label text-ink">
          Describe the mission
        </label>
        {listening ? (
          <span className="label text-ink" aria-live="polite">Listening · speak your mission<span className="caret ml-1" aria-hidden /></span>
        ) : reading ? (
          <span className="label text-ink" aria-live="polite">Reading your photo · 5–15 s<span className="caret ml-1" aria-hidden /></span>
        ) : prefilled ? (
          <span className="label text-ink">Prefilled from the demo · read it, then draft</span>
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
        className={cn(
          "ruled ruled-field display block min-h-[120px] w-full resize-none bg-transparent px-4 pb-1 text-[1.25rem] italic text-ink outline-none placeholder:text-muted sm:px-5",
          "pr-16 sm:pr-16",
        )}
      />
      <div className="absolute right-3 top-[3.75rem] flex flex-col gap-2">
      {canDictate && (
        <button
          type="button"
          onClick={toggleDictation}
          aria-pressed={listening}
          aria-label={listening ? "Stop dictation" : "Dictate your mission"}
          title={listening ? "Stop dictation" : "Dictate — nothing is submitted until you click Draft"}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-[2px] border transition-colors duration-[120ms]",
            listening ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink hover:border-ink/40",
          )}
        >
          {listening ? <Square size={14} aria-hidden /> : <Mic size={16} aria-hidden />}
        </button>
      )}
        <button
          type="button"
          onClick={() => file.current?.click()}
          disabled={reading}
          aria-label="Start from a photo"
          title="Start from a photo — Writ suggests a mission; nothing is submitted until you click Draft"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[2px] border border-line bg-surface text-ink transition-colors duration-[120ms] hover:border-ink/40 disabled:opacity-40"
        >
          <Camera size={16} aria-hidden />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>
      <p id="mandate-hint" className="label border-t border-line px-4 py-3 leading-relaxed text-muted sm:px-5">
        {micErr ? <span className="text-deny">{micErr} </span> : null}
        What · budget · when to ask you · what to avoid
        <span className="hidden sm:inline"> &nbsp;·&nbsp; ⌘/Ctrl + Enter to draft</span>
      </p>
      {photoErr && (
        <p role="alert" className="border-t border-line px-4 py-3 text-sm text-deny sm:px-5">
          {photoErr}
        </p>
      )}
      {vision && (
        <div className="animate-ink border-t border-line bg-surface-2 px-4 py-3 sm:px-5" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm text-ink">
              <span className="label mr-2 text-muted">From your photo</span>
              <span className="font-medium">{vision.item}</span>
              <span className="label ml-2 text-[10px] text-muted">confidence {vision.confidence.toLowerCase()}</span>
            </p>
            <button
              type="button"
              onClick={() => setVision(null)}
              aria-label="Dismiss photo suggestion"
              className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          {vision.details.length > 0 && <p className="num mt-1 break-words text-[12px] text-muted">{vision.details.join(" · ")}</p>}
          {vision.suggested_mission && (
            <>
              <p className="mt-2 border-l-2 border-ink pl-3 text-[15px] leading-snug text-ink">{vision.suggested_mission}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button variant="ghost" onClick={applyMission} className="min-h-11">
                  Use this mission
                </Button>
                <span className="text-sm text-muted">Fills the field. Edit it, then draft — nothing is bought from a photo.</span>
              </div>
            </>
          )}
        </div>
      )}
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
          {busy ? "Drafting the mandate…" : "Draft the mandate"}
          {!busy && <ArrowRight size={16} aria-hidden />}
        </Button>
      </div>
      {error && (
        <div role="alert" className="border-t border-deny/40 bg-deny-soft px-4 py-3 sm:px-5">
          <span className="label text-deny">Could not draft the mandate</span>
          <p className="mt-1.5 text-sm font-medium text-deny">{error}</p>
          <p className="mt-1 text-sm text-muted">Name a product, a dollar budget, and when the agent should ask you — or start from an example above.</p>
        </div>
      )}
    </div>
  );
}
